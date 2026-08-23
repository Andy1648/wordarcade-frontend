// clack.js — procedural keyboard-sound engine, ZERO asset files. One AudioContext and one
// shared SFX GainNode (useMusicPlayer keeps its context private, so we lazily create our
// own). Per credited keystroke: a press sound plus a quieter release scheduled 40–90ms
// later. Three switchable PROFILES persisted to taw.clack. Default OFF — the context is
// created/resumed inside the enabling click gesture (autoplay-policy safe). Web Audio
// buffers only, never HTMLAudioElement; playClack() never blocks the keydown handler.

const PROFILES = {
  thock: { lowpass: 1200, body: 100, press: 0.5 },
  clack: { lowpass: 2600, body: 165, press: 0.42 },
  cream: { lowpass: 1700, body: 128, press: 0.46 },
};
export const CLACK_PROFILES = Object.keys(PROFILES);
const PROFILE_KEY = 'taw.clack';
const DEFAULT_PROFILE = 'thock';
// Three subtle body-detune variants; we never play the same one twice in a row.
const VARIANTS = [0.98, 1.0, 1.02];

let ctx = null;
let sfxGain = null;
let noiseBuffer = null;
let enabled = false;
let profile = DEFAULT_PROFILE;
let lastVariant = -1;

function readProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw && PROFILES[raw]) return raw;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_PROFILE;
}
function writeProfile(p) {
  try {
    localStorage.setItem(PROFILE_KEY, p);
  } catch {
    /* storage blocked */
  }
}
profile = readProfile();

// A short white-noise buffer with a cubic decay envelope (50ms). Built once per context.
function makeNoiseBuffer(context) {
  const len = Math.max(1, Math.floor(context.sampleRate * 0.05));
  const buf = context.createBuffer(1, len, context.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = (1 - i / len) ** 3; // cubic decay
    data[i] = (Math.random() * 2 - 1) * env;
  }
  return buf;
}

// MUST be called inside a user-gesture click (the settings toggle). Creates the context on
// first use and resumes it. Returns true if audio is ready.
export function enableClack(p) {
  if (p && PROFILES[p]) profile = p;
  if (!ctx) {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    ctx = new AC();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 1;
    sfxGain.connect(ctx.destination);
    noiseBuffer = makeNoiseBuffer(ctx);
  }
  if (ctx.state === 'suspended') ctx.resume();
  enabled = true;
  return true;
}

export function disableClack() {
  enabled = false;
}
export function isClackEnabled() {
  return enabled;
}
export function getClackProfile() {
  return profile;
}
export function setClackProfile(p) {
  if (!PROFILES[p]) return;
  profile = p;
  writeProfile(p);
}

// One press voice: a noise burst through a lowpass + a sine "body" with a 60ms exp decay.
function voice(when, cfg, rate, gainJitter, gainScale, bodyMul) {
  const g = cfg.press * gainJitter * gainScale;
  // noise burst → lowpass
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.playbackRate.value = rate;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cfg.lowpass;
  const ng = ctx.createGain();
  ng.gain.value = g;
  src.connect(lp);
  lp.connect(ng);
  ng.connect(sfxGain);
  src.start(when);
  src.stop(when + 0.06);
  // sine body, 60ms exponential decay
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = cfg.body * rate * bodyMul;
  const og = ctx.createGain();
  og.gain.setValueAtTime(Math.max(0.0001, g * 0.9), when);
  og.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
  osc.connect(og);
  og.connect(sfxGain);
  osc.start(when);
  osc.stop(when + 0.07);
}

// Play a press (+ scheduled release). Cheap and non-blocking; a no-op when disabled.
export function playClack() {
  if (!enabled || !ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const cfg = PROFILES[profile];
  const now = ctx.currentTime;

  // pick a body-detune variant, never the same twice in a row
  let vi;
  do {
    vi = Math.floor(Math.random() * VARIANTS.length);
  } while (vi === lastVariant);
  lastVariant = vi;
  const bodyMul = VARIANTS[vi];

  const rate = 0.94 + Math.random() * 0.12; // 0.94..1.06
  const gainJitter = 1 + (Math.random() * 0.24 - 0.12); // ±12%

  voice(now, cfg, rate, gainJitter, 1, bodyMul);
  const releaseDelay = 0.04 + Math.random() * 0.05; // 40..90ms
  voice(now + releaseDelay, cfg, rate, gainJitter, 0.45, bodyMul);
}
