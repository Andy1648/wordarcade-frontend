// v3/curve.js — THE FINAL LEVEL CURVE: XP for the next level need(n) = 100 × 1.15^(n−1), the same for everyone
// (never scales with R / POWER / ★).
//
// A credit is O(1) at any level — never one loop step per level. The curve is geometric, so the XP
// for k levels from L is a closed-form sum:  S(L, k) = need(L) × (1.15^k − 1) / 0.15.  A credit inverts it relative
// to need(L) (k = ⌊log(1 + rest × 0.15 / need(L)) / log 1.15⌋, then at most a couple of ±1 fix-ups for float noise),
// so it stays exact at any level and is additive: credit(a) then credit(b) lands where credit(a + b) does.
// LEAF: imports econ.js only.
import { CURVE_BASE, CURVE_GROWTH } from './econ.js';

const G = CURVE_GROWTH;
const LG = Math.log(G);
const R = G - 1;
// 100 × 1.15^(L−1) stays finite to L ≈ 4,900; past the cap the level holds (XP/letter is capped at 1e300 too)
export const LEVEL_MAX = Math.floor(Math.log(1e300 / CURVE_BASE) / LG);
export const FRAC_MAX = 1 - 1e-9;

const lvOf = (n) => (Number.isFinite(n) ? Math.min(LEVEL_MAX, Math.max(1, Math.floor(n))) : n === Infinity ? LEVEL_MAX : 1);

/** XP to advance FROM `level` to level + 1: 100 × 1.15^(level−1). Always finite and > 0. */
export function needV3(level) {
  return CURVE_BASE * Math.pow(G, lvOf(level) - 1);
}
/** Cumulative XP from LV1 to reach `level` (0 at LV1): 100 × (1.15^(L−1) − 1) / 0.15. */
export function cumXp(level) {
  return (CURVE_BASE * (Math.pow(G, lvOf(level) - 1) - 1)) / R;
}
/** XP for `k` levels starting at `level` (closed form). */
function span(level, k) {
  return k <= 0 ? 0 : (needV3(level) * (Math.pow(G, k) - 1)) / R;
}
/** The level a cumulative XP total reaches (the inverse of cumXp; floor). O(1). */
export function levelAtCum(total) {
  const T = Number.isFinite(total) && total > 0 ? total : 0;
  let L = 1 + Math.floor(Math.log(1 + (T * R) / CURVE_BASE) / LG);
  if (!Number.isFinite(L) || L >= LEVEL_MAX) return LEVEL_MAX;
  L = Math.max(1, L);
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
    let k = Math.floor(Math.log(1 + (rest * R) / cost0) / LG);
    if (!Number.isFinite(k)) k = LEVEL_MAX - level0;
    k = Math.max(1, Math.min(k, LEVEL_MAX - level0));
    // float noise: at most a step or two either way
    for (let i = 0; i < 4 && k > 1 && span(level0, k) > rest; i++) k -= 1;
    for (let i = 0; i < 4 && level0 + k < LEVEL_MAX && span(level0, k + 1) <= rest; i++) k += 1;
    level = level0 + k;
    rest = Math.max(0, rest - span(level0, k));
  }
  const cost = needV3(level);
  const frac = clampFrac(cost > 0 ? rest / cost : 0);
  const intoLevel = Number.isFinite(rest) && rest >= 0 && rest < cost ? rest : frac * cost;
  return { state: { level, intoLevel, frac }, leveledUp: level > level0, level };
}
