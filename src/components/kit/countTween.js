// kit/countTween.js — the PILL COUNT-UP (KitCurrency sheet, "COUNT-UP · SQUASH · +N STACKS").
//
// The mockup's tween, exactly: ease-out QUART, 700 ms for a gain, 320 ms for a spend, retargeting
// from the number on screen (a second gain mid-count continues — never a jump back, never a second
// loop). One rAF loop, alive only while a count is in flight; frames hand out numbers only (the
// caller writes text). REDUCE MOTION lands every target instantly.
import { reduceMotion } from '../../lib/reduceMotion.js';

export const COUNT_GAIN_MS = 700;
export const COUNT_SPEND_MS = 320;

export function easeOutQuart(k) {
  const t = Math.min(1, Math.max(0, k));
  return 1 - Math.pow(1 - t, 4);
}

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const defaultRaf = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(() => fn(defaultNow()), 16));
const defaultCaf = (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

/**
 * @param {object} o
 * @param {number} [o.initial=0]
 * @param {(shown:number)=>void} [o.onFrame]   every frame while counting (and once on a landing)
 * @param {(value:number)=>void} [o.onDone]    once when a count lands
 */
export function createCountTween({
  initial = 0,
  onFrame = () => {},
  onDone = () => {},
  ease = easeOutQuart,
  reduced = reduceMotion,
  now = defaultNow,
  raf = defaultRaf,
  caf = defaultCaf,
} = {}) {
  let shown = Number.isFinite(initial) ? initial : 0;
  let from = shown;
  let target = shown;
  let dur = 0;
  let t0 = 0;
  let id = 0;

  function step(t) {
    id = 0;
    const k = dur > 0 ? Math.min(1, Math.max(0, (t - t0) / dur)) : 1;
    shown = k >= 1 ? target : from + (target - from) * ease(k);
    onFrame(shown);
    if (k < 1) id = raf(step);
    else onDone(target);
  }

  const api = {
    /** Land on v now. */
    set(v) {
      const n = Number.isFinite(v) ? v : 0;
      if (id) caf(id);
      id = 0;
      shown = from = target = n;
      onFrame(n);
      onDone(n);
    },
    /** Count to v over ms (default: gain 700 / spend 320). Retargets a running count. */
    to(v, ms) {
      if (!Number.isFinite(v)) return;
      if (v === target && (id || shown === v)) return;
      const d = Number.isFinite(ms) ? ms : v >= shown ? COUNT_GAIN_MS : COUNT_SPEND_MS;
      if (reduced() || d <= 0) {
        api.set(v);
        return;
      }
      from = shown;
      target = v;
      dur = d;
      t0 = now();
      if (!id) id = raf(step);
    },
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
