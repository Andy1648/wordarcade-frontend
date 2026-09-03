// src/share/links.js
// Invite/share link builders. Pure (origin injectable) so they run under
// node --test; browser callers omit `origin` and get window.location.origin,
// which keeps links correct on localhost, previews and production alike.

import { REF_URL } from './shareConfig.js';

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

/** Deep link straight into SAT Rush -> /sat-rush. */
export function satRushLink(origin) {
  return `${resolveOrigin(origin)}/sat-rush?ref=share`;
}

/** Deep link straight into CHAIN -> /chain. */
export function chainLink(origin) {
  return `${resolveOrigin(origin)}/chain?ref=share`;
}

/** Deep link straight into FUSE -> /fuse. */
export function fuseLink(origin) {
  return `${resolveOrigin(origin)}/fuse?ref=share`;
}

// Result-card deep link per mode id (Job 1). Each lands IN the mode, never the homepage —
// EXCEPT word-bomb, which has no solo deep-link param (adding one is Tier-1 App.jsx work),
// so it falls back to the mode-select homepage. category-blitz points at the Daily Challenge
// (the solo blitz surface). Keeps the share receipt's last line functional, not cosmetic.
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
      return `${resolveOrigin(origin)}/word-bomb?ref=share`;
    default:
      return `${resolveOrigin(origin)}/?ref=share`;
  }
}
