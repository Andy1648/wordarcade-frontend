// leagueRange.js — the board places each RANK LEAGUE spans, read off leagues.js's cutoffs (never written twice), and the one way
// a span is written ("RANKS 11–50"). Kept out of leagues.js so the menu (which reads leagueOf) doesn't carry the board's copy.
import { LEAGUES } from './leagues.js';
import { formatNum } from '../format.js';

/** The board places a league spans: { lo, hi } (hi null for the open-ended bottom league). */
export function leagueRange(league) {
  const i = LEAGUES.indexOf(league);
  if (i < 0) return null;
  return { lo: i > 0 ? LEAGUES[i - 1].top + 1 : 1, hi: Number.isFinite(league.top) ? league.top : null };
}

/** "RANK 1" · "RANKS 2–10" · "RANKS 1,601+" — the one way a league's span is written. */
export function rangeLabel(league) {
  const r = leagueRange(league);
  if (!r) return '';
  if (r.hi == null) return `RANKS ${formatNum(r.lo)}+`;
  return r.lo === r.hi ? `RANK ${formatNum(r.lo)}` : `RANKS ${formatNum(r.lo)}–${formatNum(r.hi)}`;
}
