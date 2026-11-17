// VoiceGuard console — wires sources, the five-signal engine and the UI.
"use strict";

import { VoiceAnalysis, SIGNAL_META } from "./analysis.js";
import { SourceManager } from "./sources.js";
import { spectrum } from "./dsp.js";
import { sfx, setSound } from "./audio.js";

const $ = (id) => document.getElementById(id);
const TUNE_KEY = "vg-tuning-v1";
const DEFAULT_TUNE = { sens: 1, interval: 300, grid: true, spectro: true, alerts: true, sound: true, monitor: true };
const COLORS = { REAL: "#3ddc84", SUSPECT: "#fbbf24", SYNTHETIC: "#ff4d5e", LISTENING: "#38bdf8" };
const ADVICE = {
  REAL: "Human voicing, breath floor and organic articulation all present. Nothing to flag.",
  SUSPECT: "Mixed signals — heavy processing, noise gating or a cautious synthetic voice. Listen closer before judging.",
  SYNTHETIC: "Machine-like evidence: digital-silence pauses, metronomic spectra or too-clean voicing. Verify through another channel.",
  LISTENING: "Gathering a few seconds of speech before committing to a verdict.",
};

let tune = { ...DEFAULT_TUNE };
let paused = false;
let lastResult = null;
let lastVerdict = "";
let lastAlert = 0;
let evals = 0;
let chunks = 0;
let events = [];
let evalTimer = null;
const bootTime = performance.now();

const va = new VoiceAnalysis();
const src = new SourceManager(onChunk, onStatus);

/* ── tuning persistence ── */
function saveTune() { try { chrome.storage?.local.set({ [TUNE_KEY]: tune }); } catch { localStorage.setItem(TUNE_KEY, JSON.stringify(tune)); } }
async function restoreTune() {
  try {
    const d = await chrome.storage?.local.get(TUNE_KEY);
    if (d && d[TUNE_KEY]) tune = { ...DEFAULT_TUNE, ...d[TUNE_KEY] };
  } catch {
    try { tune = { ...DEFAULT_TUNE, ...JSON.parse(localStorage.getItem(TUNE_KEY) || "{}") }; } catch {}
  }
}

function refreshTuneUI() {
  $("sensRange").value = tune.sens;
  $("sensVal").textContent = tune.sens.toFixed(2);
  $("intRange").value = tune.interval;
  $("intVal").textContent = `${tune.interval} ms`;
  $("gridTgl").checked = tune.grid;
  $("spectroTgl").checked = tune.spectro;
  $("alertTgl").checked = tune.alerts;
  $("soundBtn").classList.toggle("off", !tune.sound);
  $("monitorBtn").textContent = tune.monitor ? "MONITOR ON" : "MONITOR OFF";
  setSound(tune.sound);
}

