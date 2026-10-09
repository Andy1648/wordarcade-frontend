// v3/econ.js — PROGRESSION FINAL v3 "START AT 1" NUMBERS (claude/progression-FINAL.md v3, Andy Oct 7 21:27), as pure
// functions. v3 changes CONSTANTS only (structure = v2).
// Selected only through the SEASON2 flag (src/progress/season.js) at the live entry points; nothing here reads
// storage. LEAF: imports nothing.
//
//   XP for next level need(n) = 100 × 1.15^(n−1)                      (v3/curve.js — O(1) closed-form carry)
//   XP per MENU KEY   1 × KEY × 3^R × MARK × OVERDRIVE                  v4 "SIMPLE" (Andy Oct 7 23:20): the menu is the
//                                                                       ONLY XP source; game letters pay NO XP
//   WINS per word     10 × length/5 × MODE × 3^R × MARK × OVERDRIVE     games only. MODE: WB/Blitz 1 · RACE 1.5 ·
//                                                                       CHAIN 2 · SAT 5 · FUSE 1 (+ FRENZY ×5)
//   KEY (POWER)       DOUBLES: tier T is ×2^T (×1, ×2, ×4, ×8 …); T → T+1 costs 150 × 5^T wins; KEPT through rebirth
//   REBIRTH           at LV 15 + 18·R → LV 1; ×3 XP & wins per rebirth, forever (no gems)
//   ASCENSION         none for now (hidden: canAscend is always false; lb_ascend refuses — 027)
//   GEMS              game-only: 1 in 15 game words drops 3–12 · bot win +18 · +15 per player beaten · streak +4 ·
//                     achievements 40–200 · 75 a roll. Menu typing gives no gems.
//
// Only these constants may change later (±20%, after the CI sim — claude/econ-oct2/final-sim.mjs). No restructures.

export const XP_BASE = 1; // XP per letter at KEY T0 R0, no mark (v3: was 10)
export const KEY_STEP = 2; // × XP per KEY tier: tier T is ×2^T (v3: replaces v2's ×1, 2, 5 … 1000, ×2.15 ladder)
export const MARK_BASE_REF = 10; // a worn +N BASE XP mark is sized against BASE 10: ×(10 + N) / 10 (MYTHIC +20 = ×3)
export const REBIRTH_STEP = 3; // × XP and wins per rebirth
export const CURVE_BASE = 100; // need(1)
export const CURVE_GROWTH = 1.15; // × need per level — each level 15% harder than the last (Andy Oct 7 22:31; v3 had 1.131)
export const WINS_BASE = 10; // wins for a 5-letter word at R0, MODE ×1, no mark
export const WORD_REF = 5; // the reference word length (length / 5)
export const POWER_COST_BASE = 150; // wins for T0 → T1
export const POWER_COST_STEP = 5; // × price per tier
export const REBIRTH_GATE_BASE = 15; // R1 at LV15 … (v4: was 18 — CI-sim tuned for an 18–25 min first rebirth from menu keys only)
export const REBIRTH_GATE_STEP = 18; // … then +18 levels a rebirth (R2 LV33, R5 LV105, R10 LV195; v4: was 20)
export const ASCENSION_ON = false; // FINAL v2: no ascension for now (hidden)
export const ASCEND_AT = 10; // kept for the hidden ascension (lb_ascend refuses while ASCENSION_ON is false)
export const ASCEND_STEP = 5;
export const REBIRTH_GEMS_PER_R = 0; // gems come from games only (a rebirth pays none)
export const MENU_SHARE = 0.2; // a menu letter = a fifth of a game letter

