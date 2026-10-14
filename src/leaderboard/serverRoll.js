// serverRoll.js — SERVER-CHECKED GEAR ROLLS (Andy oct12; migration 036_server_rolls.sql). A named season-2 player's
// roll is PICKED by the server (public.lb_roll — the same odds as markRolls.js rollTable, the server's own pity /
// bonus counters, luck clamped, a gem budget), so the server knows every gear it handed out and the profile card can
// only show those. The browser still runs the reel, the INDEX rewards and its own save; it just lands on the server's
// pick (markRollShop.buyMarkRoll({ picks })).
//
//   prepare(luck, n)  — ask early (the HOLD start): the reservation is back before the release. Asking again before a
//                       claim returns the SAME picks (a cancelled hold can never re-roll for a better result).
//   take()            — the ready reservation (or null), sync — the roll's release reads it.
//   claim(seq)        — the release commits it (lb_roll_claim); a failed claim is kept and retried next time.
// Before 036 runs (lb_roll 404), with no name, offline, or in season 1: null → the old local roll, unchanged.
import { LEADERBOARD_ENABLED, getMyProfile, peekSecret, getSecret, rpc } from './client.js';
import { SEASON2 } from '../progress/season.js';

const CLAIM_KEY = 'taw.s2.rollclaim'; // an unanswered claim's seq (retried before the next roll)
let off = false; // lb_roll is not there (pre-036): stop asking this page load
let pending = null; // Promise of the reservation being fetched
let ready = null; // { seq, picks }

/** Can this player roll on the server right now? */
export function serverRollOn() {
  return !off && SEASON2 && LEADERBOARD_ENABLED && !!getMyProfile() && !!peekSecret();
}

function readClaim() {
  try { const n = Number(localStorage.getItem(CLAIM_KEY)); return Number.isInteger(n) && n > 0 ? n : 0; } catch { return 0; }
}
function writeClaim(seq) {
  try { if (seq) localStorage.setItem(CLAIM_KEY, String(seq)); else localStorage.removeItem(CLAIM_KEY); } catch { /* blocked */ }
}

/** Commit a reservation (fire-and-forget; a failure is kept and retried before the next reservation). */
export async function claim(seq) {
  if (!seq) return false;
  writeClaim(seq);
  try {
    const r = await rpc('lb_roll_claim', { p_secret: getSecret(), p_seq: seq });
    if (r && r.ok) { writeClaim(0); return true; }
  } catch { /* offline: retried later */ }
  return false;
}

/** Ask for the next roll's picks. Resolves { seq, picks } or null (fall back to the local roll). */
export function prepare(luck = 1, n = 1) {
  if (!serverRollOn()) return Promise.resolve(null);
  if (ready) return Promise.resolve(ready);
  if (pending) return pending;
  pending = (async () => {
    const owed = readClaim();
    if (owed) await claim(owed);
    try {
      const r = await rpc('lb_roll', { p_secret: getSecret(), p_luck: Number.isFinite(luck) ? luck : 1, p_n: n });
      if (r && r.ok && Array.isArray(r.picks) && r.picks.length) { ready = { seq: r.seq, picks: r.picks }; return ready; }
      return null;
    } catch (e) {
      const m = String((e && e.code) || (e && e.message) || '');
      if (/lb_roll|PGRST202|http_404|Could not find the function/i.test(m)) off = true;
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/** The ready reservation, consumed (null when none is ready). */
export function take() {
  const r = ready;
  ready = null;
  return r;
}

/** Is a server reservation being fetched right now? */
export function isPreparing() {
  return !!pending;
}

// NO GEAR IS EVER HIDDEN OR REVERTED (Andy oct13 "dont ever hide gears"): the 036 client half that dropped a gear
// the server 'reverted' from this browser's save is gone — the server only FLAGS (037). A bad actor is removed, not their gear.
