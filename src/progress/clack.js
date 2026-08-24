// clack.js — procedural keyboard-sound engine, ZERO asset files. One AudioContext and one
// shared SFX chain (master gain → limiter/compressor → destination); useMusicPlayer keeps
// its context private, so we lazily create our own. Per credited keystroke: a press sound
// plus a quieter release scheduled 40–90ms later. Three switchable PROFILES persisted to
// taw.clack. DEFAULT ON (profile 'thock'). The context is NOT created at mount — it's
// created/resumed lazily inside the first user gesture, which includes the first keydown
// (playClack). Never throws if audio is blocked. Web Audio buffers only, never
// HTMLAudioElement; playClack() never blocks the keydown handler.

const PROFILES = {
  thock: { lowpass: 1200, body: 100, press: 0.85 },
  clack: { lowpass: 2600, body: 165, press: 0.72 },
  cream: { lowpass: 1700, body: 128, press: 0.78 },
};
export const CLACK_PROFILES = Object.keys(PROFILES);
const CLACK_KEY = 'taw.clack';
const DEFAULT_PROFILE = 'thock';
// Pentatonic semitone ladder (offsets 0,2,4,7,9 then +12 and repeat), capped at +24.
const PENT = [0, 2, 4, 7, 9];
// Three subtle body-detune variants; we never play the same one twice in a row.
const VARIANTS = [0.98, 1.0, 1.02];

let ctx = null;
let sfxGain = null; // master (0.9) → compressor → destination
let noiseBuffer = null;
let lastVariant = -1;

// Persist BOTH enable + profile under taw.clack. Unset ⇒ ON with 'thock'.
function readState() {
  try {
    const raw = localStorage.getItem(CLACK_KEY);
    if (raw == null) return { enabled: true, profile: DEFAULT_PROFILE };
    const o = JSON.parse(raw);
    return {
      enabled: o && typeof o.enabled === 'boolean' ? o.enabled : true,
      profile: o && PROFILES[o.profile] ? o.profile : DEFAULT_PROFILE,
    };
  } catch {
    return { enabled: true, profile: DEFAULT_PROFILE };
  }
}
function writeState() {
  try {
    localStorage.setItem(CLACK_KEY, JSON.stringify({ enabled, profile }));
  } catch {
    /* storage blocked */
  }
}
let { enabled, profile } = readState();

// A short white-noise buffer with a cubic decay envelope (50ms). Built once per context.
function makeNoiseBuffer(context) {
  const len = Math.max(1, Math.floor(context.sampleRate * 0.05));
  const buf = context.createBuffer(1, len, context.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = (1 - i / len) ** 3;
    data[i] = (Math.random() * 2 - 1) * env;
  }
  return buf;
}

// Lazily build the context + SFX chain, then resume. MUST be called inside a user gesture
// (the settings toggle click, or the first keydown via playClack). Returns true if ready.
function ensureCtx() {
  if (ctx) {
    if (ctx.state === 'suspended') {
      try {
        ctx.resume();
      } catch {
        /* ignore */
      }
    }
    return true;
  }
  try {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    ctx = new AC();
    // Master gain 0.9 → limiter/soft-clip compressor → destination, so a 30/sec burst of
    // the louder presses can't clip.
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.1;
    sfxGain.connect(comp);
    comp.connect(ctx.destination);
    noiseBuffer = makeNoiseBuffer(ctx);
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  } catch {
    ctx = null;
    return false;
  }
}

// Called from the settings toggle click gesture.
export function enableClack(p) {
  if (p && PROFILES[p]) profile = p;
  enabled = true;
  writeState();
  ensureCtx();
  return !!ctx;
}
export function disableClack() {
  enabled = false;
  writeState();
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
  writeState();
}

// One press voice: a noise burst through a lowpass + a sine "body" with a 60ms exp decay.
function voice(when, cfg, rate, gainJitter, gainScale, bodyMul) {
  const g = cfg.press * gainJitter * gainScale;
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

// Play a press (+ scheduled release). `step` is the 0-based position within the current
// streak: the press pitch climbs the pentatonic ladder (capped at +24 semitones), reset to
// base when the caller resets the streak (step 0). Cheap + non-blocking; no-op if disabled.
export function playClack(step = 0) {
  if (!enabled) return;
  if (!ensureCtx()) return; // lazily creates the context inside the calling gesture
  const cfg = PROFILES[profile];
  const now = ctx.currentTime;

  // pentatonic pitch ladder for this streak position
  const s = Math.max(0, step | 0);
  const semitone = Math.min(24, 12 * Math.floor(s / PENT.length) + PENT[s % PENT.length]);
  const base = 2 ** (semitone / 12);

  // pick a body-detune variant, never the same twice in a row
  let vi;
  do {
    vi = Math.floor(Math.random() * VARIANTS.length);
  } while (vi === lastVariant);
  lastVariant = vi;
  const bodyMul = VARIANTS[vi];

  const rate = base * (1 + (Math.random() * 0.12 - 0.06)); // ±0.06 jitter on top of the ladder
  const gainJitter = 1 + (Math.random() * 0.24 - 0.12); // ±12%

  voice(now, cfg, rate, gainJitter, 1, bodyMul);
  const releaseDelay = 0.04 + Math.random() * 0.05; // 40..90ms
  voice(now + releaseDelay, cfg, rate, gainJitter, 0.45, bodyMul);
}
