// featureFlags.js — ONE helper for every dormant feature (extensions-spec "one shared flag helper").
// A feature ships OFF; Andy (or a tester) turns it on for one page load with `?<name>=1` in the URL,
// or for good with localStorage `taw.flag.<name>` = '1'. Every read is guarded: no window (node
// tests), blocked storage or a broken URL all read as OFF — a flag can never throw into a render.
//
// `legacyKey` keeps a flag that predates this helper working on its old storage key too
// (rolls: taw.rollsOn).

export const FLAG_PREFIX = 'taw.flag.';

// The query string AS THE PAGE LOADED. The app tidies the address bar on boot (portal / deep-link params are
// replaced away), and some flags are read seconds later (the rival ping runs after the first board submit),
// so `?rival=1` must count for the whole page load, not only until the URL is rewritten.
let BOOT_SEARCH = '';
try {
  if (typeof window !== 'undefined') BOOT_SEARCH = window.location.search || '';
} catch { /* no window */ }

export function flagOn(name, { legacyKey } = {}) {
  if (!name) return false;
  try {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get(name) === '1') return true;
    if (BOOT_SEARCH && new URLSearchParams(BOOT_SEARCH).get(name) === '1') return true;
  } catch { /* no window */ }
  try {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem(FLAG_PREFIX + name) === '1') return true;
    return !!legacyKey && localStorage.getItem(legacyKey) === '1';
  } catch {
    return false;
  }
}
