// router.js — a tiny History-API router (0 KB deps) mapping clean paths to the app's views.
//
//   /               -> home (menu)
//   /word-bomb      -> menu with the Word Bomb mode dialog open
//   /category-blitz -> menu with the Category Blitz mode dialog open
//   /sat-rush       -> SAT Rush
//   /chain          -> CHAIN
//   /fuse           -> FUSE
//   /room/:code     -> join that room
//
// THE BRIDGE (why this is low-churn): the app's four entry-param readers (LAUNCH_INTENT,
// solo/config, cg/cgEntry, satRush/config) all read `location.search` at import time. Rather than
// touch all four, `bridgePathToSearch()` runs ONCE before they import (first line of main.jsx) and,
// for a known clean path, rewrites the URL to carry the equivalent query — so every existing reader
// works unchanged. After boot the app canonicalises the URL back to the clean path (see
// canonicalPathForView), keeping legacy query entries (?cg=1 / ?portal=1 / dev flags) untouched.

// THE ARTICLE / PLAY SPLIT (2026-09-16). /chain, /fuse and /sat-rush are STATIC landing pages in
// public/, and Vercel serves a static file BEFORE it applies the SPA rewrite — so in production
// those paths return the article and #root is never on the page (verified against typeaword.com).
// The app therefore plays at /<mode>/play, and the canonicalise effect in App.jsx puts THAT in the
// address bar, so a URL a player copies mid-run opens the game. The article keeps its own path,
// its 900+ words and its canonical.
const PATH_TO_QUERY = {
  '/sat-rush/play': 'satRush=1&satrush=1', // satRush/config reads satRush; LAUNCH_INTENT reads satrush
  '/chain/play': 'chain=1',
  '/fuse/play': 'fuse=1',
  // Pre-split share links. Unreachable in production (the static article wins) but they still
  // resolve on a client-side nav and on any host without public/<mode>/, so keep them working.
  '/sat-rush': 'satRush=1&satrush=1',
  '/chain': 'chain=1',
  '/fuse': 'fuse=1',
};

// Paths that render the MENU (home view). The view->path sync must NOT rewrite any of these to '/':
// they are valid, distinct landing URLs for the two multiplayer modes.
export const MENU_PATHS = new Set(['/', '/word-bomb', '/category-blitz']);

// The indexable content routes — what the sitemap lists. The /play paths are deliberately NOT here:
// index.html hard-codes <link rel="canonical" href="https://typeaword.com/">, so every /play URL
// self-canonicalises to the homepage and never competes with its own article in search.
export const ROUTE_PATHS = ['/', '/word-bomb', '/category-blitz', '/sat-rush', '/chain', '/fuse'];

// The paths that OPEN A GAME. One per solo mode; the two multiplayer modes have no solo deep link
// (you create or join a room), so their destination is the menu and they get no /play path.
export const PLAY_PATHS = ['/sat-rush/play', '/chain/play', '/fuse/play'];

// A view id (or a menu+dialog intent) -> the canonical clean path. Only these views own a URL;
// everything else (lobby/room-waiting/game/shop/stats/browse/credits/cg-arm) stays under the menu's
// '/' or the room path and is not deep-linkable on its own.
const VIEW_TO_PATH = {
  home: '/',
  'sat-rush': '/sat-rush/play',
  chain: '/chain/play',
  fuse: '/fuse/play',
};

// SAT/CHAIN/FUSE view ids come from their config modules; keep this in sync via the constants the
// app already exports. We accept the literal ids the app uses ('sat-rush' may differ) — resolved by
// the caller passing the actual view string, matched loosely below.
function normalizeRoomCode(raw) {
  return (raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

// Parse the CURRENT pathname into a route intent (used only for /room/:code, which carries data).
export function roomCodeFromPath(pathname = window.location.pathname) {
  const m = /^\/room\/([^/?#]+)/i.exec(pathname || '');
  return m ? normalizeRoomCode(decodeURIComponent(m[1])) : null;
}

// Run BEFORE the entry-param modules import (main.jsx's first statement). For a known clean path with
// no existing query, add the equivalent query via replaceState so the import-time readers see it.
// Idempotent and safe: a path that already has a query, or an unknown path, is left alone.
export function bridgePathToSearch() {
  if (typeof window === 'undefined') return;
  try {
    const { pathname, search } = window.location;
    // The extra params this clean path implies (query string, no leading '?').
    let pathQuery = PATH_TO_QUERY[pathname] || null;
    if (!pathQuery) {
      const code = roomCodeFromPath(pathname);
      if (code) pathQuery = `join=${encodeURIComponent(code)}`;
    }
    if (!pathQuery) return; // '/', /word-bomb, /category-blitz, or unknown: nothing to bridge
    // MERGE into any existing query (e.g. a share link's ?ref=share) rather than clobbering it, and
    // don't duplicate a param that's already present. The readers then see the route params they need
    // AND any legit extra query survives; the app canonicalises back to the clean path after boot.
    const merged = new URLSearchParams(search || '');
    const add = new URLSearchParams(pathQuery);
    let changed = false;
    for (const [k, v] of add) {
      if (!merged.has(k)) {
        merged.set(k, v);
        changed = true;
      }
    }
    if (!changed) return;
    window.history.replaceState(window.history.state, '', `${pathname}?${merged.toString()}`);
  } catch {
    /* history/location unavailable — the app still boots at '/' */
  }
}

// The clean path a given view should show in the URL. Unknown/transient views map to null (leave the
// URL as-is — e.g. stay on '/room/CODE' during lobby->room->game, and on '/' for menu overlays).
export function canonicalPathForView(view) {
  return Object.prototype.hasOwnProperty.call(VIEW_TO_PATH, view) ? VIEW_TO_PATH[view] : null;
}

// True if the current URL carries a legacy/embed/dev query we must NOT strip when canonicalising
// (CrazyGames ?cg=1, ?portal=1, and the SAT dev flags). Deep-link shares (?join/?daily/?satrush/etc.)
// ARE safe to canonicalise to a path.
export function hasStickyQuery(search = window.location.search) {
  try {
    const p = new URLSearchParams(search || '');
    return (
      p.get('cg') === '1' ||
      p.get('portal') === '1' ||
      p.has('stage') ||
      p.has('lineupx') ||
      p.has('tune') ||
      p.has('scene') ||
      p.has('freeze') ||
      p.has('lock')
    );
  } catch {
    return false;
  }
}

// Map a pathname to a menu/solo view intent for popstate (back/forward). Only the safe, client-side
// views are driven from history; multiplayer room/game/lobby paths are ignored (never re-driven from
// the back button, which would fight the WS/room lifecycle).
export function viewIntentFromPath(pathname = window.location.pathname) {
  if (MENU_PATHS.has(pathname)) return 'home';
  // Both forms: /<mode>/play is what the app writes, /<mode> is what a pre-split link carries.
  if (pathname === '/sat-rush/play' || pathname === '/sat-rush') return 'sat-rush';
  if (pathname === '/chain/play' || pathname === '/chain') return 'chain';
  if (pathname === '/fuse/play' || pathname === '/fuse') return 'fuse';
  return null; // /room/* and anything else: leave the app as-is
}
