// audioCore.js — the shared procedural audio engine (Job 11). ZERO asset files. One AudioContext,
// one master chain (masterGain → compressor → destination), shared by BOTH the keystroke clack and
// the event sounds so overlaps route through one limiter (a safety net, not a mixer). Everything is
// C MINOR PENTATONIC (C, Eb, F, G, Bb) — up = good, down = bad, higher = more — so overlapping
// sounds can never form a dissonant chord.
//
// Rules honored: new oscillator+gain per voice (never reuse — reuse causes audible pitch slides),
// start/stop then let GC reclaim; a 14-voice cap culling the oldest; per-voice gain kept low so the
// compressor rarely engages; everything scheduled against ctx.currentTime; NOTHING created before a
// user gesture; ctx.state re-checked on visibilitychange (iOS re-suspends). Never throws.

const VOLUME_KEY = 'taw.audioVolume';
const VOICE_CAP = 14; // concurrent-voice ceiling (spec: 12–16); cull oldest beyond this
const DEFAULT_VOLUME = 0.7;

// C minor pentatonic, ascending across octaves. Index 0 = C3; climbs C,Eb,F,G,Bb then next octave.
const PENT_SEMITONES = [0, 3, 5, 7, 10]; // C, Eb, F, G, Bb relative to C
const C3 = 130.8128; // root
export function pentFreq(degree) {
  const d = Math.max(0, Math.floor(degree));
  const octave = Math.floor(d / PENT_SEMITONES.length);
  const semi = PENT_SEMITONES[d % PENT_SEMITONES.length] + 12 * octave;
  return C3 * Math.pow(2, semi / 12);
}
// Named degrees for readability (degree indices into the ascending pentatonic from C3).
export const NOTE = {
  C3: 0, Eb3: 1, F3: 2, G3: 3, Bb3: 4,
  C4: 5, Eb4: 6, F4: 7, G4: 8, Bb4: 9,
  C5: 10, Eb5: 11, F5: 12, G5: 13, Bb5: 14,
  C6: 15,
};

let ctx = null;
let masterGain = null; // master (× volume) → compressor → destination
let volume = readVolume();
const liveVoices = []; // { osc?, src?, gain, stopAt } — for the voice cap

function readVolume() {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw == null) return DEFAULT_VOLUME;
    const v = Number(raw);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function getMasterVolume() {
  return volume;
}
export function setMasterVolume(v) {
  volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_VOLUME;
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    /* storage blocked */
  }
  if (masterGain && ctx) {
    try {
      masterGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
    } catch {
      /* ignore */
    }
  }
}

// Lazily build the context + master chain, then resume. MUST be called inside a user gesture the
// first time. Returns true if ready. Never throws.
export function ensureCtx() {
  if (ctx) {
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch { /* ignore */ }
    }
    return true;
  }
  try {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    ctx = new AC(); // latencyHint stays default ('interactive')
    masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.12;
    masterGain.connect(comp);
    comp.connect(ctx.destination);
    if (ctx.state === 'suspended') ctx.resume();
    // iOS re-suspends the context when the tab is backgrounded; re-check on return.
    if (typeof document !== 'undefined' && !audioCoreVisibilityBound) {
      audioCoreVisibilityBound = true;
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && ctx && ctx.state === 'suspended') {
          try { ctx.resume(); } catch { /* ignore */ }
        }
      });
    }
    return true;
  } catch {
    ctx = null;
    return false;
  }
}
let audioCoreVisibilityBound = false;

// Accessors for modules that build their own voices (clack) but share the master + ctx.
export function audioCtx() {
  return ctx;
}
export function masterNode() {
  return masterGain;
}

// Register a voice for the concurrency cap. Called by voice builders after start(). Culls the
// oldest live voice when the cap is exceeded (a quick fade to avoid a click).
let voicePeak = 0; // diagnostic: max concurrent live voices observed (for the Job-11 report)
export function voiceStats() {
  return { live: liveVoices.length, peak: voicePeak, cap: VOICE_CAP };
}
export function registerVoice(v) {
  liveVoices.push(v);
  // Drop references to voices that have already stopped.
  const now = ctx ? ctx.currentTime : 0;
  for (let i = liveVoices.length - 1; i >= 0; i--) {
    if (liveVoices[i].stopAt <= now) liveVoices.splice(i, 1);
  }
  if (liveVoices.length > voicePeak) voicePeak = liveVoices.length;
  while (liveVoices.length > VOICE_CAP) {
    const old = liveVoices.shift();
    try {
      if (old.gain && ctx) {
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setTargetAtTime(0.0001, now, 0.01);
      }
    } catch { /* ignore */ }
  }
}

// A single tone voice: a fresh oscillator + gain, exponential decay to silence. `opts`:
//   freq, type ('sine'|'triangle'|'sawtooth'|'square'), dur (s), gain (0.1–0.3), attack (s),
//   glideTo (Hz, optional pitch glide), lowpass (Hz, optional). Non-blocking; no-op if no ctx.
export function tone(when, { freq, type = 'sine', dur = 0.12, gain = 0.2, attack = 0.005, glideTo = null, lowpass = null } = {}) {
  if (!ctx || !masterGain) return;
  const t = Math.max(when, ctx.currentTime);
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo && glideTo > 0) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  const g = ctx.createGain();
  const peak = Math.max(0.0001, gain);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let tail = g;
  if (lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lowpass;
    osc.connect(g);
    g.connect(lp);
    lp.connect(masterGain);
    tail = g;
  } else {
    osc.connect(g);
    g.connect(masterGain);
  }
  osc.start(t);
  osc.stop(t + dur + 0.02);
  registerVoice({ osc, gain: g, stopAt: t + dur + 0.02 });
}

// Test/dev reset hook.
export function __resetAudioForTest() {
  ctx = null;
  masterGain = null;
  liveVoices.length = 0;
  volume = readVolume();
}

