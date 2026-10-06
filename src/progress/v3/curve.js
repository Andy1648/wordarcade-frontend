// v3/curve.js — THE v3 LEVEL CURVE: XP for the next level = 40 × √level, the same for everyone.
//
// LEVELS REACH MILLIONS, so the carry is O(1) per credit — never one loop step per level. The curve is defined by
// its CLOSED-FORM CUMULATIVE (the midpoint rule of ∫ 40√x dx):
//     cum(L)  = XP from LV1 to reach LV L = (80/3) · ((L − ½)^1.5 − (½)^1.5)          cum(1) = 0
//     need(L) = cum(L + 1) − cum(L)  = (80/3) · ((L + ½)^1.5 − (L − ½)^1.5)  = 40·√L · (1 − 1/(96·L²) − …)
// so need(1) = 39.6, need(100) = 400.0, need(1M) = 40,000 — 40·√L to within 1% from LV1 and 0.001% from LV10.
// A credit adds XP to the cumulative total and INVERTS cum() (a cube-root-squared closed form, then at most a
// couple of ±1 fix-ups for float noise) — exactly additive: credit(a) then credit(b) lands where credit(a + b) does.
// LEAF: imports nothing.
import { CURVE_A } from './econ.js';

const K = (2 * CURVE_A) / 3; // (80/3) for CURVE_A = 40
const H15 = Math.pow(0.5, 1.5);
export const LEVEL_MAX = 1e15; // a level stays an exact integer (far past any reachable level)
export const FRAC_MAX = 1 - 1e-9;

const lvOf = (n) => (Number.isFinite(n) ? Math.min(LEVEL_MAX, Math.max(1, Math.floor(n))) : n === Infinity ? LEVEL_MAX : 1);

/** Cumulative XP from LV1 to reach `level` (0 at LV1). */
export function cumXp(level) {
  const L = lvOf(level);
  return K * (Math.pow(L - 0.5, 1.5) - H15);
}
/** XP to advance FROM `level` to level + 1 (≈ 40 × √level). Always finite and > 0. */
export function needV3(level) {
  const L = lvOf(level);
  const v = K * (Math.pow(L + 0.5, 1.5) - Math.pow(L - 0.5, 1.5));
  return v > 0 && Number.isFinite(v) ? v : CURVE_A * Math.sqrt(L);
}
/** The level a cumulative XP total reaches (the inverse of cumXp; floor). O(1). */
export function levelAtCum(total) {
  const T = Number.isFinite(total) && total > 0 ? total : 0;
  let L = Math.floor(Math.pow(T / K + H15, 2 / 3) + 0.5);
  if (!Number.isFinite(L) || L >= LEVEL_MAX) return LEVEL_MAX;
  L = Math.max(1, L);
  // float noise: at most a step or two either way
  for (let i = 0; i < 4 && L > 1 && cumXp(L) > T; i++) L -= 1;
  for (let i = 0; i < 4 && L < LEVEL_MAX && cumXp(L + 1) <= T; i++) L += 1;
  return L;
}
const clampFrac = (f) => (f > 0 ? Math.min(f, FRAC_MAX) : 0);

/**
 * Credit `gain` XP to a {level, frac|intoLevel} state — O(1) at any size. Returns { state, leveledUp, level } in
 * xp.creditXp's shape (state = { level, intoLevel, frac }).
 */
export function creditXpV3(state, gain) {
  const level0 = lvOf(state && state.level);
  const cost0 = needV3(level0);
  let into;
  if (state && typeof state.frac === 'number' && !Number.isNaN(state.frac)) into = clampFrac(state.frac) * cost0;
  else into = Number.isFinite(state && state.intoLevel) && state.intoLevel > 0 ? state.intoLevel : 0;
  const g = Number.isFinite(gain) && gain > 0 ? gain : 0;
  let level = level0;
  let rest = into + g;
  if (rest >= cost0 && level0 < LEVEL_MAX) {
    const total = cumXp(level0) + rest;
    level = Math.max(level0 + 1, levelAtCum(total));
    rest = total - cumXp(level);
  }
  const cost = needV3(level);
  const frac = clampFrac(cost > 0 ? rest / cost : 0);
  const intoLevel = Number.isFinite(rest) && rest >= 0 && rest < cost ? rest : frac * cost;
  return { state: { level, intoLevel, frac }, leveledUp: level > level0, level };
}
