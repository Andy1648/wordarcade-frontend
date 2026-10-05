// gemsMigrate.js — the one-time GEMS starting grant (Andy oct5: "existing players get a fair starting GEMS amount
// based on their current roll progress. No one loses.").
//
// THE RULE (once per save, stamped in taw.gems `mig`):
//   rolls = floor(the wins you hold ÷ the old roll price), where the old price is LEGACY_ROLL_WORDS (72) words at
//           your rate — exactly what one roll cost the moment before GEMS (72 × the reference Word Bomb word, no
//           timed boosts, no mark: markRolls.refWordWins as it shipped).
//   a save that has MARK ROLLS open (LV10 reached, any rebirth, or a roll state) gets at least 1 roll's worth;
//   capped at START_CAP_ROLLS (100 rolls) so a huge balance doesn't turn into endless rolls;
//   gems = rolls × ROLL_PRICE_GEMS. A brand-new save gets 0 (its free starter roll is still waiting).
//   NOBODY LOSES: the wins stay where they are (they still buy KEY POWER and the shop) — the grant is on top.
//   The LEVEL_UP high-water mark starts at the save's peak level, so levels reached before GEMS never pay twice.
// RESTORED SAVES: saveBackup lists taw.gems in REMOVE_IF_ABSENT, so a restored blob without it gets its own grant
// on the next boot (from ITS wins), and a blob with it keeps its stamp.
import { xpPerWord, getRebirths, storedLevel } from './xp.js';
import { getWins, gameKey, WORD_LEN_REF } from './wins.js';
import { gemsMigrated, stampGemsMigrated, grantGems, ROLL_PRICE_GEMS } from './gemsCore.js';
import { peakLevel } from './peakLevel.js';
import { SEASON2 } from './season.js';

export const LEGACY_ROLL_WORDS = 72; // the last wins price of a roll, in words at your rate (Andy oct5)
export const START_CAP_ROLLS = 100;
export const ROLLS_OPEN_LEVEL = 10; // markRolls.ROLL_UNLOCK_LEVEL (not imported: that module is the lazy MARKS chunk)

/** The old wins price of one roll at this save's rate (≥ 1). */
export function legacyRollPrice() {
  let rate = 0;
  try {
    rate = xpPerWord({ mode: gameKey('wordBomb'), wordLength: WORD_LEN_REF, bonusMult: 1 }) / 10;
  } catch {
    rate = 0;
  }
  return Math.max(1, Math.round(LEGACY_ROLL_WORDS * (Number.isFinite(rate) && rate > 0 ? rate : 0)));
}

/** PURE: the starting grant in gems for { wins, price, rollsOpen }. */
export function startingGems({ wins = 0, price = 1, rollsOpen = false } = {}) {
  const w = Number.isFinite(wins) && wins > 0 ? wins : 0;
  const p = Number.isFinite(price) && price >= 1 ? price : 1;
  let rolls = Math.floor(w / p);
  if (rollsOpen) rolls = Math.max(1, rolls);
  rolls = Math.min(START_CAP_ROLLS, rolls);
  return rolls * ROLL_PRICE_GEMS;
}

function hasRollState() {
  try {
    return localStorage.getItem('taw.markRolls') != null;
  } catch {
    return false;
  }
}

/** Run once per save (main.jsx boot, after the economy migration). Returns the gems granted (0 when already run). */
export function migrateGems() {
  if (gemsMigrated()) return 0;
  // PROGRESSION v3 (SEASON2): the season's gems start at 0 (the reset's grant is phase 4) — stamp and stop.
  if (SEASON2) {
    stampGemsMigrated({ peak: storedLevel() });
    return 0;
  }
  const level = storedLevel();
  const peak = Math.max(level, peakLevel());
  const rollsOpen = peak >= ROLLS_OPEN_LEVEL || getRebirths() > 0 || hasRollState();
  const gems = startingGems({ wins: getWins(), price: legacyRollPrice(), rollsOpen });
  stampGemsMigrated({ peak });
  return gems > 0 ? grantGems(gems, 'start', { detail: 'start' }) : 0;
}
