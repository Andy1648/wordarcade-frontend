// weeklyPrize.js — THE WEEKLY TOP 10 PAY GEMS (Andy oct12; migration 034_weekly_top10_gems.sql). PURE table + one lazy
// call: the board shows each THIS WEEK place's prize, and the menu asks the server once a page load whether a finished
// week owes this player one (public.lb_week_prize — paid once per player per week, server-side). A prize lands in the
// claims inbox as a 'weekprize' claim; claiming it pays through the one gem door (gemsCore, reason 'weekly').
import { LEADERBOARD_ENABLED, getSecret, rpc } from './client.js';
import { queueClaim } from '../progress/claims.js';

export { WEEK_PRIZES, weekPrize } from './weekPrizes.js';
/** "WEEKLY TOP 10 — #3 · 600 GEMS" claims for each prize the server returned (idempotent by week). */
export function queuePrizes(prizes) {
  let n = 0;
  for (const p of Array.isArray(prizes) ? prizes : []) {
    const gems = Math.max(0, Math.floor(Number(p && p.gems) || 0));
    const rank = Math.floor(Number(p && p.rank) || 0);
    if (!gems || !rank || !p.week) continue;
    if (queueClaim({ id: `week:${p.week}`, kind: 'weekprize', label: `WEEKLY TOP 10 — #${rank} · ${gems} GEMS`, meta: { gems, rank, week: String(p.week) } })) n += 1;
  }
  return n;
}
let asked = false;
/** Once a page load: ask lb_week_prize; before 034 runs (404) or offline it quietly does nothing. */
export async function claimWeekPrizes() {
  if (asked || !LEADERBOARD_ENABLED) return 0;
  asked = true;
  const secret = getSecret();
  if (!secret) return 0;
  try {
    const res = await rpc('lb_week_prize', { p_secret: secret });
    return queuePrizes(res && res.prizes);
  } catch {
    return 0;
  }
}
