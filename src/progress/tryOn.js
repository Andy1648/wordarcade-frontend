// tryOn.js — LOOKS TRY-ON (Andy oct26: "i want to playtest all the key looks"). Tapping a POP STYLE card in UPGRADES →
// LOOKS fires that style's REAL menu pop (MenuXpFx.letterPop + the popLooks dress / painted burst — the same pooled
// nodes, no copy of the effect) for every key or TYPE-pad tap, for TRY_MS. This module is the pure part: the window, the
// streak (the menu's own thresholds, so a mash grows the pop exactly like it does on the menu) and the +N the style
// would pay. Nothing here credits XP or touches the save.
import { xpPerInput } from './xp.js';
import { markXpBoost } from './letterXp.js';
import { letterPerkMult } from './markPerks.js';
import { boostMult } from './boost.js';
import { xpMultOf } from './shop.js';

export const TRY_MS = 10_000;
const STREAK_GAP_MS = 1200; // useXpCapture: a pause this long resets the streak

/** Streak tier 0..3 at 10 / 25 / 50 keys — the menu's (useXpCapture TIER_SCALES index). Mutates `st`. PURE otherwise. */
export function tryStreak(st, now) {
  if (now - st.lastTime > STREAK_GAP_MS) st.count = 0;
  st.count += 1;
  st.lastTime = now;
  return st.count >= 50 ? 3 : st.count >= 25 ? 2 : st.count >= 10 ? 1 : 0;
}

/** The +N one menu key would pay wearing `id` — the menu's readGain with this style's multiplier in place of the worn one. */
export function tryGain(id) {
  try {
    return xpPerInput({ mode: 'menu', markMult: markXpBoost() * letterPerkMult() * boostMult() * xpMultOf(id) });
  } catch {
    return 1;
  }
}

const KEYS = 'ASDFGHJKLQWERTYUIOPZXCVBNM';
/** The letter a TYPE-pad tap stands in for. */
export function padLetter(n) {
  return KEYS[Math.abs(Math.floor(n)) % KEYS.length];
}
