// rebirthFlow.js — the CLIENT half of the server-checked rebirth (021_server_rebirth.sql, rebirthRules.js), as a
// factory with every side effect injected, so node:test and the CI loop-sim drive the exact flow the app runs.
// src/leaderboard/client.js builds the app's instance (real fetch, localStorage, stars.rebirthWithStars).
//
// performRebirth() — THE rebirth action. One async function: today's CONFIRM button and the REBIRTH READY one-tap
// call it, and the v2 kit's HOLD-TO-REBIRTH button will call it once its hold completes. It is SINGLE-FLIGHT (a call
// while one is pending answers { ok:false, reason:'pending' } and sends nothing), and:
//   * SERVER mode (the player has a board profile AND lb_caps says rebirth_rpc):
//       1. push fresh stats first, so the stored level the server checks is current;
//       2. lb_rebirth with a request id that is PERSISTED until answered (a reload or retry re-sends the SAME id —
//          the server answers a repeat from its log, so a lost response can never become two rebirths);
//       3. apply the rebirth locally ONLY on ok, landing local rebirths on the SERVER's count (not local + 1);
//       4. a refusal (gate / wait / rate / season) or a network error applies NOTHING.
//   * LOCAL mode (no board profile, the board is off, or 021 isn't deployed: no rebirth_rpc cap, or lb_rebirth
//     answers PGRST202 / 404 → not_ready): today's local rebirth, gated on the local level. Nothing breaks before
//     Andy runs 021.
// settlePending() — a request answered by the server but never by the client (tab closed mid-flight) is re-sent
// with its SAME id before the next board submit, so the local count catches up instead of the submit's RESET rule
// lowering the row back.

import { formatNum } from '../format.js';

export const PENDING_REBIRTH_KEY = 'taw.lb.rbreq'; // { id, from } — from = local rebirths when it was sent
export const PENDING_ASCEND_KEY = 'taw.lb.ascreq';

/** A v4 UUID: crypto.randomUUID, else getRandomValues, else Math.random (never throws). */
export function newRequestId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  const b = new Uint8Array(16);
  try {
    crypto.getRandomValues(b);
  } catch {
    for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  }
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The RPC isn't deployed (PostgREST PGRST202 / a 404): the client keeps the local rebirth. */
export function isNotDeployed(err) {
  const m = String((err && (err.code || err.message)) || '');
  return /PGRST202|http_404|Could not find the function/i.test(m);
}

/**
 * @param {object} d
 * @param {() => Promise<boolean>} d.serverEnabled   profile + board on + lb_caps.rebirth_rpc (fresh probe)
 * @param {() => Promise<boolean>} d.pushStats       push current stats (waits out the 5 s board throttle if needed)
 * @param {(fn:string, body:object) => Promise<any>} d.call  the RPC (throws on HTTP error, err.code = message)
 * @param {() => string|null} d.secret
 * @param {{get:(k:string)=>string|null, set:(k:string,v:string)=>void, remove:(k:string)=>void}} d.storage
 * @param {() => number} d.localRebirths
 * @param {() => boolean} d.localReady               the local gate (local mode only)
 * @param {(target:number|null) => {rc:number, stars:number}} d.applyLocal  do the local rebirth; `target` = the
 *   server's new count (local rebirths land exactly on it), null = local mode (+1)
 * @param {() => string} [d.newId]
 * @param {() => number} [d.season]                  0 today; 2 once the SEASON2 flag is on
 */
