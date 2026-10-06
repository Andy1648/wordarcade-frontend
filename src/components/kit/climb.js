// kit/climb.js — the XP BAR CLIMB (KitBars sheet, "WRAP CAP 1S" / "6+ LEVELS COMPRESS").
//
// WRAPS lib/barPlan.js: the same plan (one fast full-fill FLASH per level, near-even CHUNKS past 30
// levels, then ONE fill to the real fraction; a drop lands instantly; never backwards). barPlan caps
// the FLASHES at 1 s but then adds its 200 ms final fill, so a 10-level climb runs 1.2 s. The kit's
// rule is the WHOLE climb ≤ CLIMB_MAX_MS (1 s): planClimb scales every step of a plan that would run
// longer, keeping the per-level rhythm and the proportions.
//
// ANDY (oct6, "smooth and clean"): EVERY gain GLIDES — each fill is a GLIDE_MS (250 ms) ease-out on
// cubic-bezier(.2,.8,.2,1), retargeted from wherever the bar is (never a jump, never a restart), so
// typing fast reads as one continuous glide. barPlan's 200 ms final fill becomes the same glide.
//
// createClimbPlayer runs a plan on one rAF loop (injected clock for node --test) that sleeps at rest;
// frames hand out numbers only — callers write transform: scaleX and text. A new target mid-climb
// re-plans from the frac ON SCREEN (a JS number the loop tracks — never a style read). REDUCE MOTION
// lands instantly.
import { planBar } from '../../lib/barPlan.js';
import { reduceMotion } from '../../lib/reduceMotion.js';

export const CLIMB_MAX_MS = 1000;
/** Every fill (a same-level gain, the landing after a wrap) glides this long. */
export const GLIDE_MS = 250;
/** The white sweep that marks each level wrap (KitXpBar; transform only, one pooled node). */
export const SWEEP_MS = 150;

/** CSS cubic-bezier(x1,y1,x2,y2) as a function of progress k ∈ [0,1]. */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (k) => {
    if (!(k > 0)) return 0;
    if (k >= 1) return 1;
    let t = k;
    for (let i = 0; i < 8; i += 1) {
      const e = sx(t) - k;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0;
    let hi = 1;
    t = k;
    for (let i = 0; i < 30; i += 1) {
      const x = sx(t);
      if (Math.abs(x - k) < 1e-6) break;
      if (x < k) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}
/** The house glide: cubic-bezier(.2,.8,.2,1). */
export const glideEase = cubicBezier(0.2, 0.8, 0.2, 1);
// The player PLANS for 950 ms so the frame that lands the climb (one rAF after the plan ends) is still
// inside the 1 s budget on a real clock.
export const CLIMB_PLAN_MS = 950;

const clamp01 = (f) => (f > 0 ? Math.min(1, f) : 0);
const lvOf = (l) => (Number.isFinite(l) && l >= 1 ? Math.floor(l) : 1);

/** barPlan's plan, compressed so the whole climb fits in maxMs. Same shape as planBar's result. */
export function planClimb(from, to, { maxMs = CLIMB_MAX_MS } = {}) {
  const raw = planBar(from, to, { sameLevelMs: GLIDE_MS });
  if (raw.drop || raw.steps.length === 0) return raw;
  // every fill is the house glide (barPlan's landing fill is 200 ms)
  const glided = raw.steps.map((s) => (s.kind === 'fill' ? { ...s, ms: GLIDE_MS } : s));
  const plan = { steps: glided, totalMs: glided.reduce((a, s) => a + s.ms, 0), drop: false };
  if (plan.totalMs <= maxMs) return plan;
  const k = maxMs / plan.totalMs;
  const steps = plan.steps.map((s) => ({ ...s, ms: Math.floor(s.ms * k * 1000) / 1000 }));
  const totalMs = steps.reduce((a, s) => a + s.ms, 0);
  return { steps, totalMs, drop: false };
}

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const defaultRaf = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(() => fn(defaultNow()), 16));
const defaultCaf = (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

/**
 * @param {object} o
 * @param {(level:number, frac:number, phase:'flash'|'fill'|'rest')=>void} [o.onFrame]
 * @param {(level:number, prev:number)=>void} [o.onLevel]   the shown level changed (one flash landed)
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
  let steps = [];
  let t0 = 0;
  let began = 0; // when the current (possibly re-planned) climb started
  let id = 0;

  function show(l, f, phase) {
    const prev = shownLevel;
    shownLevel = l;
    shownFrac = f;
    if (l !== prev) onLevel(l, prev);
    onFrame(l, f, phase);
  }

  function step(t) {
    id = 0;
    let el = Math.max(0, t - t0);
    for (const s of steps) {
      if (el < s.ms) {
        const k = s.ms > 0 ? el / s.ms : 1;
        if (s.kind === 'flash') show(s.level, s.fromFrac + (1 - s.fromFrac) * k, 'flash');
        else show(s.level, s.fromFrac + (s.toFrac - s.fromFrac) * glideEase(k), 'fill');
        id = raf(step);
        return;
      }
      el -= s.ms;
    }
    steps = [];
    show(target.level, target.frac, 'rest');
    onDone(target.level, target.frac, Math.max(0, t - began));
  }

  const api = {
    set(l, f) {
      if (id) caf(id);
      id = 0;
      steps = [];
      target = { level: lvOf(l), frac: clamp01(f) };
      show(target.level, target.frac, 'rest');
      onDone(target.level, target.frac, 0);
    },
    to(l, f) {
      const next = { level: lvOf(l), frac: clamp01(f) };
      if (next.level === target.level && next.frac === target.frac && (id || (shownLevel === next.level && shownFrac === next.frac))) return null;
      const plan = planClimb({ level: shownLevel, frac: shownFrac }, next, { maxMs });
      if (plan.drop || reduced() || plan.steps.length === 0) {
        api.set(next.level, next.frac);
        return plan;
      }
      target = next;
      steps = plan.steps;
      t0 = now();
      if (!id) began = t0;
      if (!id) id = raf(step);
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
