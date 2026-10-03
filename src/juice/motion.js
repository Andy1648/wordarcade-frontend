// src/juice/motion.js
// DOM-element and whole-screen motion primitives. Everything here is
// transform/opacity only (compositor-friendly, no layout thrash) and reads the global
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
// Quick colour pop, OPACITY ONLY (CLAUDE.md ANIMATION BUDGET). It used to animate `filter` and
// `box-shadow` on the element itself — both paint-bound — and on the Word Bomb accept path it did
// so ON THE INPUT (DESIGN.md: never animate the input). Now ONE overlay <span> per element is
// created the first time that element flashes and cached; every later flash is a WAAPI opacity
// pulse on that same node (pooled, never a node per event). will-change rides only the playing
// animation and is cleared on finish.
//
// Functional feedback, so it always fires (softened under reduced-motion / motion-off). Elements
// that cannot hold a child (input, textarea, img, …) are skipped outright: an input is never
// animated, and the caller's other feedback carries the beat.
const NO_CHILD_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'IMG', 'BR', 'HR', 'VIDEO', 'CANVAS', 'IFRAME', 'SVG']);
const flashNodes = new WeakMap(); // element -> { node, positioned }

function flashNodeFor(el) {
  const have = flashNodes.get(el);
  // React may replace a text-only element's children wholesale; re-attach if our node was dropped.
  if (have && (!have.node || have.node.parentNode === el)) return have;
  let positioned = have ? have.positioned : null;
  if (positioned === null) {
    // ONE style read per element, ever (cached in the WeakMap) — never per flash.
    try {
      positioned = getComputedStyle(el).position !== 'static';
    } catch {
      positioned = false;
    }
  }
  let node = null;
  if (positioned) {
    node = document.createElement('span');
    node.className = 'juice-flash';
    node.setAttribute('aria-hidden', 'true');
    Object.assign(node.style, {
      position: 'absolute',
      inset: '0',
      borderRadius: 'inherit',
      pointerEvents: 'none',
      opacity: '0',
      zIndex: '1',
    });
    el.appendChild(node);
  }
  const rec = { node, positioned };
  flashNodes.set(el, rec);
  return rec;
}

export function flash(el, color) {
  if (!el || typeof el.animate !== 'function') return;
  if (NO_CHILD_TAGS.has(String(el.tagName || '').toUpperCase())) return;
  const soft = reduced() || !motionFlag();
  const dur = soft ? 150 : 220;
  const rec = flashNodeFor(el);
  // A static host cannot anchor an overlay without us changing its layout, so it gets a brief
  // opacity dip on itself instead — still opacity-only, still one animation.
  const target = rec.node || el;
  const frames = rec.node
    ? [{ opacity: 0 }, { opacity: soft ? 0.25 : 0.45, offset: 0.18 }, { opacity: 0 }]
    : [{ opacity: 1 }, { opacity: soft ? 0.85 : 0.7, offset: 0.18 }, { opacity: 1 }];
  if (rec.node) rec.node.style.background = color || '#FFFFFF';
  target.style.willChange = 'opacity';
  const a = target.animate(frames, { duration: dur, easing: 'ease-out' });
  const clear = () => {
    target.style.willChange = '';
  };
  a.onfinish = clear;
  a.oncancel = clear;
}

// --- punch -----------------------------------------------------------------
// The ESCALATION LADDER's per-accept PUNCH: a one-shot scale pop on a SLOT (the reaction / hype
// slot — never the input). It animates the individual `scale` property, which composes with the
// slot's own `transform` (e.g. its translateX(-50%) centring) instead of overwriting it, and is
// still a compositor-only transform. will-change is set for the life of the animation and cleared
// on finish. No-op under reduced motion / motion off (state stays legible without it).
export function punch(el, scale = 1.06, dur = 280) {
  if (!el || typeof el.animate !== 'function') return;
  if (!motionAllowed()) return;
  el.style.willChange = 'transform';
  const a = el.animate(
    [{ scale: '1' }, { scale: String(scale), offset: 0.35 }, { scale: '1' }],
    { duration: dur, easing: 'cubic-bezier(.34, 1.56, .64, 1)' }
  );
  const clear = () => {
    el.style.willChange = '';
  };
  a.onfinish = clear;
  a.oncancel = clear;
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
