// boardVersions.js — H2a: the three board layouts a reviewer can flip between on ONE build, and the
// pure maths the board's "you" surfaces share (the next target above you).
//   ?lbv=a  PODIUM     top-3 on a podium (gold centre, silver left, bronze right), rows 4-10 below
//   ?lbv=b  BIG TABLE  one list scaled up hard, top-3 rows taller on flat medal fills
//   ?lbv=c  SPLIT      your own card as the hero beside the list
// Default is A. Pure — no DOM, so node:test covers it.

export const BOARD_VERSIONS = ['a', 'b', 'c'];

/** The ?lbv= value from a query string (or location.search), defaulting to 'a'. */
export function boardVersion(search) {
  try {
    const v = new URLSearchParams(search || '').get('lbv');
    const k = (v || '').trim().toLowerCase();
    return BOARD_VERSIONS.includes(k) ? k : 'a';
  } catch {
    return 'a';
  }
}

/**
 * The next place to aim for: the row directly above `me` on the loaded board. For an off-board
 * player (rank past the last row) that is the LAST loaded row — the way onto the board.
 * Returns null at #1 or when nothing above is loaded; otherwise
 *   { rank, levels } — levels = how many levels short (0 = level-tied, words decide).
 */
export function nextTarget(rows, me) {
  if (!me || !Array.isArray(rows) || rows.length === 0) return null;
  const myRank = Number(me.rank);
  if (!(myRank > 1)) return null;
  const above = rows
    .filter((r) => Number(r.rank) < myRank)
    .sort((a, b) => Number(b.rank) - Number(a.rank))[0];
  if (!above) return null;
  const levels = Math.max(0, (Number(above.level) || 0) - (Number(me.level) || 0));
  return { rank: Number(above.rank), levels };
}

/** The line the SPLIT hero prints under your rank. */
export function targetLine(rows, me) {
  if (!me) return '';
  if (Number(me.rank) === 1) return 'YOU’RE #1. HOLD IT.';
  const t = nextTarget(rows, me);
  if (!t) return '';
  if (t.levels === 0) return `LEVEL-TIED WITH #${t.rank} · MORE WORDS TAKE IT`;
  return `${t.levels} LEVEL${t.levels === 1 ? '' : 'S'} TO #${t.rank}`;
}
