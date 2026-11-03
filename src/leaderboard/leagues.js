// leagues.js — RANK LEAGUES (Andy nov2: "get rid of [titles] … just the rankings — like top x amount are a certain rank
// (this idea is from clash of clans but instead of trophies its just levels)"). Your league is the band your BOARD rank
// sits in — the board already orders ★ → R → LV, so it is "levels, not trophies". Fixed cutoffs sized for the live
// board (~650 claimed players + ~1850 bots ≈ 2500 rows): the top bands are scarce, the bottom ones wide.
// They COMPLEMENT the painted numbered seals (nameTier.js, #1–100): the seal prints your exact place, the league names
// the band — a board row wears the seal in the top 100 and the league badge past it, never both.
// Pure (no DOM): the menu plate, the profile, the board, the results and the tests all read it.

// best first: a lower index is a higher league. `top` = the last board place inside it.
export const LEAGUES = [
  { key: 'legend', name: 'LEGEND', top: 1 },
  { key: 'champion', name: 'CHAMPION', top: 10 },
  { key: 'titan', name: 'TITAN', top: 50 },
  { key: 'master', name: 'MASTER', top: 100 },
  { key: 'crystal', name: 'CRYSTAL', top: 300 },
  { key: 'gold', name: 'GOLD', top: 800 },
  { key: 'silver', name: 'SILVER', top: 1600 },
  { key: 'bronze', name: 'BRONZE', top: Infinity },
];

/** The league a board rank sits in, or null with no rank (an unclaimed name is UNRANKED). */
export function leagueOf(rank) {
  const r = Math.floor(Number(rank));
  if (!(r >= 1)) return null;
  return LEAGUES.find((l) => r <= l.top);
}

const leagueIndex = (rank) => {
  const l = leagueOf(rank);
  return l ? LEAGUES.indexOf(l) : LEAGUES.length;
};

/**
 * The league line crossed between two looks: { dir: 'up' | 'down', league } or null (same league, or no last look —
 * a first visit is not a promotion).
 */
export function leagueMove(from, to) {
  if (!(Number(from) >= 1) || !(Number(to) >= 1)) return null;
  const a = leagueIndex(from);
  const b = leagueIndex(to);
  if (a === b) return null;
  return { dir: b < a ? 'up' : 'down', league: leagueOf(to) };
}

/** The next league up from a rank: { league, places } (places to climb to get in), or null in LEGEND / unranked. */
export function nextLeague(rank) {
  const r = Math.floor(Number(rank));
  const i = leagueIndex(r);
  if (i <= 0 || i >= LEAGUES.length) return null;
  const up = LEAGUES[i - 1];
  return { league: up, places: r - up.top };
}
