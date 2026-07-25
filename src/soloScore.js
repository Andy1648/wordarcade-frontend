// soloScore.js
// The single source of truth for the number the solo / Daily Category Blitz
// results headline ("YOUR SCORE") must display, and the breakdown sum it must
// equal. Extracted as pure functions so the invariant "headline === sum of the
// per-round breakdown" is unit-testable without a DOM (the project's test runner
// is node --test with no jsdom).

/**
 * The authoritative headline score.
 *  - Daily runs: the score App derived + persisted for THIS run (daily.score),
 *    which is the round-sum. Never the (separately-mounted, possibly stale)
 *    `scoreTotal` prop — that mount-time value was rendering 0 while the
 *    breakdown showed the real total.
 *  - Solo (non-daily): the 3-round total, which is itself the round-sum.
 * Always a finite, non-negative number.
 */
export function soloHeadlineScore(scoreTotal, daily) {
  if (daily && Number.isFinite(daily.score)) return Math.max(0, daily.score);
  return Number.isFinite(scoreTotal) ? Math.max(0, scoreTotal) : 0;
}

/** Sum of the per-round breakdown scores (the number the headline must match). */
export function sumRoundScores(rounds) {
  return (rounds || []).reduce((s, r) => s + (Number(r && r.roundScore) || 0), 0);
}
