// season.js — THE SEASON2 FLAG (PROGRESSION v3, claude/mockups/v2/progression-v3.md, Andy oct5 phase 3).
//
// DEFAULT OFF. With the flag OFF the live game (Rebirth Rush, econ 12) is unchanged: every v3 rule lives in
// src/progress/v3/*.js and is only selected at the existing entry points through SEASON2 (xp.js, wins.js,
// gemsCore.js, shop.js, stars.js, claims.js, achievements.js, rank.js, …). OFF = the same numbers, the same keys.
//
// ON when, at PAGE LOAD (never mid-session — a v3 save must never be read by the live rules or the reverse):
//   * the URL carries ?season2=1 (dev / e2e),
//   * the build was made with VITE_SEASON2=1,
//   * globalThis.__TAW_SEASON2__ === true before this module is first imported (the CI loop-sim, node tests),
//   * the SERVER HOOK (below) — later, once lb_caps says season 2 (wired but inert: SERVER_FLAG_LIVE = false).
//
// SEASON 2 KEEPS ITS OWN SAVE. The progression keys whose MEANING v3 changes (level state, rebirths, POWER, wins,
// gems, records) are read and written under `taw.s2.*` while the flag is on (s2Key). So a tester who opens
// ?season2=1 on a real save never touches it, and turning the flag off returns that save untouched. The reset
// itself (phase 4) is separate.
//
// LEAF MODULE: imports nothing (xp.js, gemsCore.js and every other leaf can read it without a cycle).

export const SEASON2_ECON = 13; // the board's econ value for a season-2 row (supabase/migrations/022_season2_board.sql)
export const S2_PREFIX = 'taw.s2.';
export const SERVER_FLAG_KEY = 'taw.s2.server'; // the server hook's note (read at the NEXT boot)
export const SERVER_FLAG_LIVE = false; // phase 3: the server hook is wired but does not turn the season on

function readFlag() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__TAW_SEASON2__ === true) return true;
  } catch {
    /* ignore */
  }
  try {
    if (import.meta.env && import.meta.env.VITE_SEASON2 === '1') return true;
  } catch {
    /* no import.meta.env (node) */
  }
  try {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search || '').get('season2') === '1') return true;
  } catch {
    /* no window */
  }
  if (SERVER_FLAG_LIVE) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(SERVER_FLAG_KEY) === '1') return true;
    } catch {
      /* blocked */
    }
  }
  return false;
}

/** THE FLAG — fixed for the page load. */
export const SEASON2 = readFlag();

/** Function form (for call sites that read better as a call). */
export function isSeason2() {
  return SEASON2;
}

/**
 * The storage key a progression value lives under: `taw.x` with the flag OFF (unchanged), `taw.s2.x` with it ON.
 * Only the keys whose meaning v3 changes go through here.
 */
export function s2Key(key) {
  if (!SEASON2) return key;
  return S2_PREFIX + String(key).replace(/^taw\./, '');
}

/**
 * SERVER HOOK (for later): lb_caps may one day carry { season: 2 }. Noted here, applied at the NEXT boot, and only
 * once SERVER_FLAG_LIVE is flipped — a season must never change under a running page. Returns whether it noted.
 */
export function noteServerSeason(caps) {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (caps && Number(caps.season) === 2) localStorage.setItem(SERVER_FLAG_KEY, '1');
    else if (caps && caps.season != null) localStorage.removeItem(SERVER_FLAG_KEY);
    else return false;
    return true;
  } catch {
    return false;
  }
}
