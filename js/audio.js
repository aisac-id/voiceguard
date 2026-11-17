// VoiceGuard console sounds — tiny WebAudio blips, no assets.
"use strict";

let ctx = null;
let enabled = true;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function blip(freq, dur, type = "sine", gain = 0.08, when = 0, slide = 0) {
  if (!enabled) return;
  try {
    const c = ac();
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* audio unavailable */ }
}

export const sfx = {
  ui:     () => blip(1150, 0.05, "square", 0.035),
  ok:     () => { blip(660, 0.09, "sine", 0.07); blip(990, 0.12, "sine", 0.06, 0.07); },
  alert:  () => { blip(880, 0.14, "sawtooth", 0.06, 0, -420); blip(460, 0.2, "sawtooth", 0.06, 0.13, -180); },
  switch: () => blip(520, 0.07, "triangle", 0.06, 0, 260),
  error:  () => blip(220, 0.22, "square", 0.05, 0, -80),
};

export function setSound(on) { enabled = on; }
export function soundOn() { return enabled; }