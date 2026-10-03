// barFloor.js — OPTION F (claude/finetune/bar-movement.md): the GAME-WORD BAR FLOOR.
//
// Under PROGRESSION v10 a word's share of a level is ~10 × letters × mode × S·B × P^0.05 / needAt(L, 1),
// where S·B is the NON-KEY stack (streak, marks, mastery, STAR POWER, forge, frenzy, boost, weight).
// v10 was calibrated on sim bots whose S·B is ×1,000–×5,000; real top players sit at ×1–×2, so their
// bar moved 0.001–0.006% per word (27–154 h a level). The floor: every accepted GAME word moves the
// bar at least floorFrac(L) of the CURRENT level.
//
//   floorFrac(L) = 0.5%                        L ≤ 250
//                = 0.5% × 1.028^−(L − 250)     above (tracks the curve's own growth past the band)
//
// PROGRESSION v11 (claude/econ-oct2/v11-spec.md): OFF. The bar is now credited LEVEL XP (xp.js
// levelXpPerWord — KEY +25%/tier, rebirth ×(1+R), no unbounded wins engines) against ONE fixed curve, so
// the S·B gap that made a thin-stack save's word a 0.001% sliver is gone: the v11 estimate puts the
// median at ≥ 0.31% of a level per word everywhere in LV1–400 (casual ≥ 0.27%), above the 0.2% dead-bar
// line with no floor. The code stays as a ONE-CONSTANT fallback (BAR_FLOOR_ON) in case the CI sim
// disagrees; the receipt row and the stamp keep working either way.
//
// BAR ONLY. Wins are untouched — they stay the word's real XP ÷ 10 (wins.js perWordXp). Menu typing
// is never floored (it does not go through awardWordXp's game path). The floor is computed on the
// current level only; when it is the larger number it is credited through creditXp like any gain,
// so a cross-level carry uses the normal fraction storage.
//
// THE RECEIPT. awardWordXp leaves a one-shot stamp here describing what it did to the bar; the
// per-word receipt (payout.js buildPayout) consumes it, so the LEVEL FLOOR row is the same number the
// bar was credited — never a re-computation that could drift from it.
import { needAt } from './xp.js';

export const BAR_FLOOR_ON = false; // v11: off — see above
export const BAR_FLOOR_FRAC = 0.005; // 0.5% of the current level per accepted game word
export const BAR_FLOOR_TAPER_FROM = 250; // the floor is flat up to here
export const BAR_FLOOR_TAPER = 1.028; // ÷ this per level above BAR_FLOOR_TAPER_FROM

/** The floor as a fraction of the current level's need. 0 when the feature is off. */
export function floorFrac(level, on = BAR_FLOOR_ON) {
  if (!on) return 0;
  const lv = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  if (lv <= BAR_FLOOR_TAPER_FROM) return BAR_FLOOR_FRAC;
  return BAR_FLOOR_FRAC * Math.pow(BAR_FLOOR_TAPER, -(lv - BAR_FLOOR_TAPER_FROM));
}

/** The floor in XP at a level: floorFrac(L) × need(L). (`power` is v10's, accepted and ignored.) */
// eslint-disable-next-line no-unused-vars
export function barFloorXp(level, power, on = BAR_FLOOR_ON) {
  const f = floorFrac(level, on);
  if (!(f > 0)) return 0;
  const v = f * needAt(level);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Apply the floor to one game word's XP. PURE.
 * @returns {{ credited, floored, pct, rawPct }} credited = max(gain, floor XP); pct = the share of
 *   the level the bar actually moved (floor %, when floored); rawPct = what the word alone gave.
 */
export function applyBarFloor({ gain, level, power, on = BAR_FLOOR_ON } = {}) {
  const g = Number.isFinite(gain) && gain > 0 ? gain : 0;
  const cost = needAt(level);
  const fxp = barFloorXp(level, power, on);
  const floored = fxp > g;
  const credited = floored ? fxp : g;
  const share = (x) => (cost > 0 && Number.isFinite(x) ? (x / cost) * 100 : 0);
  return { credited, floored, pct: share(credited), rawPct: share(g), floorXp: fxp };
}

/** The LEVEL FLOOR share for the receipt: two significant figures ("+0.5%", "+0.13%"). */
export function formatFloorPct(p) {
  if (!(p > 0)) return '';
  if (p < 0.01) return '+<0.01%';
  return `+${Number(p.toPrecision(2))}%`;
}

// ---- one-shot stamp: awardWordXp → the per-word receipt -----------------------------------------
let stamp = null;
/** Set by awardWordXp for every word (null when the floor did not raise it). */
export function setBarFloorStamp(s) {
  stamp = s || null;
}
/** Read-and-clear: the receipt for the word just awarded. */
export function takeBarFloorStamp() {
  const s = stamp;
  stamp = null;
  return s;
}

// ---- one-shot stamp: the LEVEL XP the bar was credited (v11) → the receipt's "+N XP" headline -------
// The receipt's math line multiplies out to the WINS (big, exponential); its XP headline is the modest
// level XP the bar actually moved — two numbers now, so the receipt reads the award's own stamp rather
// than deriving XP from wins (which would quote KEY's ×2.5 a tier as level XP).
let levelXpStamp = null;
/** Set by awardWordXp for every word: the XP the level bar was credited. */
export function setLevelXpStamp(xp) {
  levelXpStamp = Number.isFinite(xp) && xp >= 0 ? xp : null;
}
/** Read-and-clear (payout.js buildPayout). */
export function takeLevelXpStamp() {
  const s = levelXpStamp;
  levelXpStamp = null;
  return s;
}
