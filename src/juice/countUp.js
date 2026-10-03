// countUp.js — THE ONE COUNT-UP (Andy oct3 #4: "count-up animations last longer, so the user can
// see how much it's increasing by").
//
// Every number that GROWS on screen — the menu wins chip, the menu XP bar, the in-game wins pill,
// the winner popup, the obscure-word payout, a claim stamp, the end-screen scores — counts through
// this module, so they share one duration rule, one ease and one retarget rule. Before this there
// were six hand-rolled loops (450 ms, 420 ms, 900 ms, 950 ms, a 30-step setInterval, a 90 ms
// exponential glide) and a gain was over before the eye found it.
//
// THE RULES
//   DURATION scales with the size of the jump on a LOG scale of the ratio: a nudge (+1% of what is
//   already there) takes COUNT_MIN_MS (1.2 s), a ×10 jump or more takes COUNT_MAX_MS (2 s), and
//   everything between sits on log10(1 + gain / from). A count from 0 is a "from nothing" jump and
//   takes the full 2 s. Callers whose host unmounts sooner pass a smaller `maxMs`.
//   NO STACKING: a new target mid-count RETARGETS the running count — it continues from the number
//   on screen toward the new target, on the one rAF it already has. Never a second loop, never a
//   jump back. The GAIN the caller shows ("+amount") is measured from where the CHAIN started, so
//   three quick words read "+30" growing, not "+10" three times.
//   FINITE: the loop runs only while a count is in flight and schedules nothing at rest.
//   REDUCED MOTION = INSTANT: every target lands immediately (onFrame + onDone, same tick).
//   A DROP (a purchase) is instant too — a balance never counts DOWN.
//   No layout reads, ever: onFrame receives numbers and the caller writes text / a transform.
//
// Pure apart from the injected clock + rAF, so `node --test` drives it with a fake clock.

export const COUNT_MIN_MS = 1200;
export const COUNT_MAX_MS = 2000;

/** Ease-out cubic: sprints, then settles — reads as "landing", not "loading". */
export function easeOutCubic(k) {
  const t = Math.min(1, Math.max(0, k));
  return 1 - Math.pow(1 - t, 3);
}

/**
 * How long a count from `from` to `to` lasts, in ms: COUNT_MIN_MS for a tiny jump, COUNT_MAX_MS for
 * a ×10 jump or more, log-scaled between. Always finite (huge / Infinity / NaN inputs clamp).
 */
export function countUpDuration(from, to, { minMs = COUNT_MIN_MS, maxMs = COUNT_MAX_MS } = {}) {
  const lo = Math.min(minMs, maxMs);
  const hi = Math.max(minMs, maxMs);
  const a = Number.isFinite(from) ? from : 0;
  const b = Number.isFinite(to) ? to : a;
  const gain = Math.abs(b - a);
  if (!(gain > 0)) return lo;
  const base = Math.max(1, Math.abs(a));
  const r = Math.log10(1 + gain / base); // 0.0043 for +1%, 0.30 for ×2, 1.04 for ×11
  const k = Math.min(1, Math.max(0, r));
  return Math.round(lo + (hi - lo) * k);
}

export function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const defaultRaf = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(() => fn(defaultNow()), 16));
const defaultCaf = (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

/**
 * One retargetable count. `onFrame(shown, gain)` is called with the number to show and the gain
 * since the chain began; `onDone(value, gain)` once when a count lands.
 *
 * @param {object} o
 * @param {number} [o.initial=0]   the starting number
 * @param {(shown:number, gain:number) => void} [o.onFrame]
 * @param {(value:number, gain:number) => void} [o.onDone]
 * @param {number} [o.minMs] / [o.maxMs]  duration bounds (default 1.2 s / 2 s)
 * @param {number} [o.fixedMs]  a fixed duration instead of the log rule (end-screen scores)
 * @param {boolean} [o.countDown=false]  allow counting DOWN (default: a drop is instant)
 * @param {() => boolean} [o.reduced]  reduced-motion probe (default: the media query)
 * @param {() => number} [o.now] / [o.raf] / [o.caf]  clock + frame scheduler (tests inject fakes)
 */
export function createCountUp({
  initial = 0,
  onFrame = () => {},
  onDone = () => {},
  minMs = COUNT_MIN_MS,
  maxMs = COUNT_MAX_MS,
  fixedMs = null,
  countDown = false,
  reduced = prefersReducedMotion,
  now = defaultNow,
  raf = defaultRaf,
  caf = defaultCaf,
} = {}) {
  const start = Number.isFinite(initial) ? initial : 0;
  let shown = start;
  let from = start;
  let target = start;
  let base = start; // where the current CHAIN began — the "+gain" is measured from here
  let t0 = 0;
  let dur = minMs;
  let id = 0;

  function step(t) {
    id = 0;
    const k = dur > 0 ? Math.min(1, Math.max(0, (t - t0) / dur)) : 1;
    shown = k >= 1 ? target : from + (target - from) * easeOutCubic(k);
    onFrame(shown, target - base);
    if (k < 1) id = raf(step);
    else onDone(target, target - base);
  }

  const api = {
    /** Land on `v` immediately (no count) and end any chain. */
    set(v) {
      const n = Number.isFinite(v) ? v : 0;
      if (id) caf(id);
      id = 0;
      shown = from = target = base = n;
      onFrame(n, 0);
      onDone(n, 0);
    },
    /** Count to `v`. Mid-count, this RETARGETS the running count (never a second loop). */
    to(v) {
      if (!Number.isFinite(v)) return;
      if (v === target && (id || shown === v)) return;
      const drop = v < shown && !countDown;
      if (drop || reduced()) {
        const gain = drop ? 0 : v - base;
        if (id) caf(id);
        id = 0;
        shown = from = target = v;
        if (drop) base = v;
        onFrame(v, gain);
        onDone(v, gain);
        if (!drop) base = v;
        return;
      }
      if (!id) base = shown; // a fresh chain starts where the number is now
      from = shown;
      target = v;
      dur = Number.isFinite(fixedMs) && fixedMs >= 0 ? fixedMs : countUpDuration(from, v, { minMs, maxMs });
      t0 = now();
      if (!id) id = raf(step);
    },
    /** Stop where it is (unmount). */
    cancel() {
      if (id) caf(id);
      id = 0;
    },
    get value() {
      return shown;
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
