// wordCount.js
// Lifetime "WORDS TYPED" counter for THIS device — every VALID word the local
// player themselves gets accepted, across all modes (Word Bomb, Category Blitz,
// SAT Rush). Persisted in localStorage. Same defensive idiom as visitHistory.js:
// every storage access is wrapped in try/catch, so a private-mode / storage-
// disabled browser just counts in memory for the session and never throws.
//
// FUTURE: this whole { v, total, byMode } blob is the exact unit a later
// Google-sign-in sync will MERGE (add the per-mode counts, take the max/union),
// which is why it stays small and versioned. It is CLIENT-EDITABLE — it lives in
// plain localStorage the user can rewrite at will — so any future leaderboard
// MUST use server-validated counts and NEVER trust this value.

const KEY = 'wa_words';
const VERSION = 1;
const MODES = ['word-bomb', 'category-blitz', 'sat-rush'];

// Simple listener set for live UI updates (the menu odometer). No React here.
const listeners = new Set();

function freshCount() {
  return {
    v: VERSION,
    total: 0,
    byMode: { 'word-bomb': 0, 'category-blitz': 0, 'sat-rush': 0 },
  };
}

// Coerce anything (missing, non-JSON, partial, negative, non-numeric) into a valid
// count object with zeros where a field is absent or garbage.
function normalize(raw) {
  const base = freshCount();
  if (!raw || typeof raw !== 'object') return base;
  if (Number.isFinite(raw.total) && raw.total >= 0) base.total = Math.floor(raw.total);
  if (raw.byMode && typeof raw.byMode === 'object') {
    for (const m of MODES) {
      const v = raw.byMode[m];
      if (Number.isFinite(v) && v >= 0) base.byMode[m] = Math.floor(v);
    }
  }
  return base;
}

export function readWordCount() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return freshCount();
    return normalize(JSON.parse(raw));
  } catch {
    return freshCount();
  }
}

function write(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    /* storage unavailable — the count lives only in memory for this session */
  }
}

// Increment total + the mode's slot by n (default 1) for accepted word(s), persist,
// and notify subscribers. An unknown mode still bumps total (nothing is silently
// lost) but has no byMode slot. Returns the new count object.
export function addWords(mode, n = 1) {
  if (!Number.isFinite(n) || n <= 0) return readWordCount();
  const cur = readWordCount();
  cur.total += Math.floor(n);
  if (Object.prototype.hasOwnProperty.call(cur.byMode, mode)) {
    cur.byMode[mode] += Math.floor(n);
  }
  write(cur);
  listeners.forEach((fn) => {
    try {
      fn(cur);
    } catch {
      /* a throwing listener must never break the others or the caller */
    }
  });
  return cur;
}

// Subscribe to changes (fires after each addWords with the new count). Returns an
// unsubscribe function. Used by the menu odometer for live updates.
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
