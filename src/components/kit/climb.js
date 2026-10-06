// kit/climb.js — the XP BAR CLIMB (KitBars sheet, "WRAP CAP 1S" / "6+ LEVELS COMPRESS").
//
// WRAPS lib/barPlan.js: the same plan (one fast full-fill FLASH per level, near-even CHUNKS past 30
// levels, then ONE fill to the real fraction; a drop lands instantly; never backwards). barPlan caps
// the FLASHES at 1 s but then adds its 200 ms final fill, so a 10-level climb runs 1.2 s. The kit's
// rule is the WHOLE climb ≤ CLIMB_MAX_MS (1 s): planClimb scales every step of a plan that would run
// longer, keeping the per-level rhythm and the proportions.
//
// createClimbPlayer runs a plan on one rAF loop (injected clock for node --test); frames hand out
// numbers only — callers write transform: scaleX and text. A new target mid-climb re-plans from what
// is on screen. REDUCE MOTION lands instantly.
import { planBar } from '../../lib/barPlan.js';
import { reduceMotion } from '../../lib/reduceMotion.js';
import { easeOutCubic } from '../../juice/countUp.js';

export const CLIMB_MAX_MS = 1000;
// The player PLANS for 950 ms so the frame that lands the climb (one rAF after the plan ends) is still
// inside the 1 s budget on a real clock.
export const CLIMB_PLAN_MS = 950;

const clamp01 = (f) => (f > 0 ? Math.min(1, f) : 0);
const lvOf = (l) => (Number.isFinite(l) && l >= 1 ? Math.floor(l) : 1);

// P9a (KitLevelUp.dc.html 01 "D · MULTI = CHIP, 3 WRAPS MAX"): a multi-level gain WRAPS the bar at most MAX_WRAPS
// times — each wrap a WRAP_MS fill-to-cap + white sweep, the LV numeral ticking through near-even chunks that sum to
// the real gain — then fills to the real fraction. The "+N LV" chip (KitXpBar) carries the count.
export const MAX_WRAPS = 3;
export const WRAP_MS = 240;

/** barPlan's plan, regrouped to ≤ MAX_WRAPS wraps of WRAP_MS, then compressed so the whole climb fits in maxMs. */
export function planClimb(from, to, { maxMs = CLIMB_MAX_MS, maxWraps = MAX_WRAPS, wrapMs = WRAP_MS } = {}) {
  const raw = planBar(from, to);
  if (raw.drop || raw.steps.length === 0) return raw;
  const flashes = raw.steps.filter((s) => s.kind === 'flash');
  let steps = raw.steps;
  if (flashes.length) {
    const n = flashes.reduce((a, s) => a + s.levels, 0);
    const count = Math.min(maxWraps, n);
    const out = [];
    let level = flashes[0].level;
    for (let i = 0; i < count; i += 1) {
      const levels = Math.floor(n / count) + (i < n % count ? 1 : 0);
      out.push({ kind: 'flash', level, levels, fromFrac: i === 0 ? flashes[0].fromFrac : 0, toFrac: 1, ms: wrapMs });
      level += levels;
    }
    steps = [...out, ...raw.steps.filter((s) => s.kind !== 'flash')];
  }
  let totalMs = steps.reduce((a, s) => a + s.ms, 0);
  if (totalMs > maxMs) {
    const k = maxMs / totalMs;
    steps = steps.map((s) => ({ ...s, ms: Math.floor(s.ms * k * 1000) / 1000 }));
    totalMs = steps.reduce((a, s) => a + s.ms, 0);
  }
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
        else show(s.level, s.fromFrac + (s.toFrac - s.fromFrac) * easeOutCubic(k), 'fill');
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
