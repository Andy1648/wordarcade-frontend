// src/juice/audio.js
// Synthesized WebAudio cues for the juice layer - NO audio files. A single
// AudioContext is created lazily on the first call (inside a user gesture, so
// it's autoplay-safe) and every cue routes through a shared compressor/limiter
// so stacked effects can't clip. Each cue is wrapped so a missing/erroring
// audio stack never throws. Respects the global sound flag (mute).

import { soundAllowed } from './settings';
import { JUICE } from './config';

let ctx = null;

// Lazily create / resume the shared context. Returns null where Web Audio is
// unavailable so callers simply stay silent.
function getCtx() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

// One shared limiter per context (stored on the context so it's rebuilt with it).
function getMaster(c) {
  if (c.__juiceMaster) return c.__juiceMaster;
  try {
    const comp = c.createDynamicsCompressor();
    const now = c.currentTime;
    comp.threshold.setValueAtTime(-4, now);
    comp.knee.setValueAtTime(4, now);
    comp.ratio.setValueAtTime(10, now);
    comp.attack.setValueAtTime(0.003, now);
    comp.release.setValueAtTime(0.12, now);
    comp.connect(c.destination);
    c.__juiceMaster = comp;
    return comp;
  } catch {
    return c.destination;
  }
}

// --- synthesis helpers -----------------------------------------------------
// One enveloped oscillator tone (10ms attack, exp decay to silence by `dur`).
function tone(c, { freq, type, start, dur, peak, dest }) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(dest || getMaster(c));
  o.start(start);
  o.stop(start + dur + 0.02);
}

// A filtered white-noise burst with exponential decay.
function noise(c, { start, dur, peak, filter, dest }) {
  const frames = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(peak, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  // src -> [filter] -> g(envelope) -> out. The gain MUST be the last node before
  // the destination or its decay envelope is bypassed.
  if (filter) src.connect(filter).connect(g);
  else src.connect(g);
  g.connect(dest || getMaster(c));
  src.start(start);
  src.stop(start + dur + 0.01);
}

// --- cues ------------------------------------------------------------------
const CUES = {
  // Short high blip, pitch randomized each press so rapid taps don't sound robotic.
  tap(c, now) {
    tone(c, { freq: 760 + Math.random() * 260, type: 'triangle', start: now, dur: 0.05, peak: 0.16 });
  },

  // Barely-there hover blip - lighter and quieter than tap.
  hover(c, now) {
    tone(c, { freq: 640 + Math.random() * 80, type: 'sine', start: now, dur: 0.03, peak: 0.05 });
  },

  // Accepted: a pleasant two-tone rising chime (a musical fifth).
  accept(c, now) {
    tone(c, { freq: 880, type: 'sine', start: now, dur: 0.08, peak: 0.22 });
    tone(c, { freq: 1320, type: 'sine', start: now + 0.1, dur: 0.12, peak: 0.22 });
  },

  // Rejected: a short low square-wave buzz with a brief sustain.
  reject(c, now) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(150, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.2, now + 0.01);
    g.gain.setValueAtTime(0.2, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o.connect(g).connect(getMaster(c));
    o.start(now);
    o.stop(now + 0.18);
  },

  // Sharp metallic shing: quick attack, slight high ring, fast decay. A bright
  // sine ring layered with a highpassed noise transient.
  slash(c, now) {
    const dest = getMaster(c);
    const ring = c.createOscillator();
    const rg = c.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(3200, now);
    ring.frequency.exponentialRampToValueAtTime(2300, now + 0.12); // slight downward ring
    rg.gain.setValueAtTime(0.0001, now);
    rg.gain.linearRampToValueAtTime(0.18, now + 0.004); // sharp attack
    rg.gain.exponentialRampToValueAtTime(0.0001, now + 0.14); // fast decay
    ring.connect(rg).connect(dest);
    ring.start(now);
    ring.stop(now + 0.16);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2500, now);
    noise(c, { start: now, dur: 0.08, peak: 0.22, filter: hp, dest });
  },

  // Low whoosh: bandpassed noise sweeping its center downward.
  open(c, now) {
    const dur = 0.34;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(0.8, now);
    bp.frequency.setValueAtTime(700, now);
    bp.frequency.exponentialRampToValueAtTime(180, now + dur); // sweep down = low whoosh
    const dest = getMaster(c);
    const frames = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.06); // swell in
    g.gain.linearRampToValueAtTime(0.0001, now + dur);
    src.connect(bp).connect(g).connect(dest);
    src.start(now);
    src.stop(now + dur + 0.01);
  },

  // KO: a heavy low sine boom bending down, with a noise crack layered in.
  ko(c, now) {
    const dest = getMaster(c);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, now);
    o.frequency.exponentialRampToValueAtTime(42, now + 0.4); // boom bends down
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.4, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    o.connect(g).connect(dest);
    o.start(now);
    o.stop(now + 0.47);
    noise(c, { start: now, dur: 0.18, peak: 0.4, dest }); // crack
  },

  // Win: an ascending C-E-G major arpeggio on clean sines.
  win(c, now) {
    tone(c, { freq: 523.25, type: 'sine', start: now, dur: 0.14, peak: 0.24 });
    tone(c, { freq: 659.25, type: 'sine', start: now + 0.14, dur: 0.14, peak: 0.24 });
    tone(c, { freq: 783.99, type: 'sine', start: now + 0.28, dur: 0.3, peak: 0.24 });
  },
};

// sfx(name): play a named cue. No-op when muted, when Web Audio is unavailable,
// or when the name is unknown. Lazily unlocks the context on first call.
export function sfx(name) {
  if (!soundAllowed()) return;
  const c = getCtx();
  if (!c) return;
  const cue = CUES[name];
  if (!cue) return;
  try {
    cue(c, c.currentTime);
  } catch {
    /* never let audio throw */
  }
}

// validCue(combo): the Word Bomb accept sound — a short rising triangle whose
// base pitch climbs with the combo so longer streaks read as higher-stakes.
// Pitch jittered a touch so repeats don't fatigue. Replaces the flat accept
// ding for Word Bomb (single sound per accept; honors the global mute).
export function validCue(combo = 0) {
  if (!soundAllowed()) return;
  const c = getCtx();
  if (!c) return;
  try {
    const now = c.currentTime;
    const base =
      (JUICE.VALID.cuePitchBase + combo * JUICE.VALID.cuePitchPerCombo) *
      (0.98 + Math.random() * 0.04);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(base, now);
    o.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.12); // rising
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.2, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o.connect(g).connect(getMaster(c));
    o.start(now);
    o.stop(now + 0.18);
  } catch {
    /* never let audio throw */
  }
}

// Shared-context accessors for the tension layer (rumble/siren) so it builds its
// continuous voices on the ONE AudioContext + the ONE master limiter — never a
// second context. Return null when Web Audio is unavailable. The tension layer
// owns its own mute check (soundAllowed) since it runs persistent nodes.
export function getJuiceCtx() {
  return getCtx();
}
export function getJuiceMaster() {
  const c = getCtx();
  return c ? getMaster(c) : null;
}

// Create/resume the context inside a known user gesture (call from a real
// click/keydown) so later cues are allowed to sound. Safe to call repeatedly.
export function unlockAudio() {
  getCtx();
}
