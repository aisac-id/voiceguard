// VoiceGuard PCM tap — runs on the audio rendering thread, so capture keeps
// flowing at full rate even when the tab is in the background.
// Accumulates 1024-sample chunks and posts them to the main thread.
class VGTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(1024);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      let i = 0;
      while (i < ch.length) {
        const take = Math.min(1024 - this.n, ch.length - i);
        this.buf.set(ch.subarray(i, i + take), this.n);
        this.n += take;
        i += take;
        if (this.n === 1024) {
          this.port.postMessage(this.buf.slice(0));
          this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("vg-tap", VGTap);