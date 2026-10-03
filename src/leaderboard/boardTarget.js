// boardTarget.js — H2a: the maths behind the board's "you" card — the next place to aim for.
// Pure — no DOM, so node:test covers it.

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

/**
 * The line the hero card prints under your rank. `short` is the phone strip's wording
 * ("58 LV TO #8"); the full card says "58 LEVELS TO #8".
 */
export function targetLine(rows, me, { short = false } = {}) {
  if (!me) return '';
  if (Number(me.rank) === 1) return short ? 'HOLD #1' : 'YOU’RE #1. HOLD IT.';
  const t = nextTarget(rows, me);
  if (!t) return '';
  if (t.levels === 0) return short ? `TIED WITH #${t.rank}` : `LEVEL-TIED WITH #${t.rank} · MORE WORDS TAKE IT`;
  if (short) return `${t.levels} LV TO #${t.rank}`;
  return `${t.levels} LEVEL${t.levels === 1 ? '' : 'S'} TO #${t.rank}`;
}
