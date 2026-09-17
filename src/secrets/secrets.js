// secrets.js — FIVE discoverable SECRETS. The simulators all hide things; this gives the
// game the same. NONE are hinted in the UI. Each fires ONCE and grants Wins.
//
// RENAMED FROM menuSecrets.js (feat/cut-secrets-rarity). Nothing in this file changed — same five,
// same thresholds, same storage key, same tests. What changed is WHERE it is fed from and WHAT the
// caller does with a hit: these used to fire on the MENU and be announced by a centre-screen
// sticker over a backdrop, a one-off popup mid-aim that could swallow the click meant for the card
// behind it. They now fire while you PLAY and surface at the word you just typed
// (components/WordLanding, via secrets/useWordSecrets). The file's name was the only thing left
// claiming it was about the menu.
//
// Pure + deterministic: the clock, RNG and storage are INJECTED, so every secret is
// unit-testable and a storage-blocked browser just re-arms them (no crash). The menu
// keystroke path feeds this onKey/onPop/onIdle; nothing here touches the DOM.
//
// A hit carries `detail` (the matched word, uppercased, or null) plus the running
// found / total so the caller can render "SECRET FOUND · 2 / 5" and a story blurb whose
// {d} placeholder is the detail. Blurbs are the player-facing copy — keep them one line.
//
// THE FIVE (see claude/secrets.md for the player-facing list):
//   1. TYPED WORD    — type "newgrounds" while playing          → stamp "O.G."
//   2. RARE POP      — a 1-in-750 golden ACCEPTED WORD           → stamp "MIDAS TOUCH"
//   3. TIME OF DAY   — type anything at local 11:11 (am or pm)  → stamp "MAKE A WISH"
//   4. TYPING STREAK — 150 keystrokes, no gap > 1500ms          → stamp "TYPEWRITER"
//   5. PALINDROME    — type a 5+ letter palindrome (invented)   → stamp "BOTH WAYS"
//                      judged at the WORD BOUNDARY (a non-letter key, or ~700ms idle via
//                      onIdle) — never mid-word, so RACECAR can't fire early on "ACECA".

const KEY = 'wa_menu_secrets';

// Reward + stamp per secret. Wins are flat one-time grants (small, so secrets are a
// wink, not an economy exploit — the biggest is 250, ~one good round).
export const SECRETS = {
  newgrounds: { id: 'newgrounds', wins: 150, stamp: 'O.G.', blurb: 'You typed {d} — the church that raised us.' },
  midas: { id: 'midas', wins: 100, stamp: 'MIDAS TOUCH', blurb: 'You caught the 1-in-750 golden pop.' },
  wish: { id: 'wish', wins: 111, stamp: 'MAKE A WISH', blurb: 'You typed at exactly 11:11.' },
  typewriter: { id: 'typewriter', wins: 200, stamp: 'TYPEWRITER', blurb: '150 keys without stopping once.' },
  palindrome: { id: 'palindrome', wins: 250, stamp: 'BOTH WAYS', blurb: 'You typed {d} — it reads the same backwards.' },
};

const MAGIC_WORD = 'newgrounds';
const RARE_POP_ODDS = 750; // 1 in N keystrokes carries a golden pop
const STREAK_TARGET = 150; // keystrokes…
const STREAK_MAX_GAP_MS = 1500; // …with no gap longer than this
const PALINDROME_MIN = 5;
const BUFFER_MAX = 16; // rolling window of recent letters
// e.key names that never END a word (a capitalised "Racecar" is still one word). Anything
// else that isn't a single letter — space, Enter, Backspace, punctuation, digits — is a
// word boundary and closes the current palindrome candidate.
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph', 'Fn', 'OS', 'Dead', 'Unidentified']);

// A small curated palindrome set so "both ways" needs a REAL word, not "aaaaa".
const PALINDROMES = new Set(['level', 'rotor', 'kayak', 'radar', 'civic', 'refer', 'madam', 'tenet', 'stats', 'rotator', 'racecar', 'redder', 'reviver', 'deified', 'repaper', 'deed', 'noon', 'sagas']);

/**
 * The five as a COLLECTION, for the Stats board — which is the only place they appear now that the
 * centre-screen sticker is gone. An unfound secret is a silhouette: its name is masked, because a
 * secret you have been told about is not one. What IS shown is that it exists and that you are
 * missing it, which is the whole reason a collection reads differently from a random popup.
 */
