// signInNudge.js — WHEN a SAVE-YOUR-PROGRESS sign-in prompt may show (nov21, Andy: "give more spaces to sign in with
// google … make things more user friendly"). One frequency cap for every place a guest is asked (SignInPrompt.jsx /
// SignInSheet.jsx):
//   * signed in, or Google not set up (authAvailable) → never (the callers check those; this file is the CAP only)
//   * ✕ / NOT NOW at a place → that place rests SNOOZE_MS (7 days); the THIRD no at a place retires it for good
//   * a one-off MOMENT (the results parade, the save-code card) also waits GAP_MS between showings, so a run of good games
//     never asks game after game
// PURE core + a guarded storage bridge. Kept under taw.seen.* — UI state: never in a save code, kept through a wipe
// (keepKeys.js KEEP_PREFIXES), so a reset never re-nags.

export const SIGNIN_SEEN_KEY = 'taw.seen.signin';
export const SNOOZE_MS = 7 * 24 * 3600 * 1000;
export const GAP_MS = 3 * 24 * 3600 * 1000;
export const MAX_NO = 3;
/** The places a guest is asked. `moment` places are one-off beats (GAP_MS between showings); the rest are quiet rows. */
export const PLACES = {
  board: { moment: false }, // LEADERBOARD: SAVE YOUR RANK
  profile: { moment: false }, // PROFILE: under your name
  parade: { moment: true }, // the results parade's last row, on a league promotion
  code: { moment: true }, // the WRITE DOWN YOUR CODE card (LV 15 · first rebirth · LV 50)
};

/** PURE: may `place` ask now? `seen` = the stored map { [place]: { no, at, shown } }. */
export function canAsk(place, seen, now = Date.now()) {
  const p = PLACES[place];
  if (!p) return false;
  const s = (seen && seen[place]) || {};
  const no = Number(s.no) || 0;
  if (no >= MAX_NO) return false;
  if (no > 0 && now - (Number(s.at) || 0) < SNOOZE_MS) return false;
  if (p.moment && s.shown && now - Number(s.shown) < GAP_MS) return false;
  return true;
}

/** PURE: the map after a NOT NOW at `place`. */
export function withNo(place, seen, now = Date.now()) {
  const s = (seen && seen[place]) || {};
  return { ...(seen || {}), [place]: { ...s, no: (Number(s.no) || 0) + 1, at: now } };
}

/** PURE: the map after `place` was shown (moments only start their gap). */
export function withShown(place, seen, now = Date.now()) {
  const s = (seen && seen[place]) || {};
  return { ...(seen || {}), [place]: { ...s, shown: now } };
}

export function readSeen(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(SIGNIN_SEEN_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
function writeSeen(v, storage = globalThis.localStorage) {
  try { storage.setItem(SIGNIN_SEEN_KEY, JSON.stringify(v)); } catch { /* blocked: asked again next time */ }
}
export const mayAsk = (place, storage) => canAsk(place, readSeen(storage));
export const sayNo = (place, storage) => writeSeen(withNo(place, readSeen(storage)), storage);
export const markShown = (place, storage) => writeSeen(withShown(place, readSeen(storage)), storage);
