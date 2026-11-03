// menuTitle.js — the TITLE your menu PROFILE plate shows: the plate you picked in SETTINGS (platePick.js), else your
// highest. Shared by the menu (Homepage) and the CUSTOMIZE frame try-on, which draws that same plate (design move 12).
import { V3 } from './season';
import { rankTitle } from './rank';
import { shownPlateIndex } from './platePick';

export function shownRankName(name) {
  const R = V3.ranks;
  if (!R || !R.RANKS_V3) return name;
  const at = R.RANKS_V3.findIndex((x) => x.name === name);
  return at < 0 ? name : R.RANKS_V3[shownPlateIndex(at)].name;
}
export const menuTitleName = (level) => shownRankName(rankTitle(level));
