// VoiceGuard authenticity engine — five-signal on-device voice triage.
//
// Signals (each normalized 0..1, higher = more human):
//   pitch  — F0 contour life: intonation spread and micro-jitter.
//   breath — noise floor between phrases: humans and real rooms carry
//            breath/hiss; TTS renders digital silence.
//   churn  — spectral flux irregularity: organic articulation is uneven,
//            vocoders are metronomic.
//   air    — spectral centroid behaviour: formant TTS swings violently
//            between buzz and noise; speech stays in a human lane.
//   period — voicing imperfection: breathy turbulence between harmonics
//            and imperfect periodicity; synthetic vowels are too clean.
//
// Heuristic triage, NOT forensic proof. See README.
"use strict";

import { spectrum, rms, pitch, bandEnergy, flatness, FFT_N } from "./dsp.js";

const SR = 16000;
const FRAME = 1024;              // 64 ms per pushed chunk
const WINDOW_MS = 6500;          // scoring window
const MAX_FRAMES = Math.ceil(WINDOW_MS / 64) + 8;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const std = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((v) => (v - m) * (v - m))));
};
const quantile = (a, p) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(p * (s.length - 1))];
};

export const SIGNAL_META = {
  pitch:  { label: "Pitch life",         hint: "Intonation spread & micro-jitter of F0" },
  breath: { label: "Breath floor",       hint: "Breath / room noise under the pauses" },
  churn:  { label: "Spectral churn",     hint: "Uneven, organic articulation changes" },
  air:    { label: "Spectral balance",   hint: "Human vowel↔consonant centroid lane" },
  period: { label: "Voice imperfection", hint: "Breathy turbulence & imperfect voicing" },
};

const WEIGHTS = { pitch: 0.08, breath: 0.34, churn: 0.14, air: 0.14, period: 0.30 };

export class VoiceAnalysis {
  constructor() {
    this.frames = [];
    this.prev = new Float32Array(FRAME);
    this.prevMag = null;
    this.startedAt = 0;
    // replay fingerprint: 48-band log spectrum once per ~0.5 s of speech
    this.fp = [];
    this.fpAcc = null;
    this.fpN = 0;
    this.replaySim = 0;
    this.lastResult = null;
    this.dispScore = null;
  }

  reset() {
    this.frames = [];
    this.prevMag = null;
    this.startedAt = 0;
    this.fp = [];
    this.fpAcc = null;
    this.fpN = 0;
    this.replaySim = 0;
    this.lastResult = null;
    this.dispScore = null;
  }

  push(chunk) {
    const now = performance.now();
    if (!this.startedAt) this.startedAt = now;
    const r = rms(chunk, 0, chunk.length);

    // adaptive speech gate: 40th percentile of the recent window
    const recentR = this.frames.map((f) => f.r);
    recentR.push(r);
    const gate = Math.max(0.004, quantile(recentR, 0.4) * 1.05);
    const speech = r > gate;

    // 2048-sample window = previous chunk + current
    const win = new Float32Array(FFT_N);
    win.set(this.prev, 0);
    win.set(chunk.subarray(0, FRAME), FRAME);
    this.prev.set(chunk);

    let f0 = 0, clarity = 0, centroid = 0, flux = 0, flat = 0;
    if (speech) {
      const p = pitch(win, 0, SR);
      f0 = p.f0; clarity = p.clarity;
      const mag = spectrum(win, 0);
      let wsum = 0, esum = 0;
      const binHz = SR / FFT_N;
      for (let i = 2; i < mag.length; i++) {
        const e = mag[i] * mag[i];
        wsum += e * i * binHz; esum += e;
      }
      centroid = esum > 1e-9 ? wsum / esum : 0;
      flat = flatness(mag, SR, 300, 3400);
      if (this.prevMag) {
        let d = 0, s = 0;
        for (let i = 2; i < mag.length; i++) { d += Math.abs(mag[i] - this.prevMag[i]); s += mag[i] + this.prevMag[i]; }
        flux = s > 1e-9 ? d / s : 0;
      }
      // replay fingerprint accumulation (~0.5 s of speech)
      if (!this.fpAcc) this.fpAcc = new Float32Array(48);
      const bandsPer = Math.floor((mag.length - 2) / 48);
      for (let b = 0; b < 48; b++) {
        let e = 0;
        for (let i = 2 + b * bandsPer; i < 2 + (b + 1) * bandsPer; i++) e += mag[i] * mag[i];
        this.fpAcc[b] += Math.log(e + 1e-9);
      }
      this.fpN++;
      if (this.fpN >= 8) {
        this.fp.push(Array.from(this.fpAcc, (v) => v / this.fpN));
        if (this.fp.length > 60) this.fp.shift();
        this.fpAcc = null; this.fpN = 0;
        this.#checkReplay();
      }
      this.prevMag = Float32Array.from(mag);
    } else {
      this.prevMag = null;
    }

    this.frames.push({ t: now, r, speech, f0, clarity, centroid, flux, flat });
    if (this.frames.length > MAX_FRAMES) this.frames.shift();
  }

