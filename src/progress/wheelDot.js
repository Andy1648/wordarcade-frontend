// wheelDot.js — the DAILY WHEEL's menu-eager sliver (the tile's dot). A LEAF: the table, the spin math and the pay door
// stay in wheel.js, which only the lazy panel loads (payload ratchet).
import { localDayIndex } from './streak.js';

export const WHEEL_KEY = 'taw.s2.wheel'; // { paid: [spin id …] (last 20), day: last spun day, streak }
export const WHEEL_CHANGE = 'taw:wheel-change';
/** The last LOCAL day index this save spun its free spin (0 = never). */
export function lastSpunDay() {
  try {
    const o = JSON.parse(localStorage.getItem(WHEEL_KEY) || 'null');
    return o && Number.isInteger(o.day) ? o.day : 0;
  } catch {
    return 0;
  }
}
/** Is today's free spin waiting (the menu tile's dot — local first; the panel asks the server)? */
export const wheelReady = (now = Date.now()) => lastSpunDay() < localDayIndex(now);