/** MODE multipliers on WINS (gameData ids). Menu typing pays no wins. FUSE FRENZY (×5, 5 min) is frenzy.js. */
export const MODE_MULT = Object.freeze({
  'word-bomb': 1,
  'category-blitz': 1,
  'word-race': 1.5,
  chain: 2,
  'sat-rush': 5,
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
// Andy oct8: a bots-only win pays by the HARDEST bot beaten (MEDIUM stays the old flat 18).
export const BOT_WIN_BY_DIFF = Object.freeze({ easy: 8, medium: 18, hard: 30 });
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

/** KEY tier → its XP-per-letter multiplier: 2^T. */
export function powerXpMult(power) {
  return fin(Math.pow(KEY_STEP, int0(power)));
}
/** Wins to buy T → T+1 (standing at `power`): 150 × 5^T. */
export function powerCost(power) {
  return fin(POWER_COST_BASE * Math.pow(POWER_COST_STEP, int0(power)));
}
/** Wins to REACH tier t (t ≥ 1) from t − 1 — the shop's keyTierCostAt shape. 0 for t ≤ 0. */
export function powerCostAt(tier) {
  const t = int0(tier);
  return t === 0 ? 0 : powerCost(t - 1);
}
/** ×3 per rebirth: 3^R. */
export function rebirthMult(rebirths) {
  return fin(Math.pow(REBIRTH_STEP, int0(rebirths)));
}
/** ★ multiply nothing in FINAL v2 (ascension is hidden) — kept for the callers that still show it. */
export function starMult() {
  return 1;
}
/** XP per LETTER: 1 × (10 + markBase)/10 × 2^T × 3^R × MARK. `markBase` = a worn +N BASE XP mark (0 none) — sized
 *  against BASE 10, so it scales the base by (10 + N)/10 exactly as it did when the base was 10. */
export function xpPerLetter({ power = 0, rebirths = 0, mark = 1, markBase = 0 } = {}) {
  const m = Number.isFinite(mark) && mark > 0 ? mark : 1;
  const b = Number.isFinite(markBase) && markBase > 0 ? markBase : 0;
  return fin(XP_BASE * ((MARK_BASE_REF + b) / MARK_BASE_REF) * powerXpMult(power) * rebirthMult(rebirths) * m);
}
/**
 * WINS per word: 10 × (10 + markBase)/10 × length/5 × MODE × 3^R × MARK (unrounded). `mode` = a number or a mode id.
 * `markBase` = a worn +N BASE WINS mark, sized against BASE 10 (exactly as the payout does — hooks.xpSwap.i).
 */
export function winsPerWord({ length = WORD_REF, mode = 1, rebirths = 0, mark = 1, markBase = 0 } = {}) {
  const len = Number.isFinite(length) && length > 0 ? Math.floor(length) : 1;
  const md = typeof mode === 'string' ? modeMult(mode) : Number.isFinite(mode) && mode > 0 ? mode : 1;
  const m = Number.isFinite(mark) && mark > 0 ? mark : 1;
  const b = Number.isFinite(markBase) && markBase > 0 ? markBase : 0;
  return fin(WINS_BASE * ((10 + b) / 10) * (len / WORD_REF) * md * rebirthMult(rebirths) * m);
}
/** The LEVEL the next rebirth needs, standing at `rebirths`: LV ≥ 15 + 18·R. */
export function rebirthGate(rebirths) {
  return REBIRTH_GATE_BASE + REBIRTH_GATE_STEP * int0(rebirths);
}
/** Gems a rebirth pays: none (gems come from games only). */
export function rebirthGems(rcAfter) {
  return REBIRTH_GEMS_PER_R * int0(rcAfter);
}
/** The rebirth count an ascension would need at `stars` (hidden — see ASCENSION_ON). */
export function ascendAt(stars = 0) {
  return ASCEND_AT + ASCEND_STEP * int0(stars);
}
/** Can this save ascend? Never while ascension is hidden. */
export function canAscend(rebirths, stars = 0) {
  return ASCENSION_ON && int0(rebirths) >= ascendAt(stars);
}
/** ★ an ascension adds: +1 when it can, else 0 (always 0 while hidden). */
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
