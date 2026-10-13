// v3/econ.js — PROGRESSION FINAL v3 "START AT 1" NUMBERS (claude/progression-FINAL.md v3, Andy Oct 7 21:27), as pure
// functions. v3 changes CONSTANTS only (structure = v2).
// Selected only through the SEASON2 flag (src/progress/season.js) at the live entry points; nothing here reads
// storage. LEAF: imports nothing.
//
//   XP for next level need(n) = 100 × 1.15^(n−1)                      (v3/curve.js — O(1) closed-form carry)
//   XP per MENU KEY   1 × KEY × 3^R × MARK × OVERDRIVE                  v4 "SIMPLE" (Andy Oct 7 23:20): the menu is the
//                                                                       ONLY XP source; game letters pay NO XP
//   WINS per word     10 × length/5 × MODE × 3^R × MARK × OVERDRIVE     games only. MODE: WB/Blitz 1 · RACE 1.5 ·
//                                                                       CHAIN 4 · SAT 5 · FUSE 6 (+ FRENZY ×5)
//   KEY (POWER)       DOUBLES: tier T is ×2^T (×1, ×2, ×4, ×8 …); T → T+1 costs 150 × 5^T wins; KEPT through rebirth
//   REBIRTH           at LV 15 + 18·R → LV 1; ×3 XP & wins per rebirth, then ×4 (×15 every 5th), forever
//   ASCENSION         none for now (hidden: canAscend is always false; lb_ascend refuses — 027)
//   GEMS              game-only: 1 in 15 game words drops 3–12 · bot win +18 · +15 per player beaten · streak +4 ·
//                     achievements 40–200 · 75 a roll. Menu typing gives no gems.
//
// Only these constants may change later (±20%, after the CI sim — claude/econ-oct2/final-sim.mjs). No restructures.

export const XP_BASE = 1; // XP per letter at KEY T0 R0, no mark (v3: was 10)
export const KEY_STEP = 2; // × XP per KEY tier: tier T is ×2^T (v3: replaces v2's ×1, 2, 5 … 1000, ×2.15 ladder)
export const MARK_BASE_REF = 10; // a worn +N BASE XP mark is sized against BASE 10: ×(10 + N) / 10 (MYTHIC +20 = ×3)
export const REBIRTH_STEP = 3; // × XP and wins per rebirth (the first REBIRTH_LATE_FROM − 1 rebirths)
// LATE REBIRTHS (Andy oct13 "progression slows too much after later rebirths" … "not everything needs to give constant
// returns"): from the 5th rebirth on each one pays ×4, and every 5th (R5, R10, R15 …) is a JACKPOT ×15 — the Roblox
// milestone shape (a big rebirth resets the climb, then it grinds harder until the next one). The gate grows ×1.15^18
// ≈ ×12.4 XP a rebirth; at a flat ×3 every rebirth took ~1.9× the last (final-sim --ladder, FAST: R10 ≈ 110 h in).
// Measured (final-sim --ladder --mode=chain, MEDIAN): R10→R11 2.0 h after the jackpot vs 7.5 h at a flat ×5; R14 at
// 37 h vs 70 h. R1–R5 arrive exactly as before (the CI table cells are untouched).
export const REBIRTH_STEP_LATE = 4;
export const REBIRTH_JACKPOT = 15;
export const REBIRTH_JACKPOT_EVERY = 5;
export const REBIRTH_LATE_FROM = 5; // the rebirth number that first pays the late steps
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
export const JACKPOT_GEMS = 150; // REBIRTH ROAD (Andy oct13): a JACKPOT rebirth (R5, R10 …) pays +150 on top — 2 rolls. 036's gem budget (250 a game word, 25 words a rebirth) covers it many times over
export const REBIRTH_GEMS_PER_R = 25; // Andy oct11: a rebirth pays 25 × the new R (R1 25 · R3 75 = a roll · R10 250) — levels pay none now
export const MENU_SHARE = 0.2; // a menu letter = a fifth of a game letter

/** MODE multipliers on WINS (gameData ids). Menu typing pays no wins. FUSE FRENZY (×5, 5 min) is frenzy.js. */
export const MODE_MULT = Object.freeze({
  'word-bomb': 1,
  'category-blitz': 1,
  'word-race': 1.5,
  // THE LOCKED MODES PAY FOR THE LOCK (Andy oct13 "higher reward for the locked games needing level"): CHAIN (LV25)
  // was ×2, FUSE (LV50) was ×1 — the same as Word Bomb, so the harder gate paid nothing. Now ×4 / ×6 (FUSE's FRENZY ×5
  // still stacks on top).
  chain: 4,
  'sat-rush': 5,
  fuse: 6,
});
export function modeMult(mode) {
  const m = MODE_MULT[mode];
  return Number.isFinite(m) ? m : 1;
}

