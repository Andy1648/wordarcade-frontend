// dailyBlitz/launch.js — how this page load arrived, read ONCE at import (before App's URL sync canonicalises
// the address bar and drops the query). Eager and tiny: App imports it for the launch intent; the lazy screen
// reads SHARE_ARRIVAL to count a share-driven visit (the `?s=share` tag on every DAILY BLITZ share link).
//   /daily, /daily/play -> router bridges to ?dailyblitz=1
function params() {
  try {
    return new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  } catch {
    return new URLSearchParams('');
  }
}
const P = params();

/** This load is a DAILY BLITZ deep link (open the game, skip the splash). */
export const DAILY_BLITZ_LAUNCH = P.get('dailyblitz') === '1';

/** This load came from a shared DAILY BLITZ result (`?s=share`). */
export const SHARE_ARRIVAL = P.get('s') === 'share';

export const DAILY_BLITZ_VIEW = 'daily-blitz';
