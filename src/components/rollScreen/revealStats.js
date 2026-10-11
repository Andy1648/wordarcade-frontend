// revealStats.js — what the ROLL REVEAL v2 stats extension says (PURE: RevealStats.jsx draws it, Reel.jsx sizes its
// plan from it). The MAIN number comes from the SAME source as every other place a gear is drawn — markRolls.mainTag
// (→ statText) with the live roll state — so the tile, the sheet, the reel, the reveal card and the extension can
// never disagree (revealStats.test.js).
import { mainTag, substatsOf } from '../../progress/markRolls.js';
import { formatNum } from '../../format.js';
import { substatParts } from '../../progress/critText.js';
import { splitTag, perkLines, perkCount } from '../markCard/cardModel.js';

/** What the extension shows for a result (pure — also sizes its plan): { main, crit, perks, dupe, pips, next }. */
export function revealStatsOf(res, view) {
  if (!res) return null;
  const { num, kind } = splitTag(mainTag(res.markId, view));
  const crit = substatParts(substatsOf(res.markId, view)); // gear card v4: every substat line, crit first
  const perks = perkCount(res.markId) ? perkLines(res.markId) : [];
  const dupe = !!res.dupe;
  // gear card v4: no ★ any more — a duplicate pays its gems, and the line says so
  const pips = 0;
  const next = dupe && res.dupeGems > 0 ? `DUPLICATE +${formatNum(res.dupeGems)} GEMS` : '';
  return { num, kind, crit, perks, dupe, pips, pipUp: !!res.pipUp, copies: res.copies || 0, next };
}

