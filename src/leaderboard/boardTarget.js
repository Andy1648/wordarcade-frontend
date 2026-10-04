// boardTarget.js — H2a: the maths behind the board's "you" card — the next place to aim for.
// Pure — no DOM, so node:test covers it.
import { formatNum } from '../format.js';

/**
 * A board row's headline, in the board's order (Andy oct3 19:55: REBIRTHS first, then level):
 * "R8 · LV16"; an R0 player shows just "LV16". Every number through formatNum.
 */
export function standingText(rebirths, level) {
  const r = Math.max(0, Math.floor(Number(rebirths) || 0));
  const lv = `LV${formatNum(Math.max(1, Math.floor(Number(level) || 1)))}`;
  return r > 0 ? `R${formatNum(r)} · ${lv}` : lv;
}

/**
 * The next place to aim for: the row directly above `me` on the loaded board. For an off-board
 * player (rank past the last row) that is the LAST loaded row — the way onto the board.
 * Returns null at #1 or when nothing above is loaded; otherwise
 *   { rank, rebirths, levels } — the board ranks REBIRTHS first: rebirths = how many rebirths short
 *   (> 0 → levels is 0, the level gap means nothing until the rebirths match); else levels = how many
 *   levels short (0 = tied, words decide).
 */
export function nextTarget(rows, me) {
  if (!me || !Array.isArray(rows) || rows.length === 0) return null;
  const myRank = Number(me.rank);
  if (!(myRank > 1)) return null;
  const above = rows
    .filter((r) => Number(r.rank) < myRank)
    .sort((a, b) => Number(b.rank) - Number(a.rank))[0];
  if (!above) return null;
  const rebirths = Math.max(0, (Number(above.rebirths) || 0) - (Number(me.rebirths) || 0));
  const levels = rebirths > 0 ? 0 : Math.max(0, (Number(above.level) || 0) - (Number(me.level) || 0));
  return { rank: Number(above.rank), rebirths, levels };
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
  // every number through formatNum (no raw long digits on the board)
  const rank = formatNum(t.rank);
  const levels = formatNum(t.levels);
  if (t.rebirths > 0) {
    const rb = formatNum(t.rebirths);
    return short ? `${rb} RB TO #${rank}` : `${rb} REBIRTH${t.rebirths === 1 ? '' : 'S'} TO #${rank}`;
  }
  if (t.levels === 0) return short ? `TIED WITH #${rank}` : `LEVEL-TIED WITH #${rank} · MORE WORDS TAKE IT`;
  if (short) return `${levels} LV TO #${rank}`;
  return `${levels} LEVEL${t.levels === 1 ? '' : 'S'} TO #${rank}`;
}
