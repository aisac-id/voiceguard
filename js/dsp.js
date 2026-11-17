// VoiceGuard DSP toolbox — small, dependency-free, built for 16 kHz mono PCM.
"use strict";

const FFT_N = 2048;
const HANN = new Float32Array(FFT_N);
for (let i = 0; i < FFT_N; i++) HANN[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_N - 1));

// Precomputed bit-reversal + twiddles for a fixed-size iterative FFT.
const REV = new Uint16Array(FFT_N);
for (let i = 0; i < FFT_N; i++) {
  let r = 0;
  for (let b = 0; b < 11; b++) r = (r << 1) | ((i >> b) & 1);
  REV[i] = r;
}
const COS_T = new Float32Array(FFT_N / 2);
const SIN_T = new Float32Array(FFT_N / 2);
for (let i = 0; i < FFT_N / 2; i++) {
  COS_T[i] = Math.cos((-2 * Math.PI * i) / FFT_N);
  SIN_T[i] = Math.sin((-2 * Math.PI * i) / FFT_N);
}

const re = new Float32Array(FFT_N);
const im = new Float32Array(FFT_N);
const MAG = new Float32Array(FFT_N / 2);

// Magnitude spectrum of a 2048-sample window (zero-padded if shorter).
export function spectrum(pcm, offset) {
  for (let i = 0; i < FFT_N; i++) {
    const s = offset + i < pcm.length ? pcm[offset + i] : 0;
    re[REV[i]] = s * HANN[i];
    im[i] = 0;
  }
  for (let size = 2; size <= FFT_N; size <<= 1) {
    const half = size >> 1, step = FFT_N / size;
    for (let i = 0; i < FFT_N; i += size) {
      for (let j = 0; j < half; j++) {
        const t = j * step;
        const a = i + j, b = a + half;
        const tr = re[b] * COS_T[t] - im[b] * SIN_T[t];
        const ti = re[b] * SIN_T[t] + im[b] * COS_T[t];
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
  for (let i = 0; i < FFT_N / 2; i++) MAG[i] = Math.hypot(re[i], im[i]);
  return MAG; // reused buffer — consume before next call
}

export function rms(pcm, start, len) {
  let s = 0;
  const end = Math.min(pcm.length, start + len);
  for (let i = start; i < end; i++) s += pcm[i] * pcm[i];
  return Math.sqrt(s / Math.max(1, end - start));
}

// Autocorrelation pitch on a 2048-sample window, 60–350 Hz.
// Prefers the first strong correlation peak to avoid octave-down errors.
// Returns { f0, clarity } — clarity is the normalized peak (voiced speech > 0.5).
const P_N = 2048;
const P_X = new Float32Array(P_N);
const P_CORR = new Float32Array(512);
export function pitch(pcm, offset, sr) {
  if (offset + P_N > pcm.length) return { f0: 0, clarity: 0 };
  // 3-point smooth to tame broadband hiss before correlating
  P_X[0] = pcm[offset];
  for (let i = 1; i < P_N - 1; i++)
    P_X[i] = (pcm[offset + i - 1] + pcm[offset + i] + pcm[offset + i + 1]) / 3;
  P_X[P_N - 1] = pcm[offset + P_N - 1];
  const minLag = Math.floor(sr / 350), maxLag = Math.floor(sr / 60);
  let e0 = 0;
  for (let i = 0; i < P_N; i++) e0 += P_X[i] * P_X[i];
  if (e0 < 1e-6) return { f0: 0, clarity: 0 };
  let best = 0, bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0, e2 = 0;
    for (let i = 0; i < P_N - lag; i++) { c += P_X[i] * P_X[i + lag]; e2 += P_X[i + lag] * P_X[i + lag]; }
    const norm = c / Math.sqrt(e0 * e2 + 1e-9);
    P_CORR[lag] = norm;
    if (norm > best) { best = norm; bestLag = lag; }
  }
  if (best < 0.35) return { f0: 0, clarity: best };
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (P_CORR[lag] >= 0.88 * best && P_CORR[lag] >= P_CORR[lag - 1] && P_CORR[lag] >= P_CORR[lag + 1])
      return { f0: sr / lag, clarity: P_CORR[lag] };
  }
  return { f0: sr / bestLag, clarity: best };
}

// Band energy ratio helper on the magnitude spectrum.
export function bandEnergy(mag, sr, loHz, hiHz) {
  const binHz = sr / FFT_N;
  const a = Math.max(1, Math.floor(loHz / binHz));
  const b = Math.min(mag.length - 1, Math.ceil(hiHz / binHz));
  let s = 0;
  for (let i = a; i <= b; i++) s += mag[i] * mag[i];
  return s;
}

// Spectral flatness (geometric / arithmetic mean) over a band — tonal ≈ 0, noisy ≈ 1.
export function flatness(mag, sr, loHz, hiHz) {
  const binHz = sr / FFT_N;
  const a = Math.max(1, Math.floor(loHz / binHz));
  const b = Math.min(mag.length - 1, Math.ceil(hiHz / binHz));
  let logSum = 0, sum = 0, n = 0;
  for (let i = a; i <= b; i++) {
    const v = mag[i] * mag[i] + 1e-12;
    logSum += Math.log(v); sum += v; n++;
  }
  if (!n) return 0;
  return Math.exp(logSum / n) / (sum / n);
}

export { FFT_N };