export function secretsCollection(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  const found = loadFound(storage);
  const ids = Object.keys(SECRETS);
  return {
    found: ids.filter((id) => found.has(id)).length,
    total: ids.length,
    items: ids.map((id) => ({
      id,
      earned: found.has(id),
      name: found.has(id) ? SECRETS[id].stamp : '???',
      blurb: found.has(id) ? SECRETS[id].blurb.replace('{d}', 'it') : 'UNDISCOVERED',
    })),
  };
}

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
 * Returns { onKey(char), onPop(), onIdle(), found(id) }. onKey/onPop/onIdle return a hit
 * ({ ...SECRET, detail, found, total }) the FIRST time a secret triggers, else null.
 * onIdle is the caller's "typing paused" signal — it closes the current word for the
 * palindrome check; onKey closes it on any non-letter, non-modifier key.
 */
export function createSecretDetector({ now = () => Date.now(), rng = Math.random, storage = null } = {}) {
  const found = loadFound(storage);
  const TOTAL = Object.keys(SECRETS).length;
  let buffer = ''; // rolling recent letters (the MAGIC_WORD window)
  let word = ''; // letters since the last word boundary (the palindrome candidate)
  let streak = 0;
  let lastKeyAt = 0;

  function fire(id, detail) {
    if (found.has(id)) return null;
    found.add(id);
    saveFound(storage, found);
    return { ...SECRETS[id], detail: detail || null, found: found.size, total: TOTAL };
  }

  // ---- 5. PALINDROME — the CURRENT WORD, judged only when the word is closed ----
  // Tests the word's trailing runs from longest to shortest so a real palindrome at the
  // end of a longer run still counts, but NOTHING is judged until the player stops typing
  // or breaks the word — "aceca" halfway through "racecar" never fires.
  function checkPalindrome() {
    for (let L = word.length; L >= PALINDROME_MIN; L--) {
      const cand = word.slice(word.length - L);
      if (isPalindrome(cand)) return fire('palindrome', cand.toUpperCase());
    }
    return null;
  }

  function onKey(rawChar) {
    const t = now();
    // ---- 4. TYPING STREAK ----
    streak = t - lastKeyAt <= STREAK_MAX_GAP_MS ? streak + 1 : 1;
    lastKeyAt = t;

    const raw = String(rawChar || '');
    const ch = raw.toLowerCase();
    let boundaryHit = null;
    if (/^[a-z]$/.test(ch)) {
      buffer = (buffer + ch).slice(-BUFFER_MAX);
      word = (word + ch).slice(-BUFFER_MAX);
    } else if (!(raw.length > 1 && MODIFIER_KEYS.has(raw))) {
      // a non-letter key closes the word: judge it, then start fresh
      boundaryHit = checkPalindrome();
      word = '';
    }

    // ---- 3. TIME OF DAY — local 11:11 (am or pm) ----
    const d = new Date(t);
    if (d.getMinutes() === 11 && d.getHours() % 12 === 11) {
      const hit = fire('wish'); if (hit) return hit;
    }
    // ---- 1. TYPED WORD ----
    if (buffer.endsWith(MAGIC_WORD)) {
      const hit = fire('newgrounds', MAGIC_WORD.toUpperCase()); if (hit) return hit;
    }
    // ---- 5. PALINDROME — only on the boundary key (see checkPalindrome / onIdle) ----
    if (boundaryHit) return boundaryHit;
    // ---- 4. TYPING STREAK trigger ----
    if (streak >= STREAK_TARGET) {
      const hit = fire('typewriter'); if (hit) return hit;
    }
    return null;
  }

  // ---- 2. RARE POP — call once per ACCEPTED WORD; 1-in-750 is golden ----
  function onPop() {
    if (rng() < 1 / RARE_POP_ODDS) return fire('midas');
    return null;
  }

  // ---- typing paused — the other word boundary. The hook calls this ~700ms after the
  // last keydown so a word the player simply stops on (no space/enter) is still judged.
  // The word is NOT cleared: a pause mid-word ("race" … "car") still completes to RACECAR.
  function onIdle() {
    return checkPalindrome();
  }

  return {
    onKey,
    onPop,
    onIdle,
    found: (id) => found.has(id),
    _streak: () => streak,
  };
}
