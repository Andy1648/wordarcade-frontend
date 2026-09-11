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
// --- THE SHARED JUICE STACK: screen shake -----------------------------------
// TIERED, and the tiers matter. Screen shake is a documented motion-sickness
// trigger, so the loud tier is rationed rather than spent on every accept:
//   routine  2px / 0.2deg  - a word landed. Fires constantly, so it must be felt
//                            more than seen.
//   heavy    4px / 0.4deg  - reserved for rare high-tension beats (a wall broken,
//                            a game won). This is the ceiling; nothing shakes harder.
// ROTATION is the point. A pure translate of a few px reads as a rendering glitch;
// a few TENTHS of a degree of rotation is what makes the same displacement read as
// force. That is why every tier carries both.
export const SHAKE_TIERS = {
  routine: { px: 2, deg: 0.2, ms: 160 },
  heavy: { px: 4, deg: 0.4, ms: 260 },
};
const SHAKE_MAX_PX = 4;
const SHAKE_MAX_DEG = 0.4;

function resolveTier(tier) {
  if (typeof tier === 'string') return SHAKE_TIERS[tier] || SHAKE_TIERS.routine;
  // Back-compat: older call sites pass shake(amountPx, durMs). Map onto the tiers
  // and CLAMP - the caps are the contract, so a legacy shake(8) cannot exceed 4px.
  if (typeof tier === 'number') {
    const base = tier >= SHAKE_MAX_PX ? SHAKE_TIERS.heavy : SHAKE_TIERS.routine;
    return { ...base, px: Math.min(tier, SHAKE_MAX_PX) };
  }
  return SHAKE_TIERS.routine;
}

function shakeFrames(px, deg) {
  const p = Math.min(px, SHAKE_MAX_PX);
  const d = Math.min(deg, SHAKE_MAX_DEG);
  return [
    { transform: 'translate(0px, 0px) rotate(0deg)' },
    { transform: `translate(${-p}px, ${(p * 0.6).toFixed(2)}px) rotate(${-d}deg)` },
    { transform: `translate(${p}px, ${(-p * 0.6).toFixed(2)}px) rotate(${d}deg)` },
    { transform: `translate(${(-p * 0.5).toFixed(2)}px, ${(-p * 0.4).toFixed(2)}px) rotate(${(-d * 0.5).toFixed(2)}deg)` },
    { transform: 'translate(0px, 0px) rotate(0deg)' },
  ];
}

// One live shake at a time. A re-fire CANCELS and re-plays the same one-shot -
// never `void el.offsetWidth`, which forces a synchronous layout on what is by
// definition a hot path (it fires on every accepted word).
let shakeAnim = null;
export function shake(tier = 'routine', durOverride) {
  if (!motionAllowed()) return; // OS reduced-motion OR the user's Settings toggle
  const el = getShakeRoot();
  if (!el || typeof el.animate !== 'function') return;
  const t = resolveTier(tier);
  if (shakeAnim) shakeAnim.cancel();
  // will-change carries ONLY transform, and only for the life of the animation.
  el.style.willChange = 'transform';
  shakeAnim = el.animate(shakeFrames(t.px, t.deg), {
    duration: durOverride || t.ms,
    easing: 'ease-out',
  });
  const clear = () => {
    el.style.willChange = '';
    el.style.transform = '';
  };
  shakeAnim.onfinish = clear;
  shakeAnim.oncancel = clear;
}

// --- THE SHARED JUICE STACK: the PNG pop -------------------------------------
// scale 1.0 -> 1.12 -> 1.0 over 140ms. The mascot/word-chip/card "thump" that
// makes a discrete event feel like it hit something.
// NEVER call this on an ancestor of the text input: scaling a container that holds
// a focused <input> moves the caret and can pull the field out from under a
// mid-word typist. Pop the word chip, the bomb, or the card instead. The guard
// below refuses (and says so) rather than doing it quietly.
const popAnims = new WeakMap();
export function pop(el, { scale = 1.12, ms = 140 } = {}) {
  if (!el || typeof el.animate !== 'function') return;
  if (!motionFlag()) return; // hard off switch
  if (typeof el.querySelector === 'function' && el.querySelector('input, textarea')) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[juice] pop() refused: the element contains a text input. Pop the chip/bomb/card instead.');
    }
    return;
  }
  // Reduced motion keeps the beat but shallows it, exactly like squash().
  const peak = reduced() ? 1 + (scale - 1) * 0.35 : scale;
  const prev = popAnims.get(el);
  if (prev) prev.cancel(); // restart via cancel + play, never a forced reflow
  el.style.willChange = 'transform';
  const anim = el.animate(
    [{ transform: 'scale(1)' }, { transform: `scale(${peak})`, offset: 0.45 }, { transform: 'scale(1)' }],
    { duration: ms, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
  );
  popAnims.set(el, anim);
  const clear = () => {
    el.style.willChange = '';
    if (popAnims.get(el) === anim) popAnims.delete(el);
  };
  anim.onfinish = clear;
  anim.oncancel = clear;
}

// --- THE SHARED JUICE STACK: number count-up ---------------------------------
// Counts a numeric readout from -> to over ms, calling onTick each time the
// DISPLAYED integer changes (that is the hook the tick sound hangs off, so the
// audio lands on the digit change rather than on a fixed timer).
// Writes textContent only - no layout reads anywhere in the loop.
export function countUp(el, from, to, { ms = 420, onTick, format } = {}) {
  if (!el) return () => {};
  const fmt = format || ((n) => String(n));
  if (!motionAllowed() || from === to) {
    el.textContent = fmt(to);
    return () => {};
  }
  let raf = 0;
  let last = null;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    // ease-out so it sprints then settles, like a mechanical counter
    const v = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
    if (v !== last) {
      el.textContent = fmt(v);
      last = v;
      if (onTick) onTick(v);
    }
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => { if (raf) cancelAnimationFrame(raf); };
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
