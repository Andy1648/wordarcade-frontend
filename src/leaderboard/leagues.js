// leagues.js — RANK LEAGUES (Andy nov2: "get rid of [titles] … just the rankings — like top x amount are a certain rank
// (this idea is from clash of clans but instead of trophies its just levels)"). Your league is the band your BOARD rank
// sits in — the board already orders ★ → R → LV, so it is "levels, not trophies". Fixed cutoffs sized for the live
// board (~650 claimed players + ~1850 bots ≈ 2500 rows): the top bands are scarce, the bottom ones wide.
// ONE badge per league (Andy nov9: "there's a certain rank but then the icon on the left … just doesn't look like it. make
// it match"): every place a rank shows — a board row, the podium, the dividers, MY LEAGUE, the profile — wears its
// league's badge, and a row prints its exact place on the badge's empty plate. The old TOP 50 / TOP 25 seals are gone.
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

// The painted league badge set v3 (nov12, Andy "really go for the satisfying themes - newgrounds, anime, addiction"): one
// ChatGPT chat, best of four each, every league its OWN theme and each a louder silhouette than the one below - BRONZE a
// scrapper's bottle-cap, SILVER street blades, GOLD a high roller's dice + coins, CRYSTAL a frost wolf, MASTER an arcane
// third-eye sigil, TITAN a berserker oni, CHAMPION a crowned phoenix, LEGEND the ascended dragon king. Its centre is the
// league's own EMBLEM (readable by silhouette at row size); the place goes on the empty tab at its bottom edge (leaguePlate.js).
// Immutable art: a repaint gets a new filename (art-manifest).
export const LEAGUE_ART = Object.fromEntries(LEAGUES.map((l) => [l.key, `/lb/league3-${l.key}-v2.webp`]));

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
