// nearMissData.js — gathers the live inputs for the pure nearMiss() (nearMiss.js) at an end screen.
// Read-only against the economy: level/frac (loadProgress), need (xp.need at the live power), the
// mode's per-word XP + wins (perWordRateNow), the bar floor, the next KEY tier vs the balance.
//
// THE RUN'S YIELD. Lifetime LETTERS (letters.js) only move on accepted GAME letters, so the letters
// gained between two end screens are exactly one run's worth. Each end screen diffs against the
// snapshot the previous one left in sessionStorage `taw.nm.start`, folds that run into a smoothed
// average (localStorage `taw.nm.avg`), and leaves a fresh snapshot for the next run. (The spec's
// snapshot "at run start" lives in App.jsx's launch path; the previous end screen is the same
// moment for back-to-back play and keeps this out of App.) With no history yet the average falls
// back to wins.js TYPICAL_ROUND_WORDS — the same representative round the menu cards quote.
// No board read: claimed players have no cached row above them yet, so the board candidate stays
// off here (nearMiss() supports it when a caller has one).
import { loadProgress, need, getKeyTier, keyTierCost } from './xp.js';
import { getWins, perWordRateNow, TYPICAL_ROUND_WORDS } from './wins.js';
import { getLetters } from './letters.js';
import { floorFrac } from './barFloor.js';
import { nearMiss, nextAvg, LETTERS_PER_WORD } from './nearMiss.js';

export const NM_START_KEY = 'taw.nm.start'; // sessionStorage: lifetime letters at the start of this run
export const NM_AVG_KEY = 'taw.nm.avg'; // localStorage: smoothed letters per run

function readNum(store, key) {
  try {
    const v = Number(store.getItem(key));
    return store.getItem(key) != null && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
function writeNum(store, key, v) {
  try { store.setItem(key, String(v)); } catch { /* blocked */ }
}

/** Fold the run that just ended into the average; returns the average letters per run (0 = none). */
export function noteRunEnd() {
  const now = getLetters();
  const start = typeof sessionStorage !== 'undefined' ? readNum(sessionStorage, NM_START_KEY) : null;
  const prev = typeof localStorage !== 'undefined' ? readNum(localStorage, NM_AVG_KEY) : null;
  let avg = prev || 0;
  if (start != null && now > start) {
    avg = nextAvg(prev, now - start);
    if (typeof localStorage !== 'undefined') writeNum(localStorage, NM_AVG_KEY, Math.round(avg * 10) / 10);
  }
  if (typeof sessionStorage !== 'undefined') writeNum(sessionStorage, NM_START_KEY, now);
  return avg;
}

/** The end screen's line for `mode` (gameData id), or null. Never throws. */
export function nearMissNow(mode) {
  try {
    const avgLetters = noteRunEnd();
    const avgWords = avgLetters > 0 ? avgLetters / LETTERS_PER_WORD : TYPICAL_ROUND_WORDS;
    const { level, frac } = loadProgress();
    const rate = perWordRateNow({ mode });
    const tier = getKeyTier();
    return nearMiss({
      level,
      frac,
      need,
      xpPerWord: rate.xp,
      floorFrac,
      avgWords,
      key: { tier, cost: keyTierCost(tier), balance: getWins(), rate: rate.rate },
    });
  } catch {
    return null;
  }
}
