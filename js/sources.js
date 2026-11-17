// VoiceGuard source manager — demo reel / microphone / shared tab audio.
// All sources feed an AudioWorklet tap at 16 kHz mono.
"use strict";

const DEMO_CYCLE_MS = 16000;

export class SourceManager {
  constructor(onChunk, onStatus) {
    this.onChunk = onChunk;
    this.onStatus = onStatus;
    this.ctx = null;
    this.tap = null;
    this.kind = "none";
    this.demoSubject = "";
    this.groundTruth = "";
    this.stream = null;
    this.node = null;
    this.gain = null;
    this.demoBufs = null;
    this.demoTimer = null;
    this.demoIdx = 0;
    this.monitorOn = true;
    // ring buffer of recent PCM for the oscilloscope
    this.ring = new Float32Array(4096);
    this.ringN = 0;
    this.level = 0;
  }

  async ensureCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 16000 });
      await this.ctx.audioWorklet.addModule("js/vg-worklet.js");
      this.tap = new AudioWorkletNode(this.ctx, "vg-tap");
      this.tap.port.onmessage = (e) => {
        const chunk = e.data;
        this.ring.set(chunk, this.ringN % (4096 - 1024));
        this.ringN += 1024;
        let s = 0;
        for (let i = 0; i < chunk.length; i++) s += chunk[i] * chunk[i];
        this.level = Math.sqrt(s / chunk.length);
        this.onChunk(chunk);
      };
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      try { await this.ctx.resume(); } catch { /* needs a user gesture */ }
    }
    return this.ctx.state === "running";
  }

  async #loadDemo() {
    if (this.demoBufs) return;
    const fetchDec = async (url) => {
      const buf = await (await fetch(url)).arrayBuffer();
      return this.ctx.decodeAudioData(buf);
    };
    this.demoBufs = [
      { buf: await fetchDec("assets/real-voice.wav"), label: "ARCHIVAL HUMAN · NASA APOLLO 11 (PUBLIC DOMAIN)", truth: "REAL" },
      { buf: await fetchDec("assets/tts-voice.wav"), label: "ROBOTIC TTS · ESPEAK-NG (GROUND TRUTH)", truth: "SYNTHETIC" },
    ];
  }

  #playDemoBuffer() {
    if (this.node) { try { this.node.stop(); } catch {} this.node.disconnect(); }
    const d = this.demoBufs[this.demoIdx];
    this.demoSubject = d.label;
    this.groundTruth = d.truth;
    const n = this.ctx.createBufferSource();
    n.buffer = d.buf;
    n.loop = true;
    n.connect(this.tap);
    if (this.monitorOn) n.connect(this.gain);
    n.start();
    this.node = n;
    this.onStatus("demo-subject");
  }

  async useDemo() {
    this.stop();
    const ok = await this.ensureCtx();
    if (!ok) { this.onStatus("needs-gesture"); return false; }
    await this.#loadDemo();
    this.kind = "demo";
    this.demoIdx = 0;
    this.#playDemoBuffer();
    this.demoTimer = setInterval(() => {
      this.demoIdx = (this.demoIdx + 1) % this.demoBufs.length;
      this.#playDemoBuffer();
    }, DEMO_CYCLE_MS);
    this.onStatus("demo");
    return true;
  }

  setMonitor(on) {
    this.monitorOn = on;
    if (this.kind === "demo" && this.node) {
      try { this.node.disconnect(this.gain); } catch {}
      if (on) this.node.connect(this.gain);
    }
  }

  async useMic(deviceId) {
    this.stop();
    const ok = await this.ensureCtx();
    if (!ok) { this.onStatus("needs-gesture"); return false; }
    // processing OFF: noise suppression would erase the breath-floor signal
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    if (deviceId) audio.deviceId = { exact: deviceId };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    this.kind = "mic";
    this.demoSubject = "MICROPHONE · LIVE CAPTURE";
    this.groundTruth = "";
    const src = this.ctx.createMediaStreamSource(this.stream);
    src.connect(this.tap);
    this.node = src;
    this.onStatus("mic");
    return true;
  }

  async useTab() {
    this.stop();
    const ok = await this.ensureCtx();
    if (!ok) { this.onStatus("needs-gesture"); return false; }
    // video is required by getDisplayMedia; we only analyze the audio track
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const at = this.stream.getAudioTracks();
    if (!at.length) {
      this.stop();
      this.onStatus("no-audio");
      return false;
    }
    at[0].addEventListener("ended", () => this.onStatus("share-ended"));
    this.kind = "tab";
    this.demoSubject = "SHARED TAB / SCREEN AUDIO";
    this.groundTruth = "";
    const src = this.ctx.createMediaStreamSource(new MediaStream(at));
    src.connect(this.tap);
    this.node = src;
    this.onStatus("tab");
    return true;
  }

  stop() {
    if (this.demoTimer) { clearInterval(this.demoTimer); this.demoTimer = null; }
    if (this.node) {
      try { this.node.stop?.(); } catch {}
      try { this.node.disconnect(); } catch {}
      this.node = null;
    }
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = null;
    }
    this.kind = "none";
    this.level = 0;
    this.ringN = 0;
  }

  // latest samples for the scope (oldest→newest)
  wave(out) {
    const n = out.length;
    const total = Math.min(this.ringN, 4096 - 1024);
    if (total < n) { out.fill(0); return; }
    const start = (this.ringN - n) % (4096 - 1024);
    for (let i = 0; i < n; i++) out[i] = this.ring[(start + i) % (4096 - 1024)];
  }
}