/* ── toasts / log ── */
function toast(msg, cls = "", ms = 3200) {
  const el = document.createElement("div");
  el.className = `toast ${cls}`;
  el.textContent = msg;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function logEvent(verdict, text) {
  events.push({ t: new Date().toISOString(), verdict, text });
  if (events.length > 100) events.shift();
  renderLog();
}

function renderLog() {
  const filter = $("logFilter").value;
  const list = $("logList");
  list.innerHTML = "";
  const shown = events.filter((e) =>
    filter === "all" ? true : filter === "synthetic" ? e.verdict === "SYNTHETIC" : e.verdict === "REAL");
  for (const e of shown.slice(-60).reverse()) {
    const div = document.createElement("div");
    div.className = `log-item v-${e.verdict}`;
    const time = document.createElement("time");
    time.textContent = e.t.slice(11, 19);
    const b = document.createElement("b");
    b.textContent = e.verdict;
    div.append(time, b, document.createTextNode(` — ${e.text}`));
    list.appendChild(div);
  }
  $("logEmpty").hidden = shown.length > 0;
}

/* ── source status ── */
function onStatus(s) {
  const st = $("srcStatus");
  st.classList.remove("err");
  const gate = $("srcGate");
  switch (s) {
    case "demo":
      st.textContent = "demo reel running · subjects cycle every 16 s";
      gate.hidden = true;
      $("enginePill").textContent = "ENGINE · WORKLET";
      $("enginePill").classList.add("ok");
      break;
    case "demo-subject":
      va.reset();
      lastVerdict = "";
      $("subjChip").textContent = src.demoSubject;
      updateTruthChip();
      logEvent("LISTENING", `subject → ${src.demoSubject}`);
      sfx.switch();
      break;
    case "mic":
      st.textContent = "microphone live · processing disabled for honest noise";
      gate.hidden = true;
      $("subjChip").textContent = src.demoSubject;
      updateTruthChip();
      va.reset(); lastVerdict = "";
      break;
    case "tab":
      st.textContent = "shared tab audio live";
      gate.hidden = true;
      $("subjChip").textContent = src.demoSubject;
      updateTruthChip();
      va.reset(); lastVerdict = "";
      break;
    case "needs-gesture":
      $("gateMsg").textContent = "Browser audio needs one click to start.";
      $("gateBtn").textContent = "START AUDIO";
      gate.hidden = false;
      break;
    case "no-audio":
      st.textContent = "no audio track — tick “Also share tab audio”";
      st.classList.add("err");
      $("gateMsg").textContent = "That share had no audio. Pick the meeting TAB and tick “Also share tab audio”.";
      $("gateBtn").textContent = "TRY AGAIN";
      gate.hidden = false;
      sfx.error();
      break;
    case "share-ended":
      st.textContent = "share ended";
      $("gateMsg").textContent = "Screen/tab share ended. Share again or switch source.";
      $("gateBtn").textContent = "SHARE AGAIN";
      gate.hidden = false;
      logEvent("LISTENING", "share ended");
      break;
  }
}

function updateTruthChip() {
  const chip = $("truthChip");
  if (src.kind === "demo" && src.groundTruth) {
    chip.hidden = false;
    chip.textContent = `GROUND TRUTH: ${src.groundTruth}`;
  } else chip.hidden = true;
}

function onChunk(chunk) {
  chunks++;
  if (!paused) va.push(chunk);
}

/* ── source switching ── */
async function switchSource(kind) {
  $("deviceWrap").hidden = kind !== "mic";
  $("captureBtn").hidden = kind !== "tab";
  $("monitorBtn").hidden = kind !== "demo";
  $("srcChip").textContent = kind === "demo" ? "DEMO REEL" : kind === "mic" ? "MICROPHONE" : "TAB AUDIO";
  try {
    if (kind === "demo") await src.useDemo();
    else if (kind === "mic") {
      await listDevices();
      await src.useMic($("deviceSel").value || undefined);
    } else {
      src.stop();
      $("gateMsg").textContent = "Share the meeting tab — and tick “Also share tab audio”.";
      $("gateBtn").textContent = "SHARE TAB / SCREEN…";
      $("srcGate").hidden = false;
      $("srcStatus").textContent = "waiting for share…";
    }
  } catch (err) {
    $("srcStatus").textContent = `error: ${err.message || err.name}`;
    $("srcStatus").classList.add("err");
    toast(`Source failed: ${err.message || err.name}`, "err");
    sfx.error();
  }
}

async function listDevices() {
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
    const sel = $("deviceSel");
    const cur = sel.value;
    sel.innerHTML = "";
    devs.forEach((d, i) => {
      const o = document.createElement("option");
      o.value = d.deviceId;
      o.textContent = d.label || `Microphone ${i + 1}`;
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  } catch {}
}

/* ── evaluation loop (timer-based: keeps working in background tabs) ── */
function scheduleEval() {
  if (evalTimer) clearInterval(evalTimer);
  evalTimer = setInterval(evalOnce, tune.interval);
}

function evalOnce() {
  if (paused || src.kind === "none") return;
  evals++;
  const r = va.evaluate(tune.sens);
  lastResult = r;
  renderVerdict(r);
  renderSignals(r);
  renderStats(r);
  $("voicePill").textContent = `VOICE ${Math.round(r.stats.speechRatio * 100)}%`;
  $("replayPill").hidden = r.stats.replaySim < 0.985;

  if (r.mature && r.verdict !== lastVerdict) {
    logEvent(r.verdict, `${r.subtype} · score ${r.score}`);
    const prev = lastVerdict;
    lastVerdict = r.verdict;
    if (r.verdict === "SYNTHETIC" && tune.alerts && performance.now() - lastAlert > 5000) {
      lastAlert = performance.now();
      sfx.alert();
      const f = $("alertFlash");
      f.hidden = false;
      setTimeout(() => { f.hidden = true; }, 1600);
      toast(`SYNTHETIC voice flagged — ${r.subtype}`, "err");
    } else if (r.verdict === "REAL" && prev === "SYNTHETIC") {
      sfx.ok();
    }
  }
}

/* ── UI rendering ── */
function renderVerdict(r) {
  $("verdictBanner").dataset.v = r.verdict;
  $("verdictWord").textContent = r.verdict;
  $("verdictSub").textContent = r.subtype;
  $("verdictAdvice").textContent = ADVICE[r.verdict];
  $("dialScore").textContent = r.mature ? r.score : "–";
  const arc = $("dialArc");
  arc.style.strokeDashoffset = 314 * (1 - (r.mature ? r.score : 0) / 100);
  arc.style.stroke = COLORS[r.verdict];
}

const sigEls = {};
function buildSignalList() {
  const list = $("sigList");
  for (const key in SIGNAL_META) {
    const row = document.createElement("div");
    row.className = "sig-row";
    const small = document.createElement("small");
    const name = document.createElement("span");
    name.textContent = SIGNAL_META[key].label.toUpperCase();
    const val = document.createElement("b");
    val.textContent = "–";
    small.append(name, val);
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = SIGNAL_META[key].hint;
    const meter = document.createElement("div");
    meter.className = "meter";
    const fill = document.createElement("div");
    fill.className = "meter-fill";
    meter.appendChild(fill);
    row.append(small, hint, meter);
    list.appendChild(row);
    sigEls[key] = { val, fill };
  }
}

function renderSignals(r) {
  for (const key in sigEls) {
    const v = r.signals[key];
    sigEls[key].val.textContent = `${Math.round(v * 100)}%`;
    sigEls[key].fill.style.width = `${v * 100}%`;
    sigEls[key].fill.className = `meter-fill ${v >= 0.6 ? "hi" : v < 0.25 ? "lo" : ""}`;
  }
}

function renderStats(r) {
  const s = r.stats;
  $("stF0").textContent = s.f0Mean ? `${s.f0Mean.toFixed(0)} Hz` : "–";
  $("stCV").textContent = s.f0CV ? s.f0CV.toFixed(3) : "–";
  $("stFloor").textContent = s.floorRatio ? s.floorRatio.toFixed(3) : "0.000";
  $("stFlux").textContent = s.fluxCV ? s.fluxCV.toFixed(2) : "–";
  $("stCent").textContent = s.centroidCV ? s.centroidCV.toFixed(2) : "–";
  $("stClar").textContent = s.clarityMean ? s.clarityMean.toFixed(2) : "–";
  $("stFlat").textContent = s.flatMed ? s.flatMed.toFixed(3) : "–";
  $("stReplay").textContent = s.replaySim ? s.replaySim.toFixed(2) : "–";
}

/* ── drawing ── */
const scopeC = $("scopeCanvas"), scopeX = scopeC.getContext("2d");
const specC = $("spectroCanvas"), specX = specC.getContext("2d");
const waveBuf = new Float32Array(2048);
specX.fillStyle = "#0a0805";
specX.fillRect(0, 0, specC.width, specC.height);

function heatColor(v) {
  // black → deep orange → amber → cream
  const t = Math.max(0, Math.min(1, v));
  if (t < 0.35) return `rgb(${Math.round(t / 0.35 * 140)},${Math.round(t / 0.35 * 45)},8)`;
  if (t < 0.7) { const u = (t - 0.35) / 0.35; return `rgb(${140 + Math.round(u * 105)},${45 + Math.round(u * 121)},${8 + Math.round(u * 27)})`; }
  const u = (t - 0.7) / 0.3;
  return `rgb(245,${166 + Math.round(u * 68)},${35 + Math.round(u * 181)})`;
}

function draw() {
  requestAnimationFrame(draw);
  const W = scopeC.width, H = scopeC.height;
  const color = COLORS[lastResult?.verdict || "LISTENING"];

  // level strip
  $("levelFill").style.height = `${Math.min(100, src.level * 420)}%`;

  // clock
  const el = Math.floor((performance.now() - bootTime) / 1000);
  $("clockChip").textContent = `${String(Math.floor(el / 60)).padStart(2, "0")}:${String(el % 60).padStart(2, "0")}`;

  if (paused) return;

  // oscilloscope
  src.wave(waveBuf);
  scopeX.fillStyle = "#0a0805";
  scopeX.fillRect(0, 0, W, H);
  if (tune.grid) {
    scopeX.strokeStyle = "rgba(51,41,26,0.5)";
    scopeX.lineWidth = 1;
    scopeX.beginPath();
    for (let x = 0; x < W; x += 60) { scopeX.moveTo(x, 0); scopeX.lineTo(x, H); }
    for (let y = 0; y < H; y += 30) { scopeX.moveTo(0, y); scopeX.lineTo(W, y); }
    scopeX.stroke();
    scopeX.strokeStyle = "rgba(111,99,73,0.6)";
    scopeX.beginPath(); scopeX.moveTo(0, H / 2); scopeX.lineTo(W, H / 2); scopeX.stroke();
  }
  scopeX.strokeStyle = color;
  scopeX.lineWidth = 1.6;
  scopeX.shadowColor = color;
  scopeX.shadowBlur = 6;
  scopeX.beginPath();
  const n = waveBuf.length;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * W;
    const y = H / 2 - waveBuf[i] * H * 0.46;
    i ? scopeX.lineTo(x, y) : scopeX.moveTo(x, y);
  }
  scopeX.stroke();
  scopeX.shadowBlur = 0;

  // spectrogram: scroll left 2px, paint a fresh column from the latest window
  if (tune.spectro) {
    const SW = specC.width, SH = specC.height;
    specX.drawImage(specC, -2, 0);
    specX.fillStyle = "#0a0805";
    specX.fillRect(SW - 2, 0, 2, SH);
    if (src.level > 0.001) {
      const mag = spectrum(waveBuf, 0);
      const bins = mag.length;
      for (let y = 0; y < SH; y++) {
        // log-frequency mapping: bottom 60 Hz → top 8 kHz
        const f = 60 * Math.pow(8000 / 60, 1 - y / SH);
        const bin = Math.min(bins - 1, Math.round(f / (16000 / 2048)));
        const v = Math.log10(1 + mag[bin] * 60) / 2.2;
        specX.fillStyle = heatColor(v);
        specX.fillRect(SW - 2, y, 2, 1);
      }
    }
  }
}

/* ── pause ── */
function setPaused(p) {
  paused = p;
  $("pauseVeil").hidden = !p;
  $("pauseBtn").textContent = p ? "▶" : "⏸";
  $("pauseBtn").classList.toggle("active", p);
  if (src.ctx) { p ? src.ctx.suspend() : src.ctx.resume().catch(() => {}); }
  sfx.ui();
}

/* ── report ── */
function exportReport() {
  const r = lastResult;
  const report = {
    tool: "VoiceGuard 1.0.0",
    generated: new Date().toISOString(),
    source: src.kind,
    subject: src.demoSubject,
    groundTruth: src.groundTruth || null,
    verdict: r ? { score: r.score, verdict: r.verdict, subtype: r.subtype } : null,
    signals: r?.signals ?? null,
    stats: r?.stats ?? null,
    tuning: tune,
    events,
    method: "Five-signal heuristic liveness triage (pitch, breath floor, spectral churn, spectral balance, voicing imperfection). NOT forensic evidence.",
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `voiceguard-report-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Report downloaded", "ok");
  sfx.ok();
}

/* ── wiring ── */
function wire() {
  $("sourceSel").addEventListener("change", (e) => { sfx.ui(); switchSource(e.target.value); });
  $("deviceSel").addEventListener("change", () => switchSource("mic"));
  $("captureBtn").addEventListener("click", async () => {
    try { await src.useTab(); } catch (err) {
      $("srcStatus").textContent = "share cancelled";
      toast("Share cancelled", "warn");
    }
  });
  $("gateBtn").addEventListener("click", () => {
    const k = $("sourceSel").value;
    if (k === "tab") $("captureBtn").click();
    else switchSource(k);
  });
  $("monitorBtn").addEventListener("click", () => {
    tune.monitor = !tune.monitor;
    src.setMonitor(tune.monitor);
    refreshTuneUI(); saveTune(); sfx.ui();
  });
  $("soundBtn").addEventListener("click", () => { tune.sound = !tune.sound; refreshTuneUI(); saveTune(); });
  $("pauseBtn").addEventListener("click", () => setPaused(!paused));
  $("helpBtn").addEventListener("click", () => { $("helpModal").hidden = false; sfx.ui(); });
  $("helpClose").addEventListener("click", () => { $("helpModal").hidden = true; });
  $("helpModal").addEventListener("click", (e) => { if (e.target === $("helpModal")) $("helpModal").hidden = true; });
  $("reportBtn").addEventListener("click", exportReport);
  $("logFilter").addEventListener("change", renderLog);
  $("clearLogBtn").addEventListener("click", () => { events = []; renderLog(); sfx.ui(); });

  $("sensRange").addEventListener("input", (e) => {
    tune.sens = +e.target.value;
    $("sensVal").textContent = tune.sens.toFixed(2);
    va.dispScore = null; // snap: re-score instantly at the new sensitivity
    saveTune();
    if (!paused) evalOnce();
  });
  $("intRange").addEventListener("input", (e) => {
    tune.interval = +e.target.value;
    $("intVal").textContent = `${tune.interval} ms`;
    scheduleEval(); saveTune();
  });
  $("gridTgl").addEventListener("change", (e) => { tune.grid = e.target.checked; saveTune(); });
  $("spectroTgl").addEventListener("change", (e) => { tune.spectro = e.target.checked; saveTune(); });
  $("alertTgl").addEventListener("change", (e) => { tune.alerts = e.target.checked; saveTune(); });
  $("resetTuneBtn").addEventListener("click", () => {
    tune = { ...DEFAULT_TUNE };
    refreshTuneUI(); scheduleEval(); saveTune();
    src.setMonitor(tune.monitor);
    va.dispScore = null;
    toast("Tuning reset", "ok");
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.code === "Space") { e.preventDefault(); setPaused(!paused); }
    else if (e.key === "m" || e.key === "M") $("monitorBtn").click();
    else if (e.key === "s" || e.key === "S") $("soundBtn").click();
    else if (e.key === "?") $("helpModal").hidden = !$("helpModal").hidden;
    else if (e.key === "Escape") $("helpModal").hidden = true;
  });

  // any first click resumes a suspended context (autoplay policy)
  document.addEventListener("click", () => {
    if (src.ctx && src.ctx.state === "suspended" && !paused) src.ctx.resume().catch(() => {});
  }, { capture: true });
}

/* ── boot ── */
(async function boot() {
  await restoreTune();
  refreshTuneUI();
  buildSignalList();
  wire();
  renderLog();
  requestAnimationFrame(draw);
  scheduleEval();
  await switchSource("demo");
})();

// debug/test hook
window.__vg = {
  get result() { return lastResult; },
  get chunks() { return chunks; },
  get evals() { return evals; },
  get events() { return events; },
  get tune() { return tune; },
  src, va,
};