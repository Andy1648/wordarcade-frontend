// playerName.js
// Shared player-name helpers for the flows that DON'T have a name-entry screen
// in front of them: Quick Play (one tap from the homepage) and the public-room
// browser (tap a row to join). Both need a name to send to the backend without
// stopping to ask, so we remember the last name the player used and fall back to
// a generated arcade handle the first time.
//
// The Create/Join lobby still collects a name explicitly; it just calls
// rememberName() on submit so Quick Play / Browse default to that same name.

const STORAGE_KEY = 'wa_playername';

const ADJECTIVES = [
  'NEON', 'TURBO', 'HYPER', 'CHAOS', 'PIXEL', 'GLITCH', 'VAPOR', 'CYBER',
  'RABID', 'FERAL', 'COSMIC', 'TOXIC', 'NITRO', 'MEGA', 'ULTRA', 'FUNKY',
];
const NOUNS = [
  'BANDIT', 'GOBLIN', 'RACCOON', 'WIZARD', 'NINJA', 'GREMLIN', 'PHANTOM',
  'YETI', 'KRAKEN', 'COMET', 'HORNET', 'BISON', 'VIPER', 'MAGPIE', 'DJINN',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// e.g. "NEONGOBLIN42" - capped under the backend's 20-char name limit.
export function randomPlayerName() {
  const n = Math.floor(Math.random() * 90) + 10; // 10-99
  return `${pick(ADJECTIVES)}${pick(NOUNS)}${n}`.slice(0, 20);
}

// The last name the player used, or '' if none stored / storage unavailable
// (private mode, etc. - never throw, just behave as if nothing was saved).
export function getStoredName() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

// Persist a name so the no-prompt flows can reuse it. No-ops on empty input or
// if storage is unavailable.
export function rememberName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    /* storage unavailable - the in-memory name still works for this session */
  }
}

// The name to use for a no-prompt join (Quick Play / Browse): the remembered
// one, or a fresh generated handle (which we also persist so it stays stable for
// the rest of the session).
export function resolvePlayerName() {
  const stored = getStoredName();
  if (stored) return stored;
  const generated = randomPlayerName();
  rememberName(generated);
  return generated;
}
