// wheelDot.js — the DAILY WHEEL's menu-eager sliver (the tile's dot). A LEAF: the table, the spin math and the pay door
// stay in wheel.js, which only the lazy panel loads (payload ratchet).
import { localDayIndex } from './streak.js';

export const WHEEL_KEY = 'taw.s2.wheel'; // { paid: [spin id …] (last 20), day: last spun day, streak }
export const WHEEL_CHANGE = 'taw:wheel-change';
/** EARNED SPINS (Andy nov4 "dont have daily spin for free … should be functionality"; 083_wheel_earned.sql): today's
 *  spin unlocks after this many GAME words since the last spin (= private.wheel_earn.words). Menu keys never count. */
export const WHEEL_WORDS = 15;
/** The lifetime game-word count today's spin needs, as the server last said (null = not known yet / a pre-083 server). */
export function wheelNeed() {
  try {
    const o = JSON.parse(localStorage.getItem(WHEEL_KEY) || 'null');
    return o && Number.isFinite(o.need) ? o.need : null;
  } catch {
    return null;
  }
}
/** The last LOCAL day index this save spun its free spin (0 = never). */
export function lastSpunDay() {
  try {
    const o = JSON.parse(localStorage.getItem(WHEEL_KEY) || 'null');
    return o && Number.isInteger(o.day) ? o.day : 0;
  } catch {
    return 0;
  }
}
/** Is today's spin waiting AND earned (the menu tile's dot — local first; the panel asks the server)? `words` = your
 *  lifetime game words (rebirthWords.lifetimeGameWords). An unknown need (never opened since 083) shows the dot once. */
export const wheelReady = (now = Date.now(), words = Infinity) => {
  if (lastSpunDay() >= localDayIndex(now)) return false;
  const need = wheelNeed();
  return need == null || words >= need;
};
