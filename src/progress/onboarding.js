// onboarding.js — one-time first-run spotlight flags.
//
// TWO independent things:
//   1. The MENU XP-bar spotlight — shown ONCE ever (single boolean flag). If storage is blocked
//      we treat it as ALREADY SEEN so a new-tab-per-visit / private-mode player is never nagged.
//   2. The FIRST-ENTRY GAME spotlight — now shown ONCE PER MODE (feat/game-onboarding). Each game
//      mode (chain / fuse / word-bomb / category-blitz / sat-rush) gets its own one-line rule the
//      first time the player reaches that mode's play screen. `taw.seenGameSpotlight` was a single
//      shared flag ('1'); it is repurposed to a JSON ARRAY of the mode ids already seen. A legacy
//      '1' value (an upgrader who saw the old single spotlight) is discarded so the richer per-mode
//      rules show once each. If storage is blocked or corrupt we DEGRADE to "show once this
//      session" via an in-memory Set — never nag every visit, never wedge.

const MENU_KEY = 'taw.seenMenuSpotlight';
const GAME_KEY = 'taw.seenGameSpotlight';

// ── Menu spotlight (single boolean) ───────────────────────────────────────────
function readBool(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return true; // storage blocked → behave as "already seen" (never show, never block)
  }
}
function markBool(key) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* storage blocked — nothing to persist */
  }
}

export const hasSeenMenuSpotlight = () => readBool(MENU_KEY);
export const markMenuSpotlightSeen = () => markBool(MENU_KEY);

// ── Per-mode game spotlight (set of mode ids) ─────────────────────────────────
// In-memory fallback so a storage-blocked player still sees each mode's spotlight
// AT MOST once per session (not on every mount, not every visit).
const sessionSeen = new Set();

// Returns a Set of seen mode ids, or null when storage is unavailable/unreadable.
function readSeenModes() {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw || raw === '1') return new Set(); // empty or the legacy shared flag → fresh per-mode
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return null; // storage blocked or value corrupt → caller uses the session fallback
  }
}

export function hasSeenGameSpotlight(mode) {
  if (!mode) return true; // no mode id → never show (guard: nothing to key persistence on)
  const seen = readSeenModes();
  if (seen === null) return sessionSeen.has(mode); // storage blocked → session-only memory
  return seen.has(mode) || sessionSeen.has(mode);
}

export function markGameSpotlightSeen(mode) {
  if (!mode) return;
  sessionSeen.add(mode); // always remember for this session (covers the storage-blocked path)
  const seen = readSeenModes();
  if (seen === null) return; // storage blocked → session Set above is the only record
  seen.add(mode);
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify([...seen]));
  } catch {
    /* storage blocked mid-write — session Set already updated */
  }
}
