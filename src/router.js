// router.js — a tiny History-API router (0 KB deps) mapping clean paths to the app's views.
//
//   /                -> home (menu)
//   /word-bomb       -> static landing page (SEO)   |  /word-bomb/play       -> Word Bomb vs a bot
//   /category-blitz  -> static landing page (SEO)   |  /category-blitz/play  -> Blitz vs a bot
//   /sat-rush        -> static landing page (SEO)   |  /sat-rush/play        -> SAT Rush
//   /chain           -> static landing page (SEO)   |  /chain/play           -> CHAIN
//   /fuse            -> static landing page (SEO)   |  /fuse/play            -> FUSE
//   /room/:code      -> join that room
//
// WHY THE `/play` SPLIT (the bug this fixes): each mode has a static landing page at
// `public/<mode>/index.html`. On Vercel the FILESYSTEM WINS over `rewrites`, so /chain serves that
// HTML file and the SPA NEVER SEES THE PATH — the old `'/chain' -> ?chain=1` bridge was dead code in
// production. A cold visitor following a /chain link got the landing page (fine), and a /chain/play
// link fell through the SPA rewrite to an app that had no idea what /chain/play meant: no bridged
// query, no launch intent, so the full splash -> menu chain played and the mode was never reached.
// The bare path is now the CRAWLABLE page and `<mode>/play` is the PLAYABLE deep link; they can no
// longer shadow each other. `src/routeShadow.test.js` asserts that separation stays true.
//
// (The bare paths are KEPT in the tables below as a FALLBACK ONLY — in production the SPA cannot
// receive them. They matter if a landing page is ever removed, and they keep old shared links working
// in dev/preview. Never rely on them as the play path.)
//
// THE BRIDGE (why this is low-churn): the app's four entry-param readers (LAUNCH_INTENT,
// solo/config, cg/cgEntry, satRush/config) all read `location.search` at import time. Rather than
// touch all four, `bridgePathToSearch()` runs ONCE before they import (first line of main.jsx) and,
// for a known clean path, rewrites the URL to carry the equivalent query — so every existing reader
// works unchanged. After boot the app canonicalises the URL back to the clean path (see
// canonicalPathForView), keeping legacy query entries (?cg=1 / ?portal=1 / dev flags) untouched.
//
// THE SPLASH, ON A DEEP LINK: skipped entirely. The splash exists to introduce someone who arrived
// at the FRONT DOOR with no idea what this is; a player who tapped a link to a specific mode has
// already been introduced — by the landing page, the share card, or whoever sent it. The mode's own
// first-run teach does the rest. App.jsx's SKIP_INTRO already covers every launch intent, so the
// bridged query below is the whole mechanism: no launch intent, no skip.
//
// THE TWO MULTIPLAYER MODES need a room before there is anything to land in, so /word-bomb/play and
// /category-blitz/play bridge to `?play=<mode>`, which provisions a private room + a bot and starts
// the round with no clicks — the same four frames the CrazyGames zero-click entry already uses
// (App.jsx, cg/cgEntry.js), minus the arm gesture. A stranger gets a game, not a lobby to figure out.

// The mode ids that own a landing page + a `/play` deep link. ONE list, so the route table, the
// shadow test and the sitemap can never drift apart.
export const LANDING_MODES = ['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse'];

// Clean path -> the query the existing readers understand. /word-bomb & /category-blitz have no
// query: they need a room, so they land on the menu (and keep the splash — see above).
const PATH_TO_QUERY = {
  // THE PLAY PATHS — the real, production-reachable deep links.
  '/sat-rush/play': 'satRush=1&satrush=1', // satRush/config reads satRush; LAUNCH_INTENT reads satrush
  '/chain/play': 'chain=1',
  '/fuse/play': 'fuse=1',
  // The two room-based modes: one param naming the mode, read by LAUNCH_INTENT.play.
  '/word-bomb/play': 'play=word-bomb',
  '/category-blitz/play': 'play=category-blitz',
  // Fallback only (shadowed by the landing pages in production — see the note above).
  '/sat-rush': 'satRush=1&satrush=1',
  '/chain': 'chain=1',
  '/fuse': 'fuse=1',
};

// Paths that render the MENU (home view). The view->path sync must NOT rewrite any of these to '/':
// they are valid, distinct landing URLs. (The bare two are fallback aliases — a landing page shadows
// them on Vercel. The `/play` pair is NOT here: they open a GAME, which owns no canonical URL, so
// the sync leaves the address bar alone while the round runs.)
export const MENU_PATHS = new Set(['/', '/word-bomb', '/category-blitz']);

// The crawlable route paths (the sitemap + the SEO landing pages). The `/play` deep links are
// deliberately NOT here: they are the app, not content, and each landing page is their canonical.
export const ROUTE_PATHS = ['/', '/word-bomb', '/category-blitz', '/sat-rush', '/chain', '/fuse'];

// Every playable deep link, for tests and for anything generating share URLs.
export const PLAY_PATHS = LANDING_MODES.map((id) => `/${id}/play`);

// A view id (or a menu+dialog intent) -> the canonical clean path. Only these views own a URL;
// everything else (lobby/room-waiting/game/shop/stats/browse/credits/cg-arm) stays under the menu's
// '/' or the room path and is not deep-linkable on its own.
//
// NOTE these are the `/play` paths, not the bare ones: this is the URL a player IN the mode sees,
// so it is the URL they bookmark, share and reload. Pointing it at the bare path (as it used to)
// meant reloading mid-run bounced you out to the landing page instead of back into the mode.
const VIEW_TO_PATH = {
  home: '/',
  'sat-rush': '/sat-rush/play',
  chain: '/chain/play',
  fuse: '/fuse/play',
};

// SAT/CHAIN/FUSE view ids come from their config modules; keep this in sync via the constants the
// app already exports. We accept the literal ids the app uses ('sat-rush' may differ) — resolved by
// the caller passing the actual view string, matched loosely below.
// Trailing-slash tolerance. `/chain/play/` is the same route as `/chain/play` — Vercel serves the
// SPA for both and does not redirect between them, and a link pasted or typed with a trailing slash
// is still a link. Applied by BOTH the bridge and the popstate mapper so they can't disagree. '/'
// itself is left alone.
function normalizePath(pathname) {
  const p = pathname || '/';
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

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
    const { search } = window.location;
    const pathname = normalizePath(window.location.pathname);
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
  const path = normalizePath(pathname);
  if (MENU_PATHS.has(path)) return 'home';
  // /word-bomb/play and /category-blitz/play open a LIVE ROOM. Back must never re-drive that from
  // history — re-provisioning a room behind the player's back is exactly the WS/room-lifecycle fight
  // the null intent exists to prevent. Back out of a round goes to the menu, like /room/* does.
  if (path === '/word-bomb/play' || path === '/category-blitz/play') return null;
  if (path === '/sat-rush/play' || path === '/sat-rush') return 'sat-rush';
  if (path === '/chain/play' || path === '/chain') return 'chain';
  if (path === '/fuse/play' || path === '/fuse') return 'fuse';
  return null; // /room/* and anything else: leave the app as-is
}
