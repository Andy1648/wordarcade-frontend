// gameSounds.js — the procedural EVENT sound set (Job 11). All C minor pentatonic (via audioCore),
// one voice family, up=good / down=bad / higher=more. Every function is fire-and-forget: it checks
// the toggle, ensures the shared context, schedules against currentTime, and returns — it NEVER
// blocks the caller (a keystroke/accept registers visually first; audio is scheduled, not awaited).
// Nothing plays before a user gesture (ensureCtx no-ops until the context exists) and nothing plays
// when the event-sounds toggle is off. No sound carries information that isn't also on screen.
import { ensureCtx, tone, pentFreq, NOTE, audioCtx } from './audioCore.js';

const EVENTS_KEY = 'taw.sfxEvents';

// DEFAULT OFF (school-lab audience — a room of Chromebooks must be silent until a student opts in).
let enabled = readEnabled();
function readEnabled() {
  try {
    return localStorage.getItem(EVENTS_KEY) === '1';
  } catch {
    return false;
  }
}
export function isEventSoundsEnabled() {
  return enabled;
}
export function enableEventSounds() {
  enabled = true;
  try { localStorage.setItem(EVENTS_KEY, '1'); } catch { /* blocked */ }
  ensureCtx(); // create/resume inside this click gesture
  return true;
}
export function disableEventSounds() {
  enabled = false;
  try { localStorage.setItem(EVENTS_KEY, '0'); } catch { /* blocked */ }
}

// Guard: play only when enabled AND the shared context is live. Returns the AudioContext, or null.
function ready() {
  if (!enabled) return null;
  if (!ensureCtx()) return null;
  return audioCtx();
}

// ---- The 10 events (exact recipes from the spec) ----------------------------------------

// word accepted — triangle+sine, pitch = pentatonic degree indexed by COMBO, climbing octaves as it
// grows; attack 5ms, silent by ~120ms; a fifth above at -6dB.
export function sndWordAccepted(combo = 0) {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  const degree = Math.min(NOTE.C6, NOTE.C4 + Math.max(0, combo)); // climbs with the combo, capped
  const f = pentFreq(degree);
  tone(t, { freq: f, type: 'triangle', dur: 0.12, gain: 0.22, attack: 0.005 });
  tone(t, { freq: f, type: 'sine', dur: 0.12, gain: 0.12, attack: 0.005 });
  tone(t, { freq: pentFreq(degree + 3), type: 'sine', dur: 0.11, gain: 0.11, attack: 0.005 }); // fifth, -6dB
}

// word rejected — sine 155→130Hz downward glide, 100ms, lowpass 800Hz, quiet. NOT a buzzer.
export function sndWordRejected() {
  const ctx = ready();
  if (!ctx) return;
  tone(ctx.currentTime, { freq: 155, glideTo: 130, type: 'sine', dur: 0.1, gain: 0.14, attack: 0.004, lowpass: 800 });
}

// level up — 3-note ascending pentatonic run (G–Bb–C), ~90ms each, ~350ms total.
export function sndLevelUp() {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  const seq = [NOTE.G4, NOTE.Bb4, NOTE.C5];
  seq.forEach((deg, i) => tone(t + i * 0.09, { freq: pentFreq(deg), type: 'triangle', dur: 0.14, gain: 0.2, attack: 0.005 }));
}

// rebirth — a 4–5 note run across an octave + a soft low-root swell, <=600ms.
export function sndRebirth() {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  const run = [NOTE.C4, NOTE.Eb4, NOTE.G4, NOTE.Bb4, NOTE.C5];
  run.forEach((deg, i) => tone(t + i * 0.1, { freq: pentFreq(deg), type: 'triangle', dur: 0.18, gain: 0.18, attack: 0.006 }));
  tone(t, { freq: pentFreq(NOTE.C3), type: 'sine', dur: 0.6, gain: 0.16, attack: 0.03 }); // low root swell
}

// purchase — two-note up interval (C→G), triangle, ~140ms.
export function sndPurchase() {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(t, { freq: pentFreq(NOTE.C4), type: 'triangle', dur: 0.09, gain: 0.2, attack: 0.005 });
  tone(t + 0.07, { freq: pentFreq(NOTE.G4), type: 'triangle', dur: 0.1, gain: 0.2, attack: 0.005 });
}

// lucky word — 3 fast high notes (G5–Bb5–C6), ~40ms each, slightly overlapped.
export function sndLucky() {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  const seq = [NOTE.G5, NOTE.Bb5, NOTE.C6];
  seq.forEach((deg, i) => tone(t + i * 0.032, { freq: pentFreq(deg), type: 'triangle', dur: 0.06, gain: 0.16, attack: 0.003 }));
}

// run over — gentle descending fall (C–Bb–G), sine, ~300ms, soft.
export function sndRunOver() {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  const seq = [NOTE.C5, NOTE.Bb4, NOTE.G4];
  seq.forEach((deg, i) => tone(t + i * 0.1, { freq: pentFreq(deg), type: 'sine', dur: 0.16, gain: 0.14, attack: 0.008 }));
}

// streak extended — a single warm in-key note, ~120ms.
export function sndStreakExtended() {
  const ctx = ready();
  if (!ctx) return;
  tone(ctx.currentTime, { freq: pentFreq(NOTE.F4), type: 'triangle', dur: 0.12, gain: 0.16, attack: 0.008 });
}

// achievement — root + fifth + octave struck together, 200ms decay.
export function sndAchievement() {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(t, { freq: pentFreq(NOTE.C4), type: 'triangle', dur: 0.2, gain: 0.16, attack: 0.005 });
  tone(t, { freq: pentFreq(NOTE.G4), type: 'triangle', dur: 0.2, gain: 0.13, attack: 0.005 }); // fifth
  tone(t, { freq: pentFreq(NOTE.C5), type: 'sine', dur: 0.2, gain: 0.12, attack: 0.005 }); // octave
}

// danger zone — a quiet low-root pulse whose tempo + pitch RISE as time runs out; STOPS instantly
// when danger passes. Driven by one function the game calls with the current intensity (0..1):
// 0 stops the loop, >0 (re)starts/updates it. A JS interval reschedules from the latest intensity.
let dangerTimer = null;
let dangerIntensity = 0;
export function setDanger(intensity) {
  const clamped = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0;
  dangerIntensity = clamped;
  if (!enabled || clamped <= 0) {
    if (dangerTimer) {
      clearInterval(dangerTimer);
      dangerTimer = null;
    }
    return;
  }
  if (dangerTimer) return; // already pulsing; the interval reads the live dangerIntensity
  const pulse = () => {
    if (!ensureCtx()) return;
    const ctx = audioCtx();
    if (!ctx) return;
    // pitch rises C3→~Eb3 with intensity; tempo 500ms→180ms.
    const deg = dangerIntensity > 0.66 ? NOTE.Eb3 : NOTE.C3;
    tone(ctx.currentTime, { freq: pentFreq(deg), type: 'sine', dur: 0.13, gain: 0.12, attack: 0.006, lowpass: 600 });
    const period = Math.round(500 - 320 * dangerIntensity); // 500 → 180ms
    if (dangerTimer) {
      clearInterval(dangerTimer);
      dangerTimer = setInterval(pulse, period);
    }
  };
  const period0 = Math.round(500 - 320 * clamped);
  dangerTimer = setInterval(pulse, period0);
  pulse();
}
export function stopDanger() {
  setDanger(0);
}
