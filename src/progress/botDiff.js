// botDiff.js — the hardest bot a player beat (Andy oct8: bot-room rewards scale with the bots' skill). Tiny + pure
// so payout.js (wins) and v3/hooks.js (gems) share one rule without pulling each other in.
const RANK = { easy: 0, medium: 1, hard: 2 };
/** The hardest botDifficulty among `rivals` (a bot without one counts as MEDIUM, the server default); null = no bots. */
export function hardestBot(rivals) {
  let best = null;
  for (const r of Array.isArray(rivals) ? rivals : []) {
    if (!r || !r.isBot) continue;
    const d = RANK[r.botDifficulty] != null ? r.botDifficulty : 'medium';
    if (best == null || RANK[d] > RANK[best]) best = d;
  }
  return best;
}
