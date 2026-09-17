// src/share/links.js
// Invite/share link builders. Pure (origin injectable) so they run under
// node --test; browser callers omit `origin` and get window.location.origin,
// which keeps links correct on localhost, previews and production alike.

// INLINED from the deleted shareConfig.js (fix/econ-perf-attack removed the share-card pipeline
// wholesale — "no one in the history uses that" — and this constant was its only live consumer).
// Carried over VERBATIM, ?ref=share included, so invite-link behaviour and its PostHog attribution
// are byte-identical.
const REF_URL = 'https://typeaword.com/?ref=share';

const PROD_ORIGIN = 'https://typeaword.com';

function resolveOrigin(origin) {
  if (origin) return origin;
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return PROD_ORIGIN;
}

// feat/router: share links now use CLEAN PATHS (the router bridges them back to the query the app
// reads, and canonicalises the URL after boot). Legacy ?join=/?satrush=/?chain=/?fuse= entries still
// work (the app never stopped reading them), so old shared links keep resolving.
//
// THEY POINT AT `/<mode>/play`, NOT `/<mode>`. The bare path is that mode's SEO LANDING PAGE — a
// static file in `public/`, which Vercel serves INSTEAD of the app (the filesystem is matched before
// the SPA rewrite in vercel.json). Every share link built here used to hand a friend the marketing
// page for a mode their friend had JUST PLAYED, one more click from the thing they were sent to see.
// `/<mode>/play` is the SPA deep link and lands in the mode. See src/router.js.

/** Deep link that drops a friend straight into room `code` -> /room/CODE. */
export function inviteLink(code, origin) {
  if (!code) return REF_URL;
  return `${resolveOrigin(origin)}/room/${encodeURIComponent(code)}?ref=share`;
}

/** Deep link that lands a friend directly in today's Daily Challenge. (No route path — Daily is a
 *  Category Blitz variant; keep the query form, which the app still reads.) */
export function dailyLink(origin) {
  return `${resolveOrigin(origin)}/?daily=1&ref=share`;
}

/** Deep link straight into SAT Rush -> /sat-rush/play. */
export function satRushLink(origin) {
  return `${resolveOrigin(origin)}/sat-rush/play?ref=share`;
}

/** Deep link straight into CHAIN -> /chain/play. */
export function chainLink(origin) {
  return `${resolveOrigin(origin)}/chain/play?ref=share`;
}

/** Deep link straight into FUSE -> /fuse/play. */
export function fuseLink(origin) {
  return `${resolveOrigin(origin)}/fuse/play?ref=share`;
}

// Result-card deep link per mode id (Job 1). Each lands IN the mode it names — all five, now that
// /word-bomb/play and /category-blitz/play provision a room + bot with no clicks. category-blitz
// used to point at the Daily (/?daily=1) because it was the only solo Blitz surface; that sent a
// friend to a DIFFERENT mode from the one on the card they were reacting to, and — because
// App.jsx's DEEP_LAND does not count a ?daily= launch — denied them the run-over "rest of the
// game" offer that every other deep-landed stranger gets. dailyLink() is unchanged and still used
// by the Daily's own share.
export function modeShareLink(mode, origin) {
  switch (mode) {
    case 'fuse':
      return fuseLink(origin);
    case 'chain':
      return chainLink(origin);
    case 'sat-rush':
      return satRushLink(origin);
    case 'category-blitz':
      return `${resolveOrigin(origin)}/category-blitz/play?ref=share`;
    case 'word-bomb':
      return `${resolveOrigin(origin)}/word-bomb/play?ref=share`;
    default:
      return `${resolveOrigin(origin)}/?ref=share`;
  }
}
