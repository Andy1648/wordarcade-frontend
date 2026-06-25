// src/juice/settings.js
// Global motion/sound switches for the shared juice layer, plus live
// prefers-reduced-motion detection. Pure: reading any of these has no side
// effects, so the effect primitives (squash / burst / shake / sfx) can consult
// them and individual call sites never have to think about accessibility or the
// global mute. Defaults are ON; callers flip them to honor an app-level toggle.

const settings = { motion: true, sound: true };

// --- public setters (wire these to an existing settings/mute UI) ---
export function setMotion(on) { settings.motion = !!on; }
export function setSound(on) { settings.sound = !!on; }
// Alias so a caller holding a `muted` boolean reads naturally.
export function setMuted(muted) { settings.sound = !muted; }
export function getSettings() { return { ...settings }; }

// Live OS preference - queried per call so the module installs no listener at
// import time (keeps it side-effect-free until an effect actually runs). Wrapped
// because matchMedia is missing in some non-browser/test environments.
export function prefersReducedMotion() {
  try {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  } catch {
    return false;
  }
}

// --- predicates the effects gate on ---
// The user-facing motion flag alone (a hard off switch).
export const motionFlag = () => settings.motion;
// Motion that is also allowed by the OS (off if the flag is off OR reduce is on).
export const motionAllowed = () => settings.motion && !prefersReducedMotion();
export const soundAllowed = () => settings.sound;
export const reduced = () => prefersReducedMotion();
