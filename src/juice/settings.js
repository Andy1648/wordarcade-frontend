// src/juice/settings.js
// Global motion/sound switches for the shared juice layer, plus the live
// in-game REDUCE MOTION toggle. Pure: reading any of these has no side
// effects, so the effect primitives (squash / burst / shake / sfx) can consult
// them and individual call sites never have to think about accessibility or the
// global mute. Defaults are ON; callers flip them to honor an app-level toggle.

import { reduceMotion } from '../lib/reduceMotion.js';

const settings = { motion: true, sound: true };

// --- public setters (wire these to an existing settings/mute UI) ---
export function setMotion(on) { settings.motion = !!on; }
export function setSound(on) { settings.sound = !!on; }
// Alias so a caller holding a `muted` boolean reads naturally.
export function setMuted(muted) { settings.sound = !muted; }
export function getSettings() { return { ...settings }; }

// The in-game REDUCE MOTION toggle (src/lib/reduceMotion.js). NOT the OS media query: managed
// school Chromebooks force prefers-reduced-motion: reduce, which killed every effect for players
// who never asked. The name is kept so existing callers read naturally.
export function prefersReducedMotion() {
  return reduceMotion();
}

// --- predicates the effects gate on ---
// The user-facing motion flag alone (a hard off switch).
export const motionFlag = () => settings.motion;
// Motion that is also allowed by REDUCE MOTION (off if the flag is off OR reduce is on).
export const motionAllowed = () => settings.motion && !prefersReducedMotion();
export const soundAllowed = () => settings.sound;
export const reduced = () => prefersReducedMotion();
