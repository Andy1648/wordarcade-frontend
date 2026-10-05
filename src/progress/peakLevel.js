// peakLevel.js — the HIGHEST level this save ever reached (taw.records maxLevel; xp.doRebirth writes the run's
// peak before the level resets, Stats folds in the live level). Mode unlocks read it: under the Keyboard
// Escape loop every run ends in a rebirth, so reaching LV50 once opens CHAIN for good. Read straight from
// storage so the menu chunk doesn't pull records.js (and its rarity index).
import { s2Key } from './season.js'; // v3 (SEASON2): the season's own records

export function peakLevel() {
  try {
    const r = JSON.parse(localStorage.getItem(s2Key('taw.records')) || 'null');
    return r && Number.isFinite(r.maxLevel) ? r.maxLevel : 0;
  } catch {
    return 0;
  }
}
