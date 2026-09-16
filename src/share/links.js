// src/share/links.js
// Invite/share link builders. Pure (origin injectable) so they run under
// node --test; browser callers omit `origin` and get window.location.origin,
// which keeps links correct on localhost, previews and production alike.

// INLINED from the deleted shareConfig.js. The share-card pipeline (ShareBar, CopyResultButton,
// shareCard/cardModel/renderCard/qr) was removed wholesale — Andy: "no one in the history uses
// that" — and this constant was the only thing left in that module with a live consumer. The URL
// is carried over VERBATIM, ?ref=share included, so invite-link behaviour and its PostHog
// attribution are byte-identical to before the removal.
const REF_URL = 'https://typeaword.com/?ref=share';

const PROD_ORIGIN = 'https://typeaword.com';

function resolveOrigin(origin) {
  if (origin) return origin;
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return PROD_ORIGIN;
}

// feat/router: share links use CLEAN PATHS (the router bridges them back to the query the app
// reads, and canonicalises the URL after boot). Legacy ?join=/?satrush=/?chain=/?fuse= entries still
// work (the app never stopped reading them), so old shared links keep resolving.
//
// ARTICLE/PLAY SPLIT (2026-09-16): the solo links point at /<mode>/play, NOT /<mode>. /chain,
// /fuse and /sat-rush are static landing pages in public/, and Vercel serves a static file before
// the SPA rewrite — so the old links landed a recipient on an article with a PLAY button rather
// than in the game. Verified against production: those paths return HTML with no #root at all.

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

// Result-card deep link per mode id (Job 1). Each lands IN the mode, never on an article —
// EXCEPT word-bomb, which has no solo deep-link param (adding one is Tier-1 App.jsx work), so it
// falls back to the mode-select MENU. That used to be `/word-bomb`, which is a static landing page
// in production, so the recipient of a Word Bomb result card got an article instead of anywhere
// playable; '/' is the closest thing to "the game" a mode with no solo entry point has.
// category-blitz points at the Daily Challenge (the solo blitz surface).
export function modeShareLink(mode, origin) {
  switch (mode) {
    case 'fuse':
      return fuseLink(origin);
    case 'chain':
      return chainLink(origin);
    case 'sat-rush':
      return satRushLink(origin);
    case 'category-blitz':
      return dailyLink(origin);
    case 'word-bomb':
      return `${resolveOrigin(origin)}/?ref=share`;
    default:
      return `${resolveOrigin(origin)}/?ref=share`;
  }
}
