// v3/econ.js — PROGRESSION v3 NUMBERS (claude/mockups/v2/progression-v3.md "Numbers"), as pure functions.
// Selected only through the SEASON2 flag (src/progress/season.js) at the live entry points; nothing here reads
// storage. LEAF: imports nothing.
//
//   XP per letter     7 × 1.8^POWER × 2^R × (1 + ★) × MARK
//   XP for next level 40 × √level                                   (v3/curve.js — O(1) carry)
//   WINS per word     15 × length/5 × MODE × 2^R × (1 + ★) × MARK
//   POWER             costs 100 × 4^P wins; kept through rebirth, reset on ascension
//   REBIRTH gate      LV ⌈100 × 2.5^R⌉ — levels reset to 1
//   REBIRTH reward    ×2 XP and wins, +7 gems × R
//   ASCEND            at R10: rebirths, levels and POWER reset; ★ += R − 9
//   GEMS / ROLLS      75 gems a roll; drops 1 in 15 words for 3–12, bot win +18, MP +15 per player beaten,
//                     streak +4, achievements 40–200
//
// TUNING (frozen structure; only ±20% on these constants after a CI sim — see the PR body for before/after).

export const XP_BASE = 7; // XP per letter at P0 R0 ★0, no mark
export const POWER_XP_STEP = 1.8; // × XP per letter per POWER
export const REBIRTH_STEP = 2; // × XP and wins per rebirth
export const CURVE_A = 40; // XP for the next level = CURVE_A × √level
export const WINS_BASE = 15; // wins for a 5-letter word at R0 ★0, MODE ×1, no mark
export const WORD_REF = 5; // the reference word length (length / 5)
export const POWER_COST_BASE = 100; // wins for P0 → P1
export const POWER_COST_STEP = 4; // × price per POWER
export const GATE_BASE = 100; // LV for R0 → R1
export const GATE_GROWTH = 2.5; // × gate per rebirth
export const REBIRTH_GEMS_PER_R = 7; // a rebirth to R pays 7 × R gems
export const ASCEND_AT = 10; // rebirths needed to ascend (#210 rebirthRules.ASCEND_AT, lb_ascend)

// GEMS (v3 table)
export const ROLL_PRICE = 75;
export const DROP_CHANCE = 1 / 15;
export const DROP_MIN = 3;
export const DROP_MAX = 12;
export const BOT_WIN = 18;
export const PER_PLAYER_BEATEN = 15;
export const STREAK_BONUS = 4; // flat, on every win that extends a streak (a win after a win)
export const LEVEL_UP = 0; // not in the v3 table (levels are cheap and plural — millions)
export const ACH_MIN = 40;
export const ACH_MAX = 200;

const CAP = 1e300; // every product stays finite (format.js reads it through the named-suffix ladder)
const int0 = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const fin = (v) => (Number.isNaN(v) ? 0 : Math.min(v, CAP));

/** POWER → its XP-per-letter multiplier, 1.8^P. */
export function powerXpMult(power) {
  return fin(Math.pow(POWER_XP_STEP, int0(power)));
}
/** Wins to buy P → P+1 (standing at `power`): 100 × 4^P. */
export function powerCost(power) {
  return fin(POWER_COST_BASE * Math.pow(POWER_COST_STEP, int0(power)));
}
/** Wins to REACH tier t (t ≥ 1) from t − 1 — the shop's keyTierCostAt shape. 0 for t ≤ 0. */
export function powerCostAt(tier) {
  const t = int0(tier);
  return t === 0 ? 0 : powerCost(t - 1);
}
/** ×2 per rebirth: 2^R. */
export function rebirthMult(rebirths) {
  return fin(Math.pow(REBIRTH_STEP, int0(rebirths)));
}
/** (1 + ★). */
export function starMult(stars) {
  return 1 + int0(stars);
}
/** XP per LETTER: (7 + markBase) × 1.8^P × 2^R × (1 + ★) × MARK. `markBase` = a worn +N BASE XP mark (0 none). */
export function xpPerLetter({ power = 0, rebirths = 0, stars = 0, mark = 1, markBase = 0 } = {}) {
  const m = Number.isFinite(mark) && mark > 0 ? mark : 1;
  const b = Number.isFinite(markBase) && markBase > 0 ? markBase : 0;
  return fin((XP_BASE + b) * powerXpMult(power) * rebirthMult(rebirths) * starMult(stars) * m);
}
/** WINS per word: (15 + markBase) × length/5 × MODE × 2^R × (1 + ★) × MARK (unrounded). */
export function winsPerWord({ length = WORD_REF, mode = 1, rebirths = 0, stars = 0, mark = 1, markBase = 0 } = {}) {
  const len = Number.isFinite(length) && length > 0 ? Math.floor(length) : 1;
  const md = Number.isFinite(mode) && mode > 0 ? mode : 1;
  const m = Number.isFinite(mark) && mark > 0 ? mark : 1;
  const b = Number.isFinite(markBase) && markBase > 0 ? markBase : 0;
  return fin((WINS_BASE + b) * (len / WORD_REF) * md * rebirthMult(rebirths) * starMult(stars) * m);
}
/** The LEVEL the next rebirth needs, standing at `rebirths`: ⌈100 × 2.5^R⌉ (= rebirthRules.serverGate(R, 2)). */
export function rebirthGate(rebirths) {
  const v = Math.ceil(GATE_BASE * Math.pow(GATE_GROWTH, int0(rebirths)));
  return Number.isFinite(v) ? v : Number.MAX_VALUE;
}
/** Gems a rebirth TO `rcAfter` pays: 7 × R. */
export function rebirthGems(rcAfter) {
  return REBIRTH_GEMS_PER_R * int0(rcAfter);
}
/** Can this save ascend? (R ≥ 10) */
export function canAscend(rebirths) {
  return int0(rebirths) >= ASCEND_AT;
}
/** ★ an ascension from `rebirths` adds: R − 9 (0 below ASCEND_AT). */
export function starsForAscend(rebirths) {
  const r = int0(rebirths);
  return r >= ASCEND_AT ? r - (ASCEND_AT - 1) : 0;
}

// COSMETICS (pop styles / sound packs) cost GEMS in v3 ("wins buy only POWER; everything else costs gems"): the
// i-th PAID rung of a list costs 75 × 1.5^(i−1) gems, to the nearest 5 (75, 115, 170, 255 …).
export const COSMETIC_GEM_BASE = 75;
export const COSMETIC_GEM_STEP = 1.5;
export function cosmeticGemPrice(rung) {
  const i = Math.max(1, int0(rung));
  return Math.max(5, Math.round((COSMETIC_GEM_BASE * Math.pow(COSMETIC_GEM_STEP, i - 1)) / 5) * 5);
}
