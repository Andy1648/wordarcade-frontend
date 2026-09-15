// chunkReload.js — self-healing for the "stale chunk after deploy" crash.
//
// THE FAILURE: every screen below the menu is a lazy() route (GameScreen, RoomScreen,
// StatsScreen, SatRushGame, …), so its code arrives as a hashed chunk fetched on demand.
// A tab opened BEFORE a deploy is holding the OLD index bundle, which names the OLD
// chunk hashes. Once the new build lands those files are gone, so the next route the
// player opens rejects with `TypeError: Failed to fetch dynamically imported module`
// — Sentry's #2 production error. Nothing is actually broken: the tab is simply
// pointing at a build that no longer exists, and ONE reload fixes it permanently.
//
// THE GUARD: a reload driven by a failing fetch is a reload loop waiting to happen —
// if the chunk is genuinely missing (a bad deploy, an offline device), reload-on-error
// would spin forever, and App.jsx idle-prefetches GameScreen/RoomScreen on every boot,
// so the error re-fires unprompted on each pass. So the reload is fired AT MOST ONCE
// PER TAB SESSION, gated on a sessionStorage flag written BEFORE location.reload().
// The flag is never cleared: a second failure in the same tab falls through to the
// normal error path (the Sentry boundary's crash screen with its own RELOAD button)
// rather than reloading again. sessionStorage — not localStorage — so closing the tab
// resets it, and a blocked/absent store means we never reload at all (we cannot prove
// we haven't already tried, and an unguarded reload is worse than the error).

// Bumping this key would re-arm the reload for every open tab — treat it as permanent.
const RELOAD_FLAG_KEY = 'taw.chunkReload';

// Every phrasing the browsers use for "that dynamic import didn't load". Chrome/Edge and
// Firefox and Safari each word it differently, and the Vite preload helper adds its own,
// so match on the family rather than one string. Kept deliberately narrow: a generic
// network TypeError ("Failed to fetch") must NOT trigger a reload — only a MODULE fetch.
const STALE_CHUNK_RE =
  /(failed|error)\s+(to\s+)?(fetch|load)(ing)?\s+(the\s+)?dynamic(ally)?\s+imported\s+module|importing a module script failed|error loading dynamically imported module/i;

/**
 * True if `err` is the stale-chunk failure (and not some other rejection). Accepts an
 * Error, a string, or an event-ish object — unhandledrejection reasons are not typed.
 */
export function isStaleChunkError(err) {
  if (!err) return false;
  const text = typeof err === 'string' ? err : `${err.message || ''} ${err.name || ''}`;
  return STALE_CHUNK_RE.test(text);
}

/**
 * Fire the one allowed reload. Returns true if a reload was actually started, false if
 * it was suppressed (already used this session, or no usable sessionStorage).
 * The flag is written BEFORE reload() so the next boot sees it even if reload is
 * synchronous — a write that lands after navigation begins would never persist.
 */
export function reloadOnceForStaleChunk() {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG_KEY)) return false; // already spent this tab's one retry
    sessionStorage.setItem(RELOAD_FLAG_KEY, '1');
  } catch {
    return false; // storage blocked → we can't guard the loop, so we don't reload
  }
  try {
    window.location.reload();
  } catch {
    return false;
  }
  return true;
}

/**
 * Wire the two ways a stale chunk surfaces:
 *   - `vite:preloadError` — Vite's own hook, dispatched on window when its preload helper
 *     can't fetch a chunk. preventDefault() stops Vite from re-throwing, since we're
 *     handling it. This fires for route chunks loaded through the generated helper.
 *   - `unhandledrejection` — the raw `import()` rejection for anything the helper didn't
 *     cover (React.lazy retries, a bare dynamic import). Filtered by isStaleChunkError so
 *     ordinary rejected promises are left alone and still reach Sentry.
 * Idempotent-ish and fully guarded: this must never be the thing that breaks startup.
 */
export function installChunkReloadGuard() {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    reloadOnceForStaleChunk();
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (isStaleChunkError(e && e.reason)) reloadOnceForStaleChunk();
  });
}
