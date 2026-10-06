// kit/climb.js — the XP BAR CLIMB (KitBars sheet, "WRAP CAP 1S").
//
// ANDY (oct6 SEASON 2 list, item 5): "XP bar glides ~600ms ease-out with retargeting, never steps." The bar is ONE
// continuous position u = (levels above the start) + frac, and every gain is ONE glide of u to the new target:
//
//   * a gain of ≤ 1 level (a keystroke, a short wrap) glides GLIDE_MS = 600 ms, ease-out (1 − (1 − k)³);
//   * a bigger climb COMPRESSES: 600 ms + 200 ms a level past the first, capped at CLIMB_PLAN_MS (900 ms) so the
//     whole climb — however many levels — still lands inside the kit's 1 s budget (CLIMB_MAX_MS);
//   * a new target MID-GLIDE re-plans from the position AND the velocity on screen (a cubic Hermite whose start
//     slope is the current speed, end slope 0): typing fast is one smooth slow climb — no restart, no speed spike,
//     never backwards (start slope ≤ 3 keeps the Hermite monotone; a faster bar shortens the glide instead);
//   * a LEVEL WRAP is u crossing an integer: the fill reaches full, the caller sweeps + bumps the LV, and the fill
//     carries on from 0 — the same glide, no pause, no step.
//
// createClimbPlayer runs on one rAF loop (injected clock for node --test) that sleeps at rest; frames hand out
// numbers only — callers write transform: scaleX and text (no layout reads). A drop (rebirth) and REDUCE MOTION
// land instantly.
import { reduceMotion } from '../../lib/reduceMotion.js';

export const CLIMB_MAX_MS = 1000;
/** A gain of up to one level glides this long. */
export const GLIDE_MS = 600;
/** Extra glide per level past the first (big climbs compress into CLIMB_PLAN_MS). */
export const GLIDE_PER_LEVEL_MS = 200;
/** The white sweep that marks each level wrap (KitXpBar; transform/opacity only, one pooled node). */
export const SWEEP_MS = 280;
// The player PLANS for 900 ms so the frame that lands the climb (one rAF — or a late one — after the plan ends) is still
// inside the 1 s budget on a real clock.
export const CLIMB_PLAN_MS = 900;

/** The house glide from rest: ease-out cubic, 1 − (1 − k)³ (start slope 3, end slope 0). */
export function glideEase(k) {
  if (!(k > 0)) return 0;
  if (k >= 1) return 1;
  return 1 - (1 - k) ** 3;
}

/**
 * Hermite ease from 0 to 1 with start slope s0 (in units of the whole move per whole duration) and end slope 0.
 * s0 = 3 is glideEase; s0 ∈ [0, 3] stays monotone (never overshoots, never goes back).
 */
export function hermite(k, s0) {
  if (!(k > 0)) return 0;
  if (k >= 1) return 1;
  const k2 = k * k;
  const k3 = k2 * k;
  return s0 * (k3 - 2 * k2 + k) + (3 * k2 - 2 * k3);
}
/** d/dk of hermite. */
export function hermiteSlope(k, s0) {
  if (!(k >= 0) || k >= 1) return 0;
  return s0 * (3 * k * k - 4 * k + 1) + (6 * k - 6 * k * k);
}

/** How long a fresh glide of `levels` (u distance) runs: 600 ms up to one level, then +200 ms a level, ≤ maxMs. */
export function glideMs(levels, maxMs = CLIMB_PLAN_MS) {
  const d = Number.isFinite(levels) && levels > 0 ? levels : 0;
  if (d <= 1) return Math.min(GLIDE_MS, maxMs);
  return Math.min(maxMs, GLIDE_MS + GLIDE_PER_LEVEL_MS * (d - 1));
}

const clamp01 = (f) => (f > 0 ? Math.min(1, f) : 0);
const lvOf = (l) => (Number.isFinite(l) && l >= 1 ? Math.floor(l) : 1);

/**
 * The plan for one glide (pure; what the player runs): { drop, levels, ms, s0 }.
 * `from` = { level, frac }, `to` = { level, frac }, `v` = the bar's speed now in levels per ms (0 at rest).
 */
