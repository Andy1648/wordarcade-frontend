// serverRebirth.js — the app's instance of the SERVER-CHECKED REBIRTH flow (021_server_rebirth.sql; the flow itself is
// rebirthFlow.js, the server rule rebirthRules.js). LAZY: it is needed only when the player rebirths, so it is NOT in
// the menu's eager chunk (payload ratchet, e2e/payload-budget.spec.js). ShopScreen (already lazy) imports it; the
// eager client.js only `import()`s it when an unanswered request id is in storage (settle before a board submit).
import { getRebirths, saveRebirths } from '../progress/xp.js';
import { rebirthWithStars, ascendWithStars } from '../progress/stars.js';
// PROGRESSION v3 (SEASON2, default OFF): rebirths name season 2 (gate ⌈100 × 2.5^R⌉ on an econ-13 row, 022), and
// performAscend (R10 → ★) goes through lb_ascend the same way. OFF = season 0, exactly as before.
import { SEASON2 } from '../progress/season.js';
import { ASCEND_AT } from '../progress/v3/econ.js';
import { isRebirthReadyNow } from '../progress/rebirthNow.js';
import { makeRebirthFlow } from './rebirthFlow.js';
import { LEADERBOARD_ENABLED, getMyProfile, peekSecret, getSecret, myStats, submitStats, rpc, pushMeta } from './client.js';

const DB_THROTTLE_MS = 5000; // the board write's 5 s throttle (021 / 017)

/** The flow needs the CURRENT level on the server: push unless the last push already carried it and the DB will
 *  have taken it; if the last push is under 5 s old, wait it out first (the DB would drop it silently). */
async function pushForRebirth() {
  const s = myStats();
  const last = pushMeta.last;
  if (last && last.likely && last.level === s.level && last.rebirths === s.rebirths && last.words === s.lifetimeWords) return true;
  const wait = last ? last.at + DB_THROTTLE_MS + 250 - Date.now() : 0;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return submitStats(true, { internal: true });
}
/** Fresh (uncached) caps probe: a session that started before Andy ran 021 still finds lb_rebirth. */
async function serverRebirthEnabled() {
  if (!LEADERBOARD_ENABLED || !getMyProfile() || !peekSecret()) return false;
  try {
    const c = await rpc('lb_caps', {});
    // v3: the season-2 rebirth checks a season-2 row, which only exists once 022 runs
    if (SEASON2) return !!(c && c.rebirth_rpc && c.season2);
    return !!(c && c.rebirth_rpc);
  } catch {
    return false;
  }
}
/** Local half of a rebirth: `target` = the server's new count (local lands exactly on it), null = local +1. */
function applyLocalRebirth(target) {
  if (Number.isFinite(target) && target >= 1) saveRebirths(target - 1);
  const { rc, stars } = rebirthWithStars();
  return { rc, stars };
}
const flow = makeRebirthFlow({
  serverEnabled: serverRebirthEnabled,
  pushStats: pushForRebirth,
  call: rpc,
  secret: () => getSecret(),
  storage: {
    get: (k) => localStorage.getItem(k),
    set: (k, v) => localStorage.setItem(k, v),
    remove: (k) => localStorage.removeItem(k),
  },
  localRebirths: () => getRebirths() || 0,
  localReady: () => isRebirthReadyNow(),
  applyLocal: applyLocalRebirth,
  season: () => (SEASON2 ? 2 : 0),
  // v3 ASCEND: `target` = the server's new ★ total, null = local (+ R − 9)
  localAscendReady: () => SEASON2 && (getRebirths() || 0) >= ASCEND_AT,
  applyAscend: (target) => ascendWithStars(target),
});
// client.js's submitStats skips a push while a request id is stored (in flight or unanswered): that push would carry
// the old, lower count, which the board reads as a RESET.

/**
 * THE rebirth action (021). Today's CONFIRM REBIRTH button and the REBIRTH READY one-tap call it; the v2 kit's
 * HOLD-TO-REBIRTH button calls it when its hold completes. Single-flight. Resolves to
 *   { ok:true, mode:'server'|'local', rc, stars }  — applied locally (server mode: on the server's count)
 *   { ok:false, reason:'pending'|'gate'|'wait'|'rate'|'offline'|'season'|'bad_request', gate?, level?, retry_in? }
 * Never throws.
 */
export async function performRebirth() {
  const res = await flow.performRebirth();
  // the server checked an older level than this browser has (another tab pushed, or the DB dropped our push):
  // the next try pushes again instead of trusting the last push
  if (res && res.reason === 'gate' && res.mode === 'server' && Number(res.level) < myStats().level && pushMeta.last) pushMeta.last = { ...pushMeta.last, likely: false };
  return res;
}
/** lb_rebirth with a persisted request id (no local apply) — performRebirth is the action; this is the raw call. */
export function requestRebirth() {
  return flow.requestRebirth();
}
/** lb_ascend with a persisted request id (no local apply) — performAscend is the action; this is the raw call. */
export function requestAscend() {
  return flow.requestAscend();
}
/**
 * THE ascension (v3, season 2, R10+): server-checked through lb_ascend when the player has a season-2 board row (022
 * live), else local. Single-flight with the rebirth. Resolves { ok:true, mode, stars, added } or { ok:false, reason }.
 * Never throws.
 */
export function performAscend() {
  return flow.performAscend();
}
/** Is a server rebirth in flight? */
export function rebirthPending() {
  return flow.isBusy();
}
/** Re-send an unanswered request (same id) before a board submit; false = still unanswered → skip that submit. */
export function settlePendingRebirth() {
  return flow.settlePending();
}
