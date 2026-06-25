// src/juice/motion.js
// DOM-element and whole-screen motion primitives. Everything here is
// transform/filter only (GPU-friendly, no layout thrash) and reads the global
// settings so reduced-motion / a disabled motion flag soften or skip the effect
// without the caller checking.

import { motionFlag, motionAllowed, reduced } from './settings';

// --- shake target ----------------------------------------------------------
// Screenshake translates a single root container. Defaults to the Vite mount
// (#root) so the whole app shakes as one; callers may retarget a gameplay-only
// wrapper to keep shake off menus/scrollbars.
let shakeRoot = null;
export function setShakeRoot(el) { shakeRoot = el || null; }
function getShakeRoot() {
  return shakeRoot || document.getElementById('root') || document.body;
}

// --- squash ----------------------------------------------------------------
// Press squash-and-stretch with overshoot via the Web Animations API. ~340ms,
// transform only (composited, no reflow). The motion flag hard-disables it; a
// reduced-motion preference keeps it but shallows the deform so the press still
// reads without the violent pop.
export function squash(el) {
  if (!el || typeof el.animate !== 'function') return;
  if (!motionFlag()) return; // hard off switch
  const o = reduced() ? 0.05 : 0.13; // overshoot depth
  el.animate(
    [
      { transform: 'scale(1, 1)' },
      { transform: `scale(${1 + o}, ${1 - o})`, offset: 0.3 }, // squash: widen + flatten
      { transform: `scale(${1 - o * 0.5}, ${1 + o * 0.5})`, offset: 0.62 }, // overshoot back
      { transform: 'scale(1, 1)' },
    ],
    { duration: 340, easing: 'cubic-bezier(.34, 1.56, .64, 1)' }
  );
}

// --- flash -----------------------------------------------------------------
// Quick brightness/color pop. Filter is GPU-friendly and never reflows. This is
// functional feedback, so it always fires (even with motion off) but softens
// under reduced-motion / motion-off. `color`, when given, adds a brief tinted
// ring on the full-strength version only.
export function flash(el, color) {
  if (!el || typeof el.animate !== 'function') return;
  const soft = reduced() || !motionFlag();
  const peak = soft ? 1.3 : 1.9;
  const sat = soft ? 1.15 : 1.6;
  const dur = soft ? 150 : 220;
  el.animate(
    [
      { filter: 'brightness(1) saturate(1)' },
      { filter: `brightness(${peak}) saturate(${sat})`, offset: 0.18 },
      { filter: 'brightness(1) saturate(1)' },
    ],
    { duration: dur, easing: 'ease-out' }
  );
  if (color && !soft) {
    el.animate(
      [
        { boxShadow: `0 0 0 0 ${color}00` },
        { boxShadow: `0 0 12px 3px ${color}`, offset: 0.2 },
        { boxShadow: `0 0 0 0 ${color}00` },
      ],
      { duration: dur, easing: 'ease-out' }
    );
  }
}

// --- shake -----------------------------------------------------------------
// Screenshake: translate the root container by a decaying random offset each
// frame. Transform only. No-op under reduced-motion or a disabled motion flag.
export function shake(amount = 8, dur = 320) {
  if (!motionAllowed()) return;
  const el = getShakeRoot();
  if (!el) return;
  const start = performance.now();
  function frame(now) {
    const t = (now - start) / dur;
    if (t >= 1) {
      el.style.transform = '';
      return;
    }
    const decay = 1 - t;
    const dx = (Math.random() * 2 - 1) * amount * decay;
    const dy = (Math.random() * 2 - 1) * amount * decay;
    el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// --- hitStop ---------------------------------------------------------------
// Brief global freeze for heavy impacts. Sets a window during which
// isHitStopped() is true (the particle loop checks this to freeze the frame),
// and returns a promise callers can await to sequence a "the world stopped"
// beat. No-op (resolves immediately) when motion is disabled/reduced.
let hitStopUntil = 0;
export function hitStop(ms = 80) {
  if (!motionAllowed()) return Promise.resolve();
  hitStopUntil = performance.now() + ms;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export function isHitStopped() {
  return performance.now() < hitStopUntil;
}