export function planClimb(from, to, { v = 0, fresh = true, maxMs = CLIMB_PLAN_MS } = {}) {
  const d = lvOf(to.level) - lvOf(from.level) + clamp01(to.frac) - clamp01(from.frac);
  if (d < 0) return { drop: true, levels: d, ms: 0, s0: 0 };
  if (d === 0) return { drop: false, levels: 0, ms: 0, s0: 0 };
  let ms = glideMs(d, maxMs);
  let s0 = fresh ? 3 : (Math.max(0, v) * ms) / d;
  if (s0 > 3) {
    // the bar already moves faster than a 3-slope glide allows: keep its speed and land sooner (no kink, no overshoot)
    ms = (3 * d) / v;
    s0 = 3;
  }
  return { drop: false, levels: d, ms, s0 };
}

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const defaultRaf = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(() => fn(defaultNow()), 16));
const defaultCaf = (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

/**
 * @param {object} o
 * @param {(level:number, frac:number, phase:'fill'|'rest')=>void} [o.onFrame]
 * @param {(level:number, prev:number)=>void} [o.onLevel]   the shown level changed (a wrap — or several in one frame)
 * @param {(level:number, frac:number, ms:number)=>void} [o.onDone]  landed; ms = how long the climb took
 */
export function createClimbPlayer({
  level = 1,
  frac = 0,
  maxMs = CLIMB_PLAN_MS,
  onFrame = () => {},
  onLevel = () => {},
  onDone = () => {},
  reduced = reduceMotion,
  now = defaultNow,
  raf = defaultRaf,
  caf = defaultCaf,
} = {}) {
  let shownLevel = lvOf(level);
  let shownFrac = clamp01(frac);
  let target = { level: shownLevel, frac: shownFrac };
  // the glide in flight: u runs from 0 to `d` (u = levels above baseLevel + frac − baseFrac)
  let g = null; // { baseLevel, baseFrac, d, ms, s0, t0 }
  let began = 0; // when the current (possibly retargeted) climb started
  let id = 0;
  let lastT = 0;

  function show(l, f, phase) {
    const prev = shownLevel;
    shownLevel = l;
    shownFrac = f;
    if (l !== prev) onLevel(l, prev);
    onFrame(l, f, phase);
  }
  function at(t) {
    const k = g.ms > 0 ? Math.min(1, Math.max(0, t - g.t0) / g.ms) : 1;
    return { k, u: g.d * hermite(k, g.s0) };
  }
  function speedAt(t) {
    if (!g || !id) return 0;
    const { k } = at(t);
    return k >= 1 ? 0 : (g.d * hermiteSlope(k, g.s0)) / g.ms;
  }
  function land(t) {
    g = null;
    show(target.level, target.frac, 'rest');
    onDone(target.level, target.frac, Math.max(0, t - began));
  }

  function step(t) {
    id = 0;
    lastT = t;
    if (!g) return;
    const { k, u } = at(t);
    if (k >= 1) {
      land(t);
      return;
    }
    const abs = g.baseFrac + u; // levels above baseLevel, fractional
    let l = g.baseLevel + Math.floor(abs);
    let f = abs - Math.floor(abs);
    // never past the target (float dust at the very end of the glide)
    if (l > target.level || (l === target.level && f > target.frac)) {
      l = target.level;
      f = target.frac;
    }
    show(l, f, 'fill');
    id = raf(step);
  }

  const api = {
    set(l, f) {
      if (id) caf(id);
      id = 0;
      g = null;
      target = { level: lvOf(l), frac: clamp01(f) };
      show(target.level, target.frac, 'rest');
      onDone(target.level, target.frac, 0);
    },
    to(l, f) {
      const next = { level: lvOf(l), frac: clamp01(f) };
      if (next.level === target.level && next.frac === target.frac && (id || (shownLevel === next.level && shownFrac === next.frac))) return null;
      const t = now();
      const running = !!id && !!g;
      const v = running ? speedAt(Math.max(t, lastT)) : 0;
      const plan = planClimb({ level: shownLevel, frac: shownFrac }, next, { v, fresh: !running, maxMs });
      if (plan.drop || reduced() || plan.levels === 0) {
        api.set(next.level, next.frac);
        return plan;
      }
      target = next;
      g = { baseLevel: shownLevel, baseFrac: shownFrac, d: plan.levels, ms: plan.ms, s0: plan.s0, t0: t };
      if (!id) {
        began = t;
        id = raf(step);
      }
      return plan;
    },
    cancel() {
      if (id) caf(id);
      id = 0;
    },
    get level() {
      return shownLevel;
    },
    get frac() {
      return shownFrac;
    },
    get target() {
      return target;
    },
    get running() {
      return id !== 0;
    },
  };
  return api;
}
