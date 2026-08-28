// clack.js — procedural keyboard-sound engine (Job 11 refresh). Now routes through the SHARED
// audioCore master chain (masterGain → compressor → destination) so the master-volume slider and
// the voice cap cover keystrokes too. Per credited keystroke: a press voice + a quieter release
// 40–90ms later. The equipped SOUND PACK (shop) picks the timbre; profiles differ mainly by lowpass
// cutoff + body balance.
//
// FATIGUE FIXES (Job 11 §2): a 7-variant ROUND-ROBIN on the lowpass cutoff (±12%), cycled with a
// no-immediate-repeat rule and an ODD count so it never lines up with typing rhythm — timbre
// variation is what actually kills the machine-gun feel. The existing pitch (0.94–1.06) and gain
// (±12%) jitter are kept EXACTLY (already tasteful — not widened). DEFAULT OFF (school-lab audience).
import { getEquippedSoundPack } from './shop.js';
import { ensureCtx, audioCtx, masterNode, registerVoice } from '../audio/audioCore.js';

// Sound params keyed by the equipped SOUND PACK. `silent` is null — plays nothing (its shop
// multiplier still applies via the xp stack). thock = warm/low; clack = bright; cream = smooth.
const PARAMS = {
  thock: { lowpass: 1800, body: 150, press: 0.28 },      // strong body, low cutoff
  clack: { lowpass: 4200, body: 165, press: 0.24 },      // bright, weaker body
  cream: { lowpass: 2200, body: 140, press: 0.24, smooth: true }, // mid cutoff, smoother/longer noise
  marble: { lowpass: 3000, body: 150, press: 0.25 },
  typewriter: { lowpass: 4600, body: 220, press: 0.24 },
  silent: null,
};
const CLACK_KEY = 'taw.clack';
const PENT = [0, 3, 5, 7, 10]; // C minor pentatonic semitone ladder (shared key with the events)
// SEVEN cutoff variants (odd count; ±~12%), cycled no-immediate-repeat — the anti-fatigue lever.
const CUTOFF_VARIANTS = [0.88, 0.93, 0.97, 1.0, 1.04, 1.08, 1.12];

let noiseBuffer = null;
let smoothNoiseBuffer = null;
let lastVariant = -1;

// Persist only the on/off flag under taw.clack. DEFAULT OFF now (spec §5) — unset ⇒ OFF.
function readEnabled() {
  try {
    const raw = localStorage.getItem(CLACK_KEY);
    if (raw == null) return false;
    const o = JSON.parse(raw);
    return o && typeof o.enabled === 'boolean' ? o.enabled : false;
  } catch {
    return false;
  }
}
function writeState() {
  try {
    localStorage.setItem(CLACK_KEY, JSON.stringify({ enabled }));
  } catch {
    /* storage blocked */
  }
}
let enabled = readEnabled();

// A short white-noise buffer with a decay envelope. `smooth` (cream) uses a longer, gentler curve.
function makeNoiseBuffer(context, smooth) {
  const secs = smooth ? 0.075 : 0.05;
  const len = Math.max(1, Math.floor(context.sampleRate * secs));
  const buf = context.createBuffer(1, len, context.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = smooth ? (1 - i / len) ** 1.6 : (1 - i / len) ** 3;
    data[i] = (Math.random() * 2 - 1) * env;
  }
  return buf;
}
function buffers(ctx) {
  if (!noiseBuffer) noiseBuffer = makeNoiseBuffer(ctx, false);
  if (!smoothNoiseBuffer) smoothNoiseBuffer = makeNoiseBuffer(ctx, true);
}

export function enableClack() {
  enabled = true;
  writeState();
  ensureCtx();
  return !!audioCtx();
}
export function disableClack() {
  enabled = false;
  writeState();
}
export function isClackEnabled() {
  return enabled;
}

// One press voice: a noise burst through a (round-robin-varied) lowpass + a sine "body". Connects to
// the shared master node; registered with the voice cap.
function voice(ctx, when, cfg, rate, gainJitter, gainScale, cutoffMul) {
  const master = masterNode();
  if (!master) return;
  const g = cfg.press * gainJitter * gainScale;
  const src = ctx.createBufferSource();
  src.buffer = cfg.smooth ? smoothNoiseBuffer : noiseBuffer;
  src.playbackRate.value = rate;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cfg.lowpass * cutoffMul; // the anti-fatigue timbre variation
  const ng = ctx.createGain();
  ng.gain.value = g;
  src.connect(lp);
  lp.connect(ng);
  ng.connect(master);
  src.start(when);
  src.stop(when + 0.06);
  registerVoice({ src, gain: ng, stopAt: when + 0.06 });

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = cfg.body * rate;
  const og = ctx.createGain();
  og.gain.setValueAtTime(Math.max(0.0001, g * 0.9), when);
  og.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
  osc.connect(og);
  og.connect(master);
  osc.start(when);
  osc.stop(when + 0.07);
  registerVoice({ osc, gain: og, stopAt: when + 0.07 });
}

// Play a press (+ scheduled release). `step` climbs the pentatonic ladder for the current streak
// position (capped +24 semitones). Non-blocking; no-op if disabled. NEVER blocks the keydown handler.
export function playClack(step = 0) {
  if (!enabled) return;
  const cfg = PARAMS[getEquippedSoundPack()];
  if (!cfg) return; // 'silent' pack — plays nothing; multiplier still applies
  if (!ensureCtx()) return;
  const ctx = audioCtx();
  if (!ctx) return;
  buffers(ctx);
  const now = ctx.currentTime;

  const s = Math.max(0, step | 0);
  const semitone = Math.min(24, 12 * Math.floor(s / PENT.length) + PENT[s % PENT.length]);
  const base = 2 ** (semitone / 12);

  // round-robin cutoff variant, never the same twice in a row
  let vi;
  do {
    vi = Math.floor(Math.random() * CUTOFF_VARIANTS.length);
  } while (vi === lastVariant);
  lastVariant = vi;
  const cutoffMul = CUTOFF_VARIANTS[vi];

  const rate = base * (1 + (Math.random() * 0.12 - 0.06)); // ±0.06 (0.94–1.06) — unchanged
  const gainJitter = 1 + (Math.random() * 0.24 - 0.12); // ±12% — unchanged

  voice(ctx, now, cfg, rate, gainJitter, 1, cutoffMul);
  const releaseDelay = 0.04 + Math.random() * 0.05; // 40..90ms
  voice(ctx, now + releaseDelay, cfg, rate, gainJitter, 0.45, cutoffMul);
}
