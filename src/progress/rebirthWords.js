// rebirthWords.js — WORDS PER REBIRTH (Andy oct12, migration 035): a season-2 rebirth needs WORDS_PER_REBIRTH words
// played IN GAMES since the last rebirth (the per-mode mastery words — menu keys never count), so menu typing alone
// can't climb the board. The server is the judge (lb_rebirth refuses with reason 'words'); this mirrors it so the
// REBIRTH screen, the menu tile and AUTO REBIRTH say "PLAY N MORE WORDS" instead of offering a rebirth it would refuse.
import { MASTERY_MODES, masteryWords } from './mastery.js';
import { SEASON2 } from './season.js';

export const WORDS_PER_REBIRTH = 10; // = 037 WORDS_PER_RB (was 25 in 035; Andy oct13) (rebirthRules.js WORDS_PER_RB; rebirthWords.test.js pins it)
export const RB_WORDS_KEY = 'taw.s2.rbw0'; // lifetime game words at the last rebirth (absent = 0, like the server)

/** Every word played in a game, all modes (the board's lifetime_words). */
export function lifetimeGameWords() {
  let w = 0;
  for (const m of MASTERY_MODES) w += masteryWords(m) || 0;
  return w;
}
/** Game words since the last rebirth — after a reset (fewer words than the mark) every word since counts. */
export function wordsSinceRebirth() {
  const w = lifetimeGameWords();
  let w0 = 0;
  try { w0 = Math.max(0, Math.floor(Number(localStorage.getItem(RB_WORDS_KEY)) || 0)); } catch { w0 = 0; }
  return w < w0 ? w : w - w0;
}
/** How many more game words the next rebirth needs (0 = enough; always 0 outside season 2). */
export function rebirthWordsShort() {
  if (!SEASON2) return 0;
  return Math.max(0, WORDS_PER_REBIRTH - wordsSinceRebirth());
}
/** A rebirth landed: the count restarts here. */
export function markRebirthWords() {
  try { localStorage.setItem(RB_WORDS_KEY, String(lifetimeGameWords())); } catch { /* storage blocked */ }
}
