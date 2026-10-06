// v3/convert.js — THE SEASON 2 CONVERSION RULE (Andy oct6: "NO RESET … a one-time CONVERSION when SEASON2 flips").
// PURE, no imports, no storage: the same rule runs in the client at the flip (v3/season2Convert.js, from the
// player's local season-1 save), in the CI sim (claude/econ-oct2/loop-sim-v3.mjs --board, every real board row) and —
// for the two numbers the server stores — in 025_season2_convert.sql (rebirths + stars; convert.test.js pins the SQL
// constants against these).
//
//   KEPT AS-IS   username, LEVEL (the number — it becomes the v3 level on the 40·√L curve, its bar fraction too),
//                lifetime words / letters, lifetime WINS, marks, GEMS, achievements, records.
//   REBIRTHS     min(R, 10) — the season-2 ascend point.
//   ★ STARS      1 ★ per STARS_PER_EXCESS (10) rebirths above R10, floor — exactly the ★ a v3 player who ascends at
//                every R10 holds after the same number of rebirths (one ascension = 10 rebirths = 1 ★), never more.
//   POWER        from the season-1 KEY tier: floor(T × POWER_PER_KEY), at most POWER_CAP_BASE + POWER_CAP_PER_R × R'
//                (R' = the kept rebirths). Season-1 KEY tiers ran ~1 per rebirth up to T95 (R100); POWER is ×1.65 XP
//                a step, so an uncapped T95 would be ×10^20 — the cap holds every row at about the v3 median's POWER
//                for its rebirths (+1..2), the CI sim's HARD RULE.
//   WINS WALLET  kept, up to the price of the next POWER (powerCost(P)): season-1 wins are priced on ×5-a-rebirth
//                numbers (R29 earns 10^21 a word), and wins buy only POWER in v3 — an uncapped wallet re-buys
//                every POWER at once (CI sim: R29 → POWER 40+, ×10^9 the median's pace). Lifetime wins: as-is.
//
// The RATES were picked by the CI sim's HARD RULE on the real board (claude/econ-oct2/board-snapshot-oct6.json):
// nobody faster than 2× the median v3 pace, nobody more than 2 h of median play from their next rebirth. See the
// PR body / claude SEASON2-QUEUE for the per-row table.

export const ASCEND_AT = 10; // = econ.ASCEND_AT, rebirthRules.ASCEND_AT, lb_ascend
export const RATES = Object.freeze({
  STARS_PER_EXCESS: 10, // 1 ★ per 10 rebirths above R10 (floor) — R100 → ★9, R29 → ★1, R20 → ★1
  POWER_PER_KEY: 1.5, // POWER = floor(KEY tier × 1.5) …
  POWER_CAP_BASE: 1, // … at most 1 + 1 × R' (R'0 → P1, R'5 → P6, R'10 → P11)
  POWER_CAP_PER_R: 1,
});
// v3 POWER prices (= econ.js POWER_COST_BASE / POWER_COST_STEP, rounded as econ.powerCost) — duplicated so this
// module stays import-free for the SQL pin and the sim; convert.test.js pins them against econ.js.
export const POWER_COST_BASE = 100;
export const POWER_COST_STEP = 4.8;

const int0 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const num0 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Wins to buy POWER P → P+1 (econ.powerCost). */
export function powerPrice(power) {
  const v = POWER_COST_BASE * Math.pow(POWER_COST_STEP, int0(power));
  return v < 1e15 ? Math.round(v / 10) * 10 : v;
}

/** Rebirths kept: min(R, 10). */
export function keptRebirths(rebirths, rates = RATES) {
  void rates;
  return Math.min(int0(rebirths), ASCEND_AT);
}
/** ★ from the rebirths above R10: floor(excess / STARS_PER_EXCESS). */
export function starsFromRebirths(rebirths, rates = RATES) {
  const per = Number(rates.STARS_PER_EXCESS);
  if (!(per > 0) || !Number.isFinite(per)) return 0;
  return Math.floor(Math.max(0, int0(rebirths) - ASCEND_AT) / per);
}
/** POWER from the season-1 KEY tier, capped by the kept rebirths. */
export function powerFromKey(keyTier, keptR, rates = RATES) {
  const k = Number(rates.POWER_PER_KEY);
  const byKey = Number.isFinite(k) && k > 0 ? Math.floor(int0(keyTier) * k + 1e-9) : 0;
  const cap = Math.floor(num0(rates.POWER_CAP_BASE) + num0(rates.POWER_CAP_PER_R) * Math.min(int0(keptR), ASCEND_AT) + 1e-9);
  return Math.min(byKey, cap);
}

/**
 * THE RULE. `s1` = the season-1 save's numbers: { level, frac, rebirths, keyTier, stars, wins, winsLifetime, gems }.
 * `stars` = any ★ the season-1 row already holds (0 on today's board) — kept and added to.
 * Returns the season-2 starting state + what changed (the UPDATE card's lines).
 */
export function convertSave(s1 = {}, rates = RATES) {
  const R = int0(s1.rebirths);
  const rebirths = keptRebirths(R, rates);
  const starsAdded = starsFromRebirths(R, rates);
  const stars = int0(s1.stars) + starsAdded;
  const keyTier = int0(s1.keyTier);
  const power = powerFromKey(keyTier, rebirths, rates);
  const wallet = Math.floor(num0(s1.wins));
  const wins = Math.min(wallet, powerPrice(power));
  const level = Math.max(1, int0(s1.level));
  const f = Number(s1.frac);
  const frac = Number.isFinite(f) && f > 0 ? Math.min(f, 1 - 1e-9) : 0;
  return {
    level, frac, rebirths, stars, power, wins,
    winsLifetime: Math.floor(num0(s1.winsLifetime)),
    gems: int0(s1.gems),
    from: { rebirths: R, keyTier, wins: wallet, stars: int0(s1.stars) },
    starsAdded,
    rebirthsConverted: R - rebirths,
    winsCapped: wallet - wins,
  };
}

/** The server half (025_season2_convert.sql): { rebirths, stars } from the stored row. */
export function convertRow(row = {}, rates = RATES) {
  const R = int0(row.rebirths);
  return { rebirths: keptRebirths(R, rates), stars: int0(row.stars) + starsFromRebirths(R, rates) };
}
