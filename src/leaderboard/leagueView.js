// leagueView.js — MY LEAGUE, the board's third tab (Andy: a section for your own league, so the board reads as climbable; the
// Clash shape: your league's own standings in their own view, with the next league as the goal, and the main board untouched).
// PURE: which board places your league spans, how far you are from the next one, and which rows to show.
import { LEAGUES, leagueOf } from './leagues.js';

/** How many places either side of you the tab asks for (a wide league like SILVER is 800 places: you see your stretch of it). */
export const LEAGUE_SPAN = 25;

/**
 * Your league as a stretch of board places: { league, lo, hi, next, toNext, fill } or null when unranked.
 * `hi` is null for the open-ended bottom league. `next` is the league above (null in LEGEND), `toNext` the places left to
 * get into it, and `fill` (0..1) how far up this league you are. BRONZE has no floor, so `total` (the board's size) stands
 * in for it; with no total yet the bar stays empty.
 */
export function leagueBand(rank, total = null) {
  const r = Math.floor(Number(rank));
  const league = leagueOf(r);
  if (!league) return null;
  const i = LEAGUES.indexOf(league);
  const next = i > 0 ? LEAGUES[i - 1] : null;
  const lo = next ? next.top + 1 : 1;
  const hi = Number.isFinite(league.top) ? league.top : null;
  const floor = hi != null ? hi : Math.max(r, Number(total) || 0);
  const size = floor - lo;
  const fill = !next ? 1 : hi == null && !(Number(total) >= r) ? 0 : size <= 0 ? 1 : Math.min(1, Math.max(0, (floor - r) / size));
  return { league, lo, hi, next, toNext: next ? r - next.top : 0, fill };
}

/** The rows of `around` inside your league, best first, with your own row always present (a failed read still shows you). */
export function leagueRows(around, me) {
  const band = me ? leagueBand(me.rank) : null;
  if (!band) return [];
  const seen = new Set();
  const out = [];
  for (const row of [...(Array.isArray(around) ? around : []), me]) {
    const n = Number(row && row.rank);
    if (!(n >= band.lo) || (band.hi != null && n > band.hi) || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out.sort((a, b) => Number(a.rank) - Number(b.rank));
}
