// weekPrizes.js — the WEEKLY TOP 10 prize table (Andy oct12), PURE (no imports) so the board and the tests read it alone.
/** #1 → #10 gems. KEEP IN SYNC with 034_weekly_top10_gems.sql WEEK_PRIZES (weeklyPrize.test.js pins the two together). */
export const WEEK_PRIZES = Object.freeze([1000, 750, 600, 500, 400, 350, 300, 250, 200, 150]);
/** The gems a THIS WEEK rank wins (0 outside the top 10). */
export function weekPrize(rank) {
  const r = Math.floor(Number(rank));
  return r >= 1 && r <= WEEK_PRIZES.length ? WEEK_PRIZES[r - 1] : 0;
}
