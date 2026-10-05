// barPlan.js — how a LEVEL BAR travels from what it shows to what is real.
//
// ANDY (oct5): "PROGRESS BAR lags on multi-level climbs. Each level passed = a fast full-fill flash
// (~100ms each, capped ~1s total), level number ticks up, then fill to the real %. Never sit
// half-filled or behind the real value."
//
// Under Rebirth Rush one word (or a burst of letters) can cross 5–50 levels. The old bar snapped to
// 0 and counted 1.2–2 s into the NEW level while the level numeral counted on its own 1.6 s clock —
// so the bar sat half-filled, behind the real value, and every fresh gain snapped it back to 0.
//
// THE TIMING RULE (planBar):
//   n = levels crossed.
//   n ≤ 10        → n flashes of FLASH_MS (100 ms) each — one per level (≤ 1 s).
//   10 < n ≤ 30   → n flashes of max(FLASH_MIN_MS, ⌊FLASH_BUDGET_MS / n⌋) ms (≥ 33 ms, ≤ 1 s).
//   n > 30        → CHUNK_FLASHES (20) flashes of ⌊FLASH_BUDGET_MS / 20⌋ = 50 ms; the level count
//                   jumps in near-even chunks (⌈n/20⌉ or ⌊n/20⌋ a flash) that sum to n exactly.
//   Then ONE fill from 0 to the real fraction over FINAL_FILL_MS (200 ms, ease-out). A landing on
//   exactly 0 needs no fill. A SAME-LEVEL gain is a single fill to the real value on the house
//   200 ms too (Andy oct5: never behind the real value).
// Each flash sweeps the fill from where it is to FULL (linear), then the level numeral ticks up and
// the fill restarts at 0. The plan never moves backwards; a target behind the shown state is a DROP
// (rebirth / reset) and lands instantly.
//
// createBarPlayer runs a plan on ONE rAF loop (injected clock, so node --test drives it): finite, no
// layout reads, frames hand out numbers only (callers write transform: scaleX + text). A new target
// mid-plan RE-PLANS from the state on screen — never a jump back. Reduced motion lands instantly.
import { easeOutCubic, prefersReducedMotion } from '../juice/countUp.js';

export const FLASH_MS = 100;
export const FLASH_MIN_MS = 30;
export const FLASH_BUDGET_MS = 1000;
export const FLASH_ONE_EACH_MAX = 30; // up to this many levels, every level gets its own flash
export const CHUNK_FLASHES = 20; // past it, this many flashes, the count jumping in chunks
export const FINAL_FILL_MS = 200;

const clamp01 = (f) => (f > 0 ? Math.min(1, f) : 0);
const lvOf = (l) => (Number.isFinite(l) && l >= 1 ? Math.floor(l) : 1);

/** Per-flash duration (ms) for `count` flashes. */
export function flashMsFor(count) {
  if (!(count > 0)) return 0;
  if (count * FLASH_MS <= FLASH_BUDGET_MS) return FLASH_MS;
  return Math.max(FLASH_MIN_MS, Math.floor(FLASH_BUDGET_MS / count));
}

/**
 * Plan the trip from {level, frac} (what is SHOWN) to {level, frac} (what is REAL).
 * @returns {{ steps: Array<{kind:'flash'|'fill', level:number, levels?:number, fromFrac:number, toFrac:number, ms:number}>, totalMs:number, drop:boolean }}
 *   flash: the bar of `level` sweeps fromFrac → 1, then the level becomes level + levels (frac 0).
 *   fill:  the bar of `level` goes fromFrac → toFrac.
 *   drop:  the target is BEHIND the shown state — callers land it instantly (no steps).
 */
export function planBar(from, to, { sameLevelMs } = {}) {
  const fl = lvOf(from && from.level);
  const ff = clamp01(from && from.frac);
  const tl = lvOf(to && to.level);
  const tf = clamp01(to && to.frac);
  if (tl < fl || (tl === fl && tf < ff)) return { steps: [], totalMs: 0, drop: true };
  if (tl === fl) {
    if (tf === ff) return { steps: [], totalMs: 0, drop: false };
    const ms = Number.isFinite(sameLevelMs) && sameLevelMs >= 0 ? sameLevelMs : FINAL_FILL_MS; // Andy: never behind the real value — a same-level gain lands in 200 ms too
    return { steps: [{ kind: 'fill', level: fl, fromFrac: ff, toFrac: tf, ms }], totalMs: ms, drop: false };
  }
  const n = tl - fl;
  const count = n <= FLASH_ONE_EACH_MAX ? n : CHUNK_FLASHES;
  const ms = flashMsFor(count);
  const steps = [];
  let level = fl;
  for (let i = 0; i < count; i += 1) {
    // near-even chunks that sum to n exactly (the remainder spread over the first flashes)
    const levels = Math.floor(n / count) + (i < n % count ? 1 : 0);
    steps.push({ kind: 'flash', level, levels, fromFrac: i === 0 ? ff : 0, toFrac: 1, ms });
    level += levels;
  }
  if (tf > 0) steps.push({ kind: 'fill', level: tl, fromFrac: 0, toFrac: tf, ms: FINAL_FILL_MS });
  const totalMs = steps.reduce((s, x) => s + x.ms, 0);
  return { steps, totalMs, drop: false };
}

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const defaultRaf = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(() => fn(defaultNow()), 16));
const defaultCaf = (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

/**
 * One retargetable bar. `onFrame(level, frac, phase)` gets the state to SHOW each frame
 * (phase: 'flash' | 'fill' | 'rest'); `onLevel(level, prevLevel)` fires when the shown level changes.
 * @param {object} o
 * @param {number} [o.level=1] / [o.frac=0]  the starting state
 * @param {(from:number,to:number)=>number} [o.sameLevelMs]  same-level fill duration (default: countUpDuration)
 */
export function createBarPlayer({
  level = 1,
  frac = 0,
  onFrame = () => {},
  onLevel = () => {},
  onDone = () => {},
  sameLevelMs = null,
  reduced = prefersReducedMotion,
  now = defaultNow,
  raf = defaultRaf,
  caf = defaultCaf,
} = {}) {
  let shownLevel = lvOf(level);
  let shownFrac = clamp01(frac);
  let target = { level: shownLevel, frac: shownFrac };
  let steps = [];
  let t0 = 0;
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
    // the plan is over: land EXACTLY on the real value (never short of it)
    steps = [];
    show(target.level, target.frac, 'rest');
    onDone(target.level, target.frac);
  }

  const api = {
    /** Land on {level, frac} immediately (a drop, a reset, reduced motion). */
    set(l, f) {
      if (id) caf(id);
      id = 0;
      steps = [];
      target = { level: lvOf(l), frac: clamp01(f) };
      show(target.level, target.frac, 'rest');
      onDone(target.level, target.frac);
    },
    /** Travel to {level, frac}. Mid-plan this RE-PLANS from what is on screen (never backwards). */
    to(l, f) {
      const next = { level: lvOf(l), frac: clamp01(f) };
      if (next.level === target.level && next.frac === target.frac && (id || (shownLevel === next.level && shownFrac === next.frac))) return;
      const ms = typeof sameLevelMs === 'function' ? sameLevelMs(shownFrac, next.frac) : undefined;
      const plan = planBar({ level: shownLevel, frac: shownFrac }, next, { sameLevelMs: ms });
      if (plan.drop || reduced() || plan.steps.length === 0) {
        api.set(next.level, next.frac);
        return;
      }
      target = next;
      steps = plan.steps;
      t0 = now();
      if (!id) id = raf(step);
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
