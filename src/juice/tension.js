// src/juice/tension.js
// JUICE 02 — the Word Bomb tension SKIN, AUDIO ONLY.
//
// The VISUALS (edge colour grade, speed lines, HURRY!/GET OUT! prompt, final
// throb) used to be drawn every frame onto the shared juice canvas via
// setOverlay(). That was a full-viewport repaint loop for the ENTIRE turn
// (clearRect + radial-gradient fillRect + stroked lines + fillText, ~1.3M px on a
// phone) — exactly what DESIGN.md:166 bans. Those visuals now live as composited
// CSS layers driven by tension-tier classes (see GameScreen.jsx / GameScreen.css),
// so this module no longer touches the canvas at all — which lets the shared
// canvas loop actually idle when nothing transient is playing.
//
// What remains here is the AUDIO (low rumble + final siren) on the ONE shared
// AudioContext. It is DECOUPLED from any render loop: it schedules on TIER changes
// only (tensionSetTier), never per frame. The siren's pitch sweep is an audio-rate
// LFO oscillator (modulating the siren frequency in the audio thread), so it needs
// no JS clock. It is NOT a game clock and never drives the timer/turn/scoring.

import { getJuiceCtx, getJuiceMaster } from './audio';
import { soundAllowed } from './settings';
import { JUICE } from './config';

const T = JUICE.TENSION;

// The discrete tension tiers, mapped to a representative t = 1 - remainingFraction
// used to evaluate the existing audio ramps from config (so the feel tracks the
// same numbers the old per-frame path used). 'calm' silences the voices.
const TIER_T = { calm: 0, build: 0.52, warn: 0.75, crit: 0.95 };

// --- state -----------------------------------------------------------------
let active = false;
let tier = 'calm';

// --- audio voices (built lazily on the shared context, torn down fully) ------
let rumbleOsc = null;
let rumbleGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenLfo = null; // audio-rate sweep oscillator -> siren frequency
let sirenLfoGain = null;

function buildAudio() {
  if (rumbleOsc) return; // already built
  const ctx = getJuiceCtx();
  const master = getJuiceMaster();
  if (!ctx || !master) return;
  try {
    // Low rumble drone: a sine bed. Gain/pitch ride the tier (start silent).
    rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    rumbleGain.connect(master);
    rumbleOsc = ctx.createOscillator();
    rumbleOsc.type = 'sine';
    rumbleOsc.frequency.setValueAtTime(T.audio.rumble.baseFreq, ctx.currentTime);
    rumbleOsc.connect(rumbleGain);
    rumbleOsc.start();

    // Siren: a triangle centred at the sweep midpoint, its pitch swept lo<->hi by
    // an audio-rate LFO so no JS loop is needed. Gain only opens at the crit tier.
    const s = T.audio.siren;
    sirenGain = ctx.createGain();
    sirenGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    sirenGain.connect(master);
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.setValueAtTime((s.lo + s.hi) / 2, ctx.currentTime);
    sirenOsc.connect(sirenGain);
    sirenOsc.start();

    // LFO: sine at sweepHz, amplitude = half the lo..hi span, added to the siren's
    // frequency AudioParam. This reproduces the old manual sin() sweep in-thread.
    sirenLfo = ctx.createOscillator();
    sirenLfo.type = 'sine';
    sirenLfo.frequency.setValueAtTime(s.sweepHz, ctx.currentTime);
    sirenLfoGain = ctx.createGain();
    sirenLfoGain.gain.setValueAtTime((s.hi - s.lo) / 2, ctx.currentTime);
    sirenLfo.connect(sirenLfoGain);
    sirenLfoGain.connect(sirenOsc.frequency);
    sirenLfo.start();
  } catch {
    teardownAudio();
  }
}

// Stop + DISCONNECT every tension node so nothing dangles or bleeds into the
// menu / next round. Safe to call repeatedly.
function teardownAudio() {
  for (const node of [rumbleOsc, sirenOsc, sirenLfo]) {
    try { node && node.stop(); } catch { /* already stopped */ }
    try { node && node.disconnect(); } catch { /* noop */ }
  }
  for (const node of [rumbleGain, sirenGain, sirenLfoGain]) {
    try { node && node.disconnect(); } catch { /* noop */ }
  }
  rumbleOsc = rumbleGain = sirenOsc = sirenGain = sirenLfo = sirenLfoGain = null;
}

// Schedule the voices for the current tier. Called ONLY on a tier change (or a
// mute toggle) — never per frame. Mute / inactivity / calm tears everything down
// so nothing silent keeps running.
function applyTierAudio() {
  if (!active || tier === 'calm' || !soundAllowed()) {
    teardownAudio();
    return;
  }
  buildAudio();
  const ctx = getJuiceCtx();
  if (!ctx || !rumbleGain) return;
  const now = ctx.currentTime;
  const t = TIER_T[tier] ?? 0;

  // Rumble: ramps in from rumble.start, pitch climbs with the tier (same curve the
  // per-frame path used, evaluated at the tier's representative t).
  const r = T.audio.rumble;
  const rT = t > r.start ? (t - r.start) / (1 - r.start) : 0;
  const rGain = rT * rT * r.maxGain;
  rumbleGain.gain.setTargetAtTime(Math.max(0.0001, rGain), now, 0.12);
  try { rumbleOsc.frequency.setTargetAtTime(r.baseFreq + r.freqRise * rT, now, 0.15); } catch { /* noop */ }

  // Siren: opens only at/after siren.start (the crit tier); the LFO does the sweep.
  const s = T.audio.siren;
  if (sirenGain) {
    const sT = t > s.start ? (t - s.start) / (1 - s.start) : 0;
    sirenGain.gain.setTargetAtTime(Math.max(0.0001, sT * s.maxGain), now, 0.08);
  }
}

// --- public lifecycle API --------------------------------------------------
// Start the tension skin (audio only now). Idempotent.
export function tensionStart() {
  active = true;
}

// Set the current tension tier ('calm' | 'build' | 'warn' | 'crit'). Reschedules
// the audio voices for that tier. Presentational + read-only — never a clock.
export function tensionSetTier(nextTier) {
  const t = nextTier || 'calm';
  if (t === tier && active) return;
  tier = t;
  applyTierAudio();
}

// Re-evaluate the audio for the CURRENT tier (e.g. after a mute toggle) without
// changing the tier. Cheap; tears the voices down when muted.
export function tensionRefreshAudio() {
  applyTierAudio();
}

// Fully stop: disconnect every audio node, reset state. Call on round end /
// explosion / leave / unmount / mute. Idempotent.
export function tensionStop() {
  active = false;
  tier = 'calm';
  teardownAudio();
}
