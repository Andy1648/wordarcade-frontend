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

/** Deep link that drops a friend straight into room `code` (see App's ?join= handling). */
export function inviteLink(code, origin) {
  if (!code) return REF_URL;
  return `${resolveOrigin(origin)}/?join=${encodeURIComponent(code)}&ref=share`;
}

/** Deep link that lands a friend directly in today's Daily Challenge. */
export function dailyLink(origin) {
  return `${resolveOrigin(origin)}/?daily=1&ref=share`;
}
