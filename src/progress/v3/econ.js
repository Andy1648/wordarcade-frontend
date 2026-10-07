// v3/econ.js — PROGRESSION FINAL NUMBERS (claude/progression-FINAL.md "Numbers (final constants)" — FROZEN, Andy
// oct6 17:15), as pure functions. Selected only through the SEASON2 flag (src/progress/season.js) at the live entry
// points; nothing here reads storage. LEAF: imports nothing.
//
//   XP for next level need(n) = 400 × 1.06^(n−1)                     (v3/curve.js — O(1) closed-form carry)
//   XP per letter     10 × 2.5^POWER × 2^R × (1 + ★) × MARK           game letters ×1, menu real-word letters ×0.2
//   WINS per word     22 × length/5 × MODE × 2^R × (1 + ★) × MARK     MODE: WB/Blitz 1 · RACE 1.5 · CHAIN 2 · SAT 3 · FUSE 1
//   POWER             P → P+1 costs 300 × 8^P wins; ×2.5 XP a tier; kept through rebirth, reset on ascension
//   REBIRTH           needs LV > 25 × (R+1); SPENDS those levels, keeps the rest; ×2 XP and wins (no gems)
//   ASCEND            at R = 10 + 5 × ★: R → 0, POWER → 0, level → 1, ★ + 1
//   GEMS              game-only: 1 in 15 game words drops 3–12 · bot win +18 · +15 per player beaten · streak +4 ·
//                     achievements 40–200 · 75 a roll. Menu typing gives no gems.
//
// Only these constants may change later (±20%, after the CI sim — claude/econ-oct2/final-sim.mjs). No restructures.

export const XP_BASE = 10; // XP per letter at P0 R0 ★0, no mark
export const POWER_XP_STEP = 2.5; // × XP per letter per POWER tier
export const REBIRTH_STEP = 2; // × XP and wins per rebirth
export const CURVE_BASE = 400; // need(1)
export const CURVE_GROWTH = 1.06; // × need per level
export const WINS_BASE = 22; // wins for a 5-letter word at R0 ★0, MODE ×1, no mark
export const WORD_REF = 5; // the reference word length (length / 5)
export const POWER_COST_BASE = 300; // wins for P0 → P1
export const POWER_COST_STEP = 8; // × price per POWER
export const REBIRTH_COST_STEP = 25; // a rebirth from R spends 25 × (R + 1) levels
export const ASCEND_AT = 10; // the first ascension: R10 (lb_ascend; serverRebirth.js keeps a literal copy)
export const ASCEND_STEP = 5; // … then R15, R20 …: 10 + 5 × ★
export const REBIRTH_GEMS_PER_R = 0; // FINAL: gems come from games only (a rebirth pays none)
export const MENU_SHARE = 0.2; // a menu real-word letter = a fifth of a game letter

/** MODE multipliers on WINS (gameData ids). Menu typing pays no wins. FUSE FRENZY (×5, 5 min) is frenzy.js. */
export const MODE_MULT = Object.freeze({
  'word-bomb': 1,
  'category-blitz': 1,
  'word-race': 1.5,
  chain: 2,
  'sat-rush': 3,
  fuse: 1,
});
export function modeMult(mode) {
  const m = MODE_MULT[mode];
  return Number.isFinite(m) ? m : 1;
}

// GEMS (FINAL table)
export const ROLL_PRICE = 75;
export const DROP_CHANCE = 1 / 15;
export const DROP_MIN = 3;
export const DROP_MAX = 12;
export const BOT_WIN = 18;
export const PER_PLAYER_BEATEN = 15;
export const STREAK_BONUS = 4; // flat, on every win that extends a streak (a win after a win)
export const LEVEL_UP = 0; // levels pay no gems
export const ACH_MIN = 40;
export const ACH_MAX = 200;

// MARKS (FINAL): the MAIN multiplier by tier (the part above ×1 is marks.js MARK_TIERS[t].bonus in season 2)
export const MARK_MULT = Object.freeze({ common: 1.1, rare: 1.25, epic: 1.5, legendary: 2, mythic: 3, secret: 5 });

const CAP = 1e300; // every product stays finite (format.js reads it through the named-suffix ladder)
const int0 = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const fin = (v) => (Number.isNaN(v) ? 0 : Math.min(v, CAP));