export function makeRebirthFlow(d) {
  const newId = d.newId || newRequestId;
  const season = d.season || (() => 0);
  let busy = false;

  const readPending = (key) => {
    try {
      const p = JSON.parse(d.storage.get(key) || 'null');
      return p && typeof p.id === 'string' ? p : null;
    } catch {
      return null;
    }
  };
  const writePending = (key, p) => {
    try { d.storage.set(key, JSON.stringify(p)); } catch { /* storage blocked: the id lives for this call only */ }
  };
  const clearPending = (key) => {
    try { d.storage.remove(key); } catch { /* ignore */ }
  };

  /**
   * One lb_rebirth / lb_ascend request with a persisted id. Never throws.
   * @returns {Promise<object>} the server's answer, or { ok:false, reason:'not_ready'|'offline' }
   */
  async function request(fn, key, { retried = false } = {}) {
    let p = readPending(key);
    if (!p) {
      p = { id: newId(), from: d.localRebirths() };
      writePending(key, p);
    }
    let res;
    try {
      res = await d.call(fn, { p_secret: d.secret(), p_request_id: p.id, p_season: season() });
    } catch (e) {
      if (isNotDeployed(e)) {
        clearPending(key);
        return { ok: false, reason: 'not_ready' };
      }
      return { ok: false, reason: 'offline', pending: p }; // keep the id: the retry re-sends the SAME one
    }
    if (!res || typeof res !== 'object') return { ok: false, reason: 'offline', pending: p };
    if (res.reason === 'rate') return { ...res, pending: p }; // not logged server-side: the same id may go again
    if (res.reason === 'bad_request') {
      clearPending(key);
      return res;
    }
    // A REPLAYED refusal is the answer to an OLD try (the response was lost then); the player is asking now, so ask
    // once more with a fresh id. A replayed ok is the rebirth that try earned — apply it (below).
    if (res.replay && !res.ok && !retried) {
      clearPending(key);
      return request(fn, key, { retried: true });
    }
    return { ...res, pending: p };
  }

  /** Apply a granted server rebirth locally — at most once per request id (`from` = local count when sent). */
  function applyServer(res, key) {
    const p = res.pending;
    let out;
    if (!p || d.localRebirths() === p.from) out = { ...d.applyLocal(Number(res.rebirths)), applied: true };
    else out = { rc: d.localRebirths(), stars: 0, applied: false }; // already applied by an earlier settle
    clearPending(key); // AFTER the apply: dying in between re-sends the id, and the `from` check skips a 2nd apply
    return out;
  }

  function localRebirth() {
    if (!d.localReady()) return { ok: false, reason: 'gate', mode: 'local' };
    const r = d.applyLocal(null);
    return { ok: true, mode: 'local', rc: r.rc, stars: r.stars };
  }

  async function performRebirth() {
    if (busy) return { ok: false, reason: 'pending' };
    busy = true;
    try {
      let server = false;
      try { server = await d.serverEnabled(); } catch { server = false; }
      if (!server) return localRebirth();
      try { await d.pushStats(); } catch { /* the server checks whatever it has */ }
      const res = await request('lb_rebirth', PENDING_REBIRTH_KEY);
      if (res.reason === 'not_ready') return localRebirth();
      if (res.ok) {
        const a = applyServer(res, PENDING_REBIRTH_KEY);
        return { ok: true, mode: 'server', rc: Number(res.rebirths), stars: a.stars, applied: a.applied, replay: !!res.replay };
      }
      const { pending: _p, ...rest } = res;
      void _p;
      return { ...rest, ok: false, mode: 'server' };
    } finally {
      busy = false;
    }
  }

  /** lb_ascend (season 2; phase 3 wires the UI). Returns the server's answer; applies nothing locally yet. */
  async function requestAscend() {
    const res = await request('lb_ascend', PENDING_ASCEND_KEY);
    if (res.reason !== 'offline' && res.reason !== 'rate') clearPending(PENDING_ASCEND_KEY);
    const { pending: _p, ...rest } = res;
    void _p;
    return rest;
  }

  /**
   * Before a board submit: re-send a rebirth request that never got its answer (same id). Returns false while it is
   * still unanswered (offline) — the caller then SKIPS that submit, because a submit carrying the old, lower count
   * would be read as a RESET and pull the server's rebirth back down.
   */
  async function settlePending() {
    if (busy) return false;
    if (!readPending(PENDING_REBIRTH_KEY)) return true;
    busy = true;
    try {
      const res = await request('lb_rebirth', PENDING_REBIRTH_KEY, { retried: true });
      if (res.reason === 'offline' || res.reason === 'rate') return false;
      if (res.ok) applyServer(res, PENDING_REBIRTH_KEY);
      else clearPending(PENDING_REBIRTH_KEY);
      return true;
    } finally {
      busy = false;
    }
  }

  return {
    performRebirth,
    requestRebirth: () => request('lb_rebirth', PENDING_REBIRTH_KEY),
    requestAscend,
    settlePending,
    isBusy: () => busy,
    hasPending: () => !!readPending(PENDING_REBIRTH_KEY),
  };
}

/** The one line the REBIRTH panel shows when a rebirth was NOT done — numbers first. null = say nothing. */
export function rebirthRefusalText(res) {
  if (!res || res.ok || res.reason === 'pending') return null;
  if (res.reason === 'gate' && Number.isFinite(Number(res.gate)) && Number.isFinite(Number(res.level))) {
    return `LV ${formatNum(Number(res.level))} / ${formatNum(Number(res.gate))} — NOT THERE YET`;
  }
  if (res.reason === 'wait') {
    const s = Math.max(1, Math.ceil(Number(res.retry_in) || 0));
    return `NEXT REBIRTH IN ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  if (res.reason === 'rate') return 'TOO FAST — TRY AGAIN';
  if (res.reason === 'offline') return 'COULDN’T REACH THE SERVER — TRY AGAIN';
  return 'REBIRTH DIDN’T GO THROUGH — TRY AGAIN';
}
