// season.js — THE SEASON2 FLAG (PROGRESSION v3, claude/mockups/v2/progression-v3.md, Andy oct5 phase 3).
//
// DEFAULT OFF. With the flag OFF the live game (Rebirth Rush, econ 12) is unchanged: every v3 rule lives in
// src/progress/v3/*.js and is only selected at the existing entry points through SEASON2 (xp.js, wins.js,
// gemsCore.js, shop.js, stars.js, claims.js, achievements.js, rank.js, …). OFF = the same numbers, the same keys.
//
// ON when, at PAGE LOAD (never mid-session — a v3 save must never be read by the live rules or the reverse):
//   * the URL carries ?season2=1 (dev / e2e),
//   * the build was made with VITE_SEASON2=1,
//   * node (the CI loop-sim, unit tests): globalThis.location = { search: '?season2=1' } before the first import,
//   * the SERVER HOOK (below) — later, once lb_caps says season 2 (wired but inert: SERVER_FLAG_LIVE = false).
//
// SEASON 2 KEEPS ITS OWN SAVE. The progression keys whose MEANING v3 changes (level state, rebirths, POWER, wins,
// gems, records, the claims inbox) are read and written under `taw.s2.*` while the flag is on: v3/install.js maps them
// at the storage layer (patchStorage), so the live modules carry no key logic at all. So a tester who opens
// ?season2=1 on a real save never touches it, and turning the flag off returns that save untouched. At the flip the
// season-2 save is CONVERTED from the season-1 one (v3/convertLocal.js — read only, nothing removed).
//
// LEAF MODULE: imports nothing (xp.js, gemsCore.js and every other leaf can read it without a cycle).


// The flag, read once (node: no import.meta.env → reads location.search, which the sim / tests set; none → throws → OFF). The server
// hook (SERVER_FLAG_LIVE, false in phase 3) would add `|| localStorage.getItem(SERVER_FLAG_KEY) === '1'` here.
// THE FLIP: Andy runs 022 → 024 → claude/run-season2-convert.sql (025) → notify pgrst, then says "flip SEASON2" — and
// only then this ONE line becomes `true`. Every visitor is then season 2: NO RESET (Andy oct6) — each browser's save
// converts once (v3/convertLocal.js: R ≤ 10, ★ from the rebirths above 10, KEY → POWER, the rest kept) and the UPDATE
// card shows once. KEEP false until that word. (?season2=1 / VITE_SEASON2=1 still turn it on for testing.)
export const SEASON2_LIVE = false;

/** THE FLAG — fixed for the page load. */
export const SEASON2 = (() => {
  if (SEASON2_LIVE) return true;
  try {
    return /season2=1/.test(location.search) || import.meta.env.VITE_SEASON2 === '1';
  } catch {
    return false;
  }
})();



// SERVER HOOK (for later): v3/hooks.js noteServerSeason(caps) notes lb_caps { season: 2 } for the NEXT boot.

/**
 * THE v3 RULES, INSTALLED LAZILY. The v3 modules (v3/econ, curve, store, unlocks, ranks) live in their own chunk —
 * the live game never downloads them (payload ratchet, e2e/payload-budget.spec.js). main.jsx imports
 * ./v3/install.js BEFORE the first render when SEASON2 is on, and that fills this holder; every season-2 branch in the
 * eager modules reads its rules through it (V3.econ.xpPerLetter(...), V3.store.bumpCounter(...) ...). Node tests and
 * the sim import ./v3/install.js themselves after turning the flag on.
 */
export const V3 = {}; // { econ, curve, store, unlocks, ranks, hooks, stock, Trophy, ready } once installed
