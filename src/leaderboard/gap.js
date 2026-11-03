// THE GAP (Andy nov2 climb pick 1): how far YOUR row is from the row right above it, in the ONE stat that decides the
// order there — "+38 LV" when you share their ★ and rebirths, "+2 R" when they are a rebirth ahead. The board orders
// ★ → R → level (all-time, 022), +★ → +R → +levels (THIS WEEK gains, 024), or words (the pre-024 weekly view).
// `fill` is how much of that stat you already have (0..1), for the bar under the chase line.

import { formatNum } from '../format.js';

const n = (v) => Number(v) || 0;

function keysFor(tab, gains) {
  if (tab === 'week' && gains) return [['week_stars', '★'], ['week_rebirths', 'R'], ['week_levels', 'LV']];
  if (tab === 'week') return [['week_words', 'WORDS']];
  return [['stars', '★'], ['rebirths', 'R'], ['level', 'LV']];
}

/** { text: '+38 LV', fill: 0.62 } for the gap from `me` up to `rival`, or null when no stat separates them. */
export function gapTo(me, rival, tab = 'all', gains = true) {
  if (!me || !rival) return null;
  for (const [k, unit] of keysFor(tab, gains)) {
    const a = n(me[k]);
    const b = n(rival[k]);
    if (a === b) continue;
    if (a > b) return null; // ahead on the deciding stat — the board's order disagrees (a stale row); say nothing
    const d = b - a;
    return { text: `+${formatNum(d)} ${unit}`, fill: b > 0 ? Math.max(0, Math.min(1, a / b)) : 0 };
  }
  // every stat tied: the next level passes them
  const last = keysFor(tab, gains).slice(-1)[0];
  return { text: `+1 ${last[1]}`, fill: 0.98 };
}
