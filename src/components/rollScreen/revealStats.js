// revealStats.js — what the ROLL REVEAL v2 stats extension says (PURE: RevealStats.jsx draws it, Reel.jsx sizes its
// plan from it). The MAIN number comes from the SAME source as every other place a gear is drawn — markRolls.mainTag
// (→ statText) with the live roll state — so the tile, the sheet, the reel, the reveal card and the extension can
// never disagree (revealStats.test.js).
import { mainTag, critStatsOf } from '../../progress/markRolls.js';
import { MAX_PIPS } from '../../progress/markRollsCore.js';
import { critLines } from '../../progress/critText.js';
import { splitTag, perkLines, perkCount, pipNext } from '../markCard/cardModel.js';

/** What the extension shows for a result (pure — also sizes its plan): { main, crit, perks, dupe, pips, next }. */
export function revealStatsOf(res, view) {
  if (!res) return null;
  const { num, kind } = splitTag(mainTag(res.markId, view));
  const crit = critLines(critStatsOf(res.markId, view));
  const perks = perkCount(res.markId) ? perkLines(res.markId) : [];
  const dupe = !!res.dupe;
  const pips = Math.max(0, Math.min(MAX_PIPS, Number(res.pips) || 0));
  const next = dupe ? (pips >= MAX_PIPS ? '★5 MAX' : pipNext({ have: res.have, need: res.need, pips })) : '';
  return { num, kind, crit, perks, dupe, pips, pipUp: !!res.pipUp, copies: res.copies || 0, next };
}

