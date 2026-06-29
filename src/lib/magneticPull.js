// src/lib/magneticPull.js
// A magnetic CURSOR-PULL for interactive menu elements (the mode cards' outer
// wrapper + the CREATE/JOIN CTAs' wrapper). Purely presentational, cursor-driven
// only — NO idle/ambient motion. ONE shared rAF drives every registered element
// (never one-per-element). Each element springs a small translate toward the
// cursor as it nears, its hard offset shadow leans OPPOSITE and grows (the chip
// reads as lifting off + leaning in), a per-element neon glow + a slight scale
// ramp with proximity. Reduced-motion and coarse/no-hover pointers never
// register, so those users keep the element's existing static hover/glow.

import { useEffect } from 'react';

const PULL = 0.34; // fraction of cursor-distance pulled toward
const STIFF = 0.16; // spring stiffness toward the target
const DAMP = 0.78; // underdamped -> slight overshoot on the spring-back
const ENGAGE_PAD = 40; // px past the element's half-diagonal where the pull begins
const SCALE_MAX = 0.045; // proximity scale (1 -> 1.045 at closest approach)
const SHADOW_LEAN = 1.4; // shadow shifts opposite the pull by offset * this
const GLOW_BLUR = 22; // px peak neon glow blur
const GLOW_EASE = 0.2; // proximity glow/shadow lerp

const items = new Set();
const cursor = { x: -1e6, y: -1e6, seen: false };
let raf = 0;
let bound = false;

function onMove(e) {
  cursor.x = e.clientX;
  cursor.y = e.clientY;
  cursor.seen = true;
  ensure();
}
function onLeave() {
  cursor.seen = false; // pointer left the window -> everything springs back to rest
  ensure();
}

function bind() {
  if (bound) return;
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('blur', onLeave);
  document.addEventListener('mouseleave', onLeave);
  bound = true;
}
function unbind() {
  if (!bound) return;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('blur', onLeave);
  document.removeEventListener('mouseleave', onLeave);
  bound = false;
}

function ensure() {
  if (!raf && items.size) raf = requestAnimationFrame(frame);
}

function rgba(hex, a) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/(.)/g, '$1$1') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a.toFixed(3)})`;
}

function apply(it) {
  const lift = it.glow; // 0..1 proximity drives glow + shadow presence + scale
  it.el.style.transform = `translate(${it.ox.toFixed(2)}px, ${it.oy.toFixed(2)}px) scale(${(
    1 +
    SCALE_MAX * lift
  ).toFixed(4)})`;
  // At true rest, hand the look back to the element (no extra shadow), so the
  // resting appearance is unchanged. Otherwise: leaning hard shadow + neon glow.
  if (lift < 0.012 && Math.abs(it.ox) < 0.4 && Math.abs(it.oy) < 0.4) {
    it.el.style.boxShadow = '';
  } else {
    const sx = (it.base * lift - it.ox * SHADOW_LEAN).toFixed(1);
    const sy = (it.base * lift - it.oy * SHADOW_LEAN).toFixed(1);
    it.el.style.boxShadow = `${sx}px ${sy}px 0 #000, 0 0 ${(GLOW_BLUR * lift).toFixed(1)}px ${rgba(
      it.neon,
      0.85 * lift
    )}`;
  }
}

function frame() {
  raf = 0;
  let busy = false;
  for (const it of items) {
    const r = it.el.getBoundingClientRect();
    // True (untransformed) center: subtract our own translate so the pull never
    // feeds back on itself. Scale is centered, so it doesn't move the center.
    const cx = r.left + r.width / 2 - it.ox;
    const cy = r.top + r.height / 2 - it.oy;
    const halfDiag = Math.hypot(r.width, r.height) / 2;
    let tx = 0;
    let ty = 0;
    let prox = 0;
    if (cursor.seen) {
      const dx = cursor.x - cx;
      const dy = cursor.y - cy;
      const dist = Math.hypot(dx, dy);
      const engage = halfDiag + ENGAGE_PAD;
      if (dist < engage) {
        tx = dx * PULL;
        ty = dy * PULL;
        const mag = Math.hypot(tx, ty);
        if (mag > it.max) {
          tx = (tx / mag) * it.max;
          ty = (ty / mag) * it.max;
        }
        prox = 1 - Math.min(1, dist / engage); // 0 at the activation edge -> 1 at center
      }
    }
    // Underdamped spring toward the target offset.
    it.vx = (it.vx + (tx - it.ox) * STIFF) * DAMP;
    it.vy = (it.vy + (ty - it.oy) * STIFF) * DAMP;
    it.ox += it.vx;
    it.oy += it.vy;
    it.glow += (prox - it.glow) * GLOW_EASE;
    apply(it);
    if (
      Math.abs(it.ox) > 0.04 ||
      Math.abs(it.oy) > 0.04 ||
      Math.abs(it.vx) > 0.04 ||
      Math.abs(it.vy) > 0.04 ||
      it.glow > 0.01 ||
      prox > 0
    ) {
      busy = true;
    }
  }
  // Keep running only while something is still moving/engaged; onMove restarts us
  // on the next cursor move. At full rest the loop stops (no idle work).
  if (busy) raf = requestAnimationFrame(frame);
  else raf = 0;
}

export function registerMagnet(el, { max, neon, base = 6 }) {
  if (!el) return null;
  const it = { el, max, neon, base, ox: 0, oy: 0, vx: 0, vy: 0, glow: 0 };
  items.add(it);
  bind();
  ensure();
  return it;
}

export function unregisterMagnet(it) {
  if (!it) return;
  items.delete(it);
  it.el.style.transform = '';
  it.el.style.boxShadow = '';
  if (!items.size) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    unbind();
  }
}

// React hook: register on mount, clean up on unmount. GATED — only a fine pointer
// with motion allowed engages; touch/coarse + reduced-motion are no-ops, leaving
// the element's existing static hover/press/glow untouched.
export function useMagneticPull(ref, { max, neon, base = 6 }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const handle = registerMagnet(el, { max, neon, base });
    return () => unregisterMagnet(handle);
  }, [ref, max, neon, base]);
}