// GEMS (FINAL table)
export const ROLL_PRICE = 75;
export const DROP_CHANCE = 1 / 10; // Andy oct10 "we need more ways for users to get gems": was 1 / 15
export const DROP_MIN = 3;
export const DROP_MAX = 12;
export const BOT_WIN = 30; // Andy oct10 "make game modes give more gems": was 18
// Andy oct8: a bots-only win pays by the HARDEST bot beaten (MEDIUM stays the old flat 18).
export const BOT_WIN_BY_DIFF = Object.freeze({ easy: 15, medium: 30, hard: 60 }); // Andy oct10: was 8 / 18 / 30
export const PER_PLAYER_BEATEN = 15; // (season 1's table; season 2 pays the WINNER-TAKES-ALL pot below)
// Andy oct10 "a lot more for multiplayer … n × how many people playing for the winner to take all gems": a game with
// people in it pays its WINNER POT_PER_PLAYER × the people playing (you included); everyone else gets the pot's 0.
export const POT_PER_PLAYER = 30;
export function winnerPot(people) {
  const n = int0(people);
  return n >= 2 ? POT_PER_PLAYER * n : 0;
}
// WORD RACE pays SPEED (Andy oct10): 1 gem per 2 words a minute, every racer, capped.
export const RACE_GEMS_PER_WPM = 0.5;
export const RACE_SPEED_CAP = 40;
export function raceSpeedGems(wpm) {
  return Number.isFinite(wpm) && wpm > 0 ? Math.min(RACE_SPEED_CAP, Math.floor(wpm * RACE_GEMS_PER_WPM)) : 0;
}
export const STREAK_BONUS = 4; // flat, on every win that extends a streak (a win after a win)
export const LEVEL_UP = 0; // Andy oct11 "dont give gems for leveling up … the gems are coming in way too quickly" (was 3, Andy oct10) — the hook (v3/hooks gemsSwap.b) still tracks the climb's peak, pays nothing at 0
export const ACH_MIN = 40;
export const ACH_MAX = 200;

// MARKS (FINAL): the MAIN multiplier by tier (the part above ×1 is marks.js MARK_TIERS[t].bonus in season 2).
// GEAR OP (Andy oct9: "make the gear stats a bit more OP"): was ×1.25 / 1.5 / 2 / 3 / 5 — every tier's uplift ×1.6–2.25,
// steeper at the top (RARE +40% · EPIC +80% · LEGENDARY +180% · MYTHIC +400% · SECRET +900%).
// GEAR OP 2 (Andy oct13 "make gears more OP"): RARE ×1.5 · EPIC ×2.5 · LEGENDARY ×5 · MYTHIC ×15 · SECRET ×40 (was
// 1.4 / 1.8 / 3 / 10 / 25). RARE stops at +50% so the STAPLER's crit rate lands exactly on the 50% crit cap.
export const MARK_MULT = Object.freeze({ rare: 1.5, epic: 2.5, legendary: 5, mythic: 15, secret: 40 }); // Andy oct11 "its fine if gear stats are op": LEGENDARY+ back up to (at least) the live season's ×3 / ×10 / ×25 (GEAR OP oct9 had 2.8 / 5 / 10)

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
/** Is the r-th rebirth a JACKPOT (R5, R10, R15 …)? */
export function isJackpotRebirth(r) {
  const n = int0(r);
  return n >= REBIRTH_LATE_FROM && n % REBIRTH_JACKPOT_EVERY === 0;
}
/** The factor the r-th rebirth adds (r ≥ 1): ×3 to R4, then ×4 — ×15 on a JACKPOT rebirth. */
export function rebirthStep(r) {
  const n = int0(r);
  if (n < REBIRTH_LATE_FROM) return REBIRTH_STEP;
  return isJackpotRebirth(n) ? REBIRTH_JACKPOT : REBIRTH_STEP_LATE;
}
/** The product of every rebirth's step (R4 = 81, R5 = 81 × 15, R6 = × 4 …). Closed form, finite at any R. */
export function rebirthMult(rebirths) {
  const r = int0(rebirths);
  const early = Math.min(r, REBIRTH_LATE_FROM - 1);
  const jackpots = r >= REBIRTH_LATE_FROM ? Math.floor(r / REBIRTH_JACKPOT_EVERY) - Math.floor((REBIRTH_LATE_FROM - 1) / REBIRTH_JACKPOT_EVERY) : 0;
  const plain = r - early - jackpots;
  return fin(Math.pow(REBIRTH_STEP, early) * Math.pow(REBIRTH_JACKPOT, jackpots) * Math.pow(REBIRTH_STEP_LATE, plain));
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
/** Gems a rebirth pays: REBIRTH_GEMS_PER_R × the R it lands on (Andy oct11). */
export function rebirthGems(rcAfter) {
  return REBIRTH_GEMS_PER_R * int0(rcAfter) + (isJackpotRebirth(rcAfter) ? JACKPOT_GEMS : 0);
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