/** POWER → its XP-per-letter multiplier, 2.5^P. */
export function powerXpMult(power) {
  return fin(Math.pow(POWER_XP_STEP, int0(power)));
}
/** Wins to buy P → P+1 (standing at `power`): 300 × 8^P (exact integers while they are exact). */
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
/** XP per LETTER: (10 + markBase) × 2.5^P × 2^R × (1 + ★) × MARK. `markBase` = a worn +N BASE XP mark (0 none). */
export function xpPerLetter({ power = 0, rebirths = 0, stars = 0, mark = 1, markBase = 0 } = {}) {
  const m = Number.isFinite(mark) && mark > 0 ? mark : 1;
  const b = Number.isFinite(markBase) && markBase > 0 ? markBase : 0;
  return fin((XP_BASE + b) * powerXpMult(power) * rebirthMult(rebirths) * starMult(stars) * m);
}
/**
 * WINS per word: 22 × (10 + markBase)/10 × length/5 × MODE × 2^R × (1 + ★) × MARK (unrounded). `mode` = a number or a
 * mode id. `markBase` = a worn +N BASE WINS mark, which is sized against the live BASE 10 (a MYTHIC +20 = ×3, like
 * every MYTHIC) — so it scales the 22 by (10 + N)/10, exactly as the payout does (hooks.xpSwap.i / wins.wordWinsBase).
 * (NUMBERS AUDIT: this helper used to ADD it, 22 + N, which disagreed with what the game pays.)
 */
export function winsPerWord({ length = WORD_REF, mode = 1, rebirths = 0, stars = 0, mark = 1, markBase = 0 } = {}) {
  const len = Number.isFinite(length) && length > 0 ? Math.floor(length) : 1;
  const md = typeof mode === 'string' ? modeMult(mode) : Number.isFinite(mode) && mode > 0 ? mode : 1;
  const m = Number.isFinite(mark) && mark > 0 ? mark : 1;
  const b = Number.isFinite(markBase) && markBase > 0 ? markBase : 0;
  return fin(WINS_BASE * ((10 + b) / 10) * (len / WORD_REF) * md * rebirthMult(rebirths) * starMult(stars) * m);
}
/** The LEVELS a rebirth from `rebirths` SPENDS: 25 × (R + 1). */
export function rebirthCost(rebirths) {
  return REBIRTH_COST_STEP * (int0(rebirths) + 1);
}
/** The LEVEL the next rebirth needs, standing at `rebirths`: LV > 25 × (R + 1), i.e. 25 × (R + 1) + 1. */
export function rebirthGate(rebirths) {
  return rebirthCost(rebirths) + 1;
}
/** The level a rebirth leaves: level − 25 × (R + 1) (the leftovers stay; never below 1). */
export function levelAfterRebirth(level, rebirths) {
  const L = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  return Math.max(1, L - rebirthCost(rebirths));
}
/** Gems a rebirth pays: none (FINAL — gems come from games only). */
export function rebirthGems(rcAfter) {
  return REBIRTH_GEMS_PER_R * int0(rcAfter);
}
/** The rebirth count an ascension needs at `stars`: 10 + 5 × ★. */
export function ascendAt(stars = 0) {
  return ASCEND_AT + ASCEND_STEP * int0(stars);
}
/** Can this save ascend? R ≥ 10 + 5 × ★. */
export function canAscend(rebirths, stars = 0) {
  return int0(rebirths) >= ascendAt(stars);
}
/** ★ an ascension adds: +1 (never R − 9 — that ran away to ★600 in 24 h in the FINAL tuning). 0 when not ready. */
export function starsForAscend(rebirths, stars = 0) {
  return canAscend(rebirths, stars) ? 1 : 0;
}

// COSMETICS (pop styles / sound packs) cost GEMS in season 2 ("wins buy only POWER"): the i-th PAID rung of a list
// costs 75 × 1.5^(i−1) gems, to the nearest 5 (75, 115, 170, 255 …).
export const COSMETIC_GEM_BASE = 75;
export const COSMETIC_GEM_STEP = 1.5;
export function cosmeticGemPrice(rung) {
  const i = Math.max(1, int0(rung));
  return Math.max(5, Math.round((COSMETIC_GEM_BASE * Math.pow(COSMETIC_GEM_STEP, i - 1)) / 5) * 5);
}
