// visitHistory.js
// Tiny localStorage helpers that tell a returning visitor from a new SESSION.
// Two independent signals:
//   - intro / session:  the intro (LoadingScreen → splash → "TYPE FAST. DIE SLOW."
//                        → knife split) replays once per SESSION, where a session
//                        boundary is 30+ minutes of ABSENCE from the site (the same
//                        inactivity window GA uses to close a session). We store a
//                        last-seen timestamp (wa_last_seen, epoch ms) and treat the
//                        intro as "already seen this session" only while that stamp
//                        is younger than INTRO_COOLDOWN_MS. The stamp is refreshed on
//                        every app load and on pagehide/beforeunload, so the 30
//                        minutes measure absence from the SITE, not time since the
//                        intro — a refresh after a long play session must NOT replay
//                        it. Replaying the intro each session also guarantees music
//                        at the menu, since the splash's CLICK ANYWHERE TO START is
//                        the audio-unlock gesture.
//   - has played:       drives the default difficulty (first-timers get the gentler
//                        CHILL tier; returning players keep CRAZY).
// Every read/write is wrapped so private-mode / storage-disabled browsers simply
// behave as a first-time visitor rather than throwing.

const LAST_SEEN_KEY = 'wa_last_seen'; // epoch ms of the visitor's most recent presence
const LEGACY_INTRO_KEY = 'wa_intro_seen'; // the old permanent flag — removed on migration
const PLAYED_KEY = 'wa_has_played'; // set once the player has started a game

// A session boundary: 30 minutes of absence from the site replays the intro.
export const INTRO_COOLDOWN_MS = 30 * 60 * 1000;

function readFlag(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* storage unavailable - stay in first-time behaviour, no harm done */
  }
}

// Stamp "the visitor is present right now". Also clears the legacy permanent flag so
// existing visitors fully migrate off it. Guarded like every other storage access.
export function stampLastSeen() {
  try {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    localStorage.removeItem(LEGACY_INTRO_KEY);
  } catch {
    /* storage unavailable - nothing to remember, first-time behaviour */
  }
}

// True only if the visitor was last seen LESS than the cooldown ago — i.e. still
// within the current session, so the intro should be skipped. A missing/garbage
// value, or the legacy '1' / date-string formats, are NOT a valid recent timestamp
// and count as NOT seen, so an existing visitor gets the intro once more and then
// migrates to the timestamp scheme on the next stamp.
export function hasSeenIntro() {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    if (raw == null) return false;
    const then = Number(raw);
    if (!Number.isFinite(then)) return false;
    return Date.now() - then < INTRO_COOLDOWN_MS;
  } catch {
    return false;
  }
}

// The raw last-seen timestamp (epoch ms), or 0 if absent/invalid. Read at MODULE LOAD by the
// return-bonus (Job 6) BEFORE the app re-stamps it, so "how long were you away" survives the load.
export function getLastSeen() {
  try {
    const n = Number(localStorage.getItem(LAST_SEEN_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

// The intro just finished (or the session is being (re)stamped): record now.
export function markIntroSeen() {
  stampLastSeen();
}

export function hasPlayedBefore() {
  return readFlag(PLAYED_KEY);
}

export function markPlayed() {
  writeFlag(PLAYED_KEY);
}