  #checkReplay() {
    const n = this.fp.length;
    if (n < 12) { this.replaySim = 0; return; }
    // whiten: subtract the long-term per-band mean so stationary room hiss
    // doesn't make every fingerprint look identical
    const mu = new Float32Array(48);
    for (const f of this.fp) for (let i = 0; i < 48; i++) mu[i] += f[i] / n;
    const corr = (a, b) => {
      let dot = 0, na = 0, nb = 0;
      const ma = mean(a), mb = mean(b);
      for (let i = 0; i < 48; i++) {
        const x = a[i] - mu[i] - ma, y = b[i] - mu[i] - mb;
        dot += x * y; na += x * x; nb += y * y;
      }
      return dot / Math.sqrt(na * nb + 1e-9);
    };
    const a = this.fp[n - 1];
    let best = 0;
    for (let j = Math.max(0, n - 60); j < n - 8; j++) {
      const sim = corr(a, this.fp[j]);
      if (sim > best) best = sim;
    }
    this.replaySim = this.replaySim * 0.6 + best * 0.4;
  }

  evaluate(sensitivity = 1) {
    const now = performance.now();
    const age = this.startedAt ? now - this.startedAt : 0;
    const fr = this.frames;
    const speechFr = fr.filter((f) => f.speech);
    const voiced = speechFr.filter((f) => f.f0 > 0 && f.clarity > 0.5);
    const speechRatio = fr.length ? speechFr.length / fr.length : 0;

    const stats = {
      age, frames: fr.length, speechFrames: speechFr.length, speechRatio,
      f0Mean: 0, f0CV: 0, jitter: 0, floorRatio: 0, fluxCV: 0,
      centroidCV: 0, clarityMean: 0, flatMed: 0, replaySim: this.replaySim,
    };

    const f0s = voiced.map((f) => f.f0);
    stats.f0Mean = mean(f0s);
    stats.f0CV = stats.f0Mean > 0 ? std(f0s) / stats.f0Mean : 0;
    if (voiced.length > 2) {
      let j = 0, n = 0;
      for (let i = 1; i < voiced.length; i++) {
        if (voiced[i].t - voiced[i - 1].t < 150) { j += Math.abs(voiced[i].f0 - voiced[i - 1].f0); n++; }
      }
      stats.jitter = n && stats.f0Mean > 0 ? j / n / stats.f0Mean : 0;
    }

    const allR = fr.map((f) => f.r);
    const medR = quantile(allR, 0.5);
    // lower envelope: minimum of 2-frame smoothed RMS — real rooms hold a
    // stationary hiss floor, TTS drops to digital zero between words
    let min2 = Infinity;
    for (let i = 1; i < allR.length; i++) min2 = Math.min(min2, (allR[i] + allR[i - 1]) / 2);
    if (!isFinite(min2)) min2 = 0;
    stats.floorRatio = medR > 1e-6 ? min2 / medR : 0;

    const fluxes = speechFr.filter((f) => f.flux > 0).map((f) => f.flux);
    stats.fluxCV = mean(fluxes) > 0 ? std(fluxes) / mean(fluxes) : 0;
    const cents = speechFr.filter((f) => f.centroid > 0).map((f) => f.centroid);
    stats.centroidCV = mean(cents) > 0 ? std(cents) / mean(cents) : 0;
    stats.clarityMean = mean(voiced.map((f) => f.clarity));
    // flatness on voiced frames only — fricatives are broadband noise and
    // would mask the clean-vocoder signature we're looking for
    stats.flatMed = quantile(voiced.map((f) => f.flat), 0.5);

    const sig = {
      pitch:  clamp01((stats.f0CV - 0.04) / 0.18) * 0.6 + clamp01((stats.jitter - 0.01) / 0.06) * 0.4,
      breath: clamp01((stats.floorRatio - 0.01) / 0.15),
      churn:  clamp01((stats.fluxCV - 0.18) / 0.30),
      air:    1 - clamp01((stats.centroidCV - 0.65) / 0.35),
      period: clamp01((stats.flatMed - 0.015) / 0.08) * 0.6 + clamp01((0.85 - stats.clarityMean) / 0.25) * 0.4,
    };
    // no speech yet → don't claim anything
    if (speechFr.length < 4) { sig.pitch = 0; sig.churn = 0; sig.period = 0; }

    let raw = 0;
    for (const k in WEIGHTS) raw += WEIGHTS[k] * sig[k];
    const instant = clamp01(raw * sensitivity) * 100;
    // smooth the score so one fricative-heavy window doesn't flip the verdict
    this.dispScore = this.dispScore == null ? instant : this.dispScore * 0.7 + instant * 0.3;
    const score = Math.round(this.dispScore);

    const mature = age > 4000 && speechFr.length >= 22;
    let verdict, subtype;
    if (!mature) {
      verdict = "LISTENING";
      subtype = speechFr.length < 4 ? "WAITING FOR SPEECH" : "GATHERING SAMPLES";
    } else if (score >= 62) {
      verdict = "REAL";
      subtype = "LIVE HUMAN VOICE";
    } else if (score >= 36) {
      verdict = "SUSPECT";
      subtype = "MIXED / PROCESSED SIGNALS";
    } else {
      verdict = "SYNTHETIC";
      subtype =
        sig.breath < 0.05 && sig.period < 0.3 ? "ROBOTIC TTS"
        : this.replaySim > 0.985 ? "LOOPED / REPLAYED AUDIO"
        : "SYNTHETIC VOICE";
    }

    this.lastResult = { score, verdict, subtype, signals: sig, stats, mature };
    return this.lastResult;
  }
}