// menuSecrets.js — FIVE discoverable MENU SECRETS (Job 9). The simulators all hide
// things; this gives the menu the same. NONE are hinted in the UI. Each fires ONCE,
// grants Wins, and returns a one-line STAMP the caller flashes.
//
// Pure + deterministic: the clock, RNG and storage are INJECTED, so every secret is
// unit-testable and a storage-blocked browser just re-arms them (no crash). The menu
// keystroke path (useXpCapture) feeds this onKey/onPop; nothing here touches the DOM.
//
// THE FIVE (see claude/secrets.md for the player-facing list):
//   1. TYPED WORD    — type "newgrounds" on the menu            → stamp "O.G."
//   2. RARE POP      — a 1-in-750 golden keystroke pop          → stamp "MIDAS TOUCH"
//   3. TIME OF DAY   — type anything at local 11:11 (am or pm)  → stamp "MAKE A WISH"
//   4. TYPING STREAK — 150 keystrokes, no gap > 1500ms          → stamp "TYPEWRITER"
//   5. PALINDROME    — type a 5+ letter palindrome (invented)   → stamp "BOTH WAYS"

const KEY = 'wa_menu_secrets';

// Reward + stamp per secret. Wins are flat one-time grants (small, so secrets are a
// wink, not an economy exploit — the biggest is 250, ~one good round).
export const SECRETS = {
  newgrounds: { id: 'newgrounds', wins: 150, stamp: 'O.G.', blurb: 'Typed the church that raised us.' },
  midas: { id: 'midas', wins: 100, stamp: 'MIDAS TOUCH', blurb: 'Caught the 1-in-750 golden pop.' },
  wish: { id: 'wish', wins: 111, stamp: 'MAKE A WISH', blurb: 'Typed at 11:11.' },
  typewriter: { id: 'typewriter', wins: 200, stamp: 'TYPEWRITER', blurb: '150 keys without a pause.' },
  palindrome: { id: 'palindrome', wins: 250, stamp: 'BOTH WAYS', blurb: 'Typed a word that reads both ways.' },
};

const MAGIC_WORD = 'newgrounds';
const RARE_POP_ODDS = 750; // 1 in N keystrokes carries a golden pop
const STREAK_TARGET = 150; // keystrokes…
const STREAK_MAX_GAP_MS = 1500; // …with no gap longer than this
const PALINDROME_MIN = 5;
const BUFFER_MAX = 16; // rolling window of recent letters

// A small curated palindrome set so "both ways" needs a REAL word, not "aaaaa".
const PALINDROMES = new Set(['level', 'rotor', 'kayak', 'radar', 'civic', 'refer', 'madam', 'tenet', 'stats', 'rotator', 'racecar', 'redder', 'reviver', 'deified', 'repaper', 'deed', 'noon', 'sagas']);

function loadFound(storage) {
  try {
    const raw = storage && storage.getItem ? storage.getItem(KEY) : null;
    const blob = raw ? JSON.parse(raw) : null;
    return blob && Array.isArray(blob.found) ? new Set(blob.found) : new Set();
  } catch {
    return new Set();
  }
}
function saveFound(storage, found) {
  try {
    if (storage && storage.setItem) storage.setItem(KEY, JSON.stringify({ found: [...found] }));
  } catch {
    /* storage blocked — the secret just re-arms; no crash */
  }
}

function isPalindrome(w) {
  if (w.length < PALINDROME_MIN) return false;
  if (PALINDROMES.has(w)) return true;
  // also accept any actually-symmetric 5+ letter run (so an unlisted real palindrome
  // still counts), but reject a single repeated letter ("aaaaa") which isn't a word.
  const rev = w.split('').reverse().join('');
  return w === rev && new Set(w).size >= 3;
}

/**
 * Create a stateful menu-secret detector.
 *   opts.now      () => ms         wall clock (injectable for tests)
 *   opts.rng      () => [0,1)       RNG for the rare pop (injectable)
 *   opts.storage  { getItem, setItem }  found-set persistence (injectable)
 * Returns { onKey(char), onPop(), found(id) }. onKey/onPop return a SECRET object
 * ({ id, wins, stamp, blurb }) the FIRST time a secret triggers, else null.
 */
export function createSecretDetector({ now = () => Date.now(), rng = Math.random, storage = null } = {}) {
  const found = loadFound(storage);
  let buffer = '';
  let streak = 0;
  let lastKeyAt = 0;

  function fire(id) {
    if (found.has(id)) return null;
    found.add(id);
    saveFound(storage, found);
    return SECRETS[id];
  }

  function onKey(rawChar) {
    const t = now();
    // ---- 4. TYPING STREAK ----
    streak = t - lastKeyAt <= STREAK_MAX_GAP_MS ? streak + 1 : 1;
    lastKeyAt = t;

    const ch = String(rawChar || '').toLowerCase();
    if (/^[a-z]$/.test(ch)) {
      buffer = (buffer + ch).slice(-BUFFER_MAX);
    }

    // ---- 3. TIME OF DAY — local 11:11 (am or pm) ----
    const d = new Date(t);
    if (d.getMinutes() === 11 && d.getHours() % 12 === 11) {
      const hit = fire('wish'); if (hit) return hit;
    }
    // ---- 1. TYPED WORD ----
    if (buffer.endsWith(MAGIC_WORD)) {
      const hit = fire('newgrounds'); if (hit) return hit;
    }
    // ---- 5. PALINDROME (invented) — check the trailing run of letters ----
    const run = (buffer.match(/[a-z]+$/) || [''])[0];
    for (let L = run.length; L >= PALINDROME_MIN; L--) {
      const cand = run.slice(run.length - L);
      if (isPalindrome(cand)) { const hit = fire('palindrome'); if (hit) return hit; break; }
    }
    // ---- 4. TYPING STREAK trigger ----
    if (streak >= STREAK_TARGET) {
      const hit = fire('typewriter'); if (hit) return hit;
    }
    return null;
  }

  // ---- 2. RARE POP — call once per menu keystroke pop; 1-in-750 is golden ----
  function onPop() {
    if (rng() < 1 / RARE_POP_ODDS) return fire('midas');
    return null;
  }

  return {
    onKey,
    onPop,
    found: (id) => found.has(id),
    _streak: () => streak,
  };
}
