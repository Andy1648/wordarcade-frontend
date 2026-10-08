// rebirthRules.js — the SERVER-CHECKED REBIRTH of supabase/migrations/021_server_rebirth.sql (public.lb_rebirth /
// public.lb_ascend), as pure JS (no DOM, no fetch, no clock), so node:test, the e2e board mock and the CI loop-sim
// all run the exact rule the database runs.
//
// SEASON 2 = PROGRESSION FINAL v3 (029_progression_final_v3.sql supersedes 027 / 026 / 022's season-2 branch): lb_rebirth
// needs LEVEL ≥ 15 + 18·R on the stored row → rebirths + 1, level 1 (×3 is the client's multiplier); lb_ascend is
// HIDDEN — it refuses every season-2 call ('off'). Season 0 (the live game) is unchanged.
//
// KEEP IN SYNC WITH 021_server_rebirth.sql (season 0) and 029_progression_final_v3.sql (season 2): the same checks in the same order, the same constants. A change to one
// is a change to both; src/leaderboard/rebirthRules.test.js pins the SQL text against these constants.
//
// WHY (progression-v3 "Anti-exploit", Andy oct5): imbetterthanandy posted R100 with 422 words. Rebirth was purely
// client-side and the board accepted whatever count a submit carried. From 021 on a rebirth is a SERVER action:
//   * the server recomputes the gate from the STORED row (never from anything the request says);
//   * ONE rebirth per call, ever;
//   * idempotent: every call carries a request id; the (profile, request id) pair is logged with its result, and a
//     repeat of that id returns the stored result (marked replay) and changes nothing — a double click, a retry after
//     a lost response, or a replayed request can never mint a second rebirth;
//   * rate-limited: ≤ RATE_PER_SEC logged calls a second per profile (a rate refusal is NOT logged);
//   * paced (carried from 020's token bucket so 021 is never weaker than 020): ≤ RB_PER_WINDOW granted rebirths in
//     any rolling RB_WINDOW_SECS, counted from the request log (rb_clock is left untouched);
//   * the board write (decideSubmitRR in submitRules.js) can no longer RAISE rebirths — they only rise here.
//
// THE CHECK ORDER (lb_rebirth):  bad id → (profile lookup + row lock) → REPLAY → RATE → SEASON → GATE → PACE → GRANT.
// lb_ascend: bad id → REPLAY → RATE → SEASON (2 only) → GATE (≥ ASCEND_AT rebirths) → GRANT.
// Every result except bad_request and rate is logged under the request id.

export const RATE_PER_SEC = 2; // logged calls per profile per rolling second
export const RB_WINDOW_SECS = 3600; // the pace window (020: 1 token / 5 min, 12 banked ⇒ ≤ 12 an hour)
export const RB_PER_WINDOW = 12; // granted rebirths allowed inside one window
export const ASCEND_AT = 10; // season 2 (hidden in FINAL v2 — lb_ascend refuses while ASCEND_ON is false): R ≥ 10 + 5 × ★ …
export const ASCEND_STEP = 5; // … would add ONE ★
export const ASCEND_ON = false; // FINAL v2: no ascension for now
export const LOG_KEEP_DAYS = 30; // request-log rows older than this are pruned (≫ the pace window)
// season 0 — the live rule (019): LV 25 × (R+1)
export const GATE0_BASE = 25;
export const GATE0_STEP = 25;
// season 2 — PROGRESSION v4 (029): LV 15 + 18·R → level 1. A season-1 row cannot use it (the econ-13 guard below).
export const GATE2_BASE = 15;
export const GATE2_STEP = 18;
export const SEASONS = [0, 2];
// 022_season2_board.sql: a SEASON-2 request (rebirth or ascend) needs a SEASON-2 row (econ 13 — its last accepted
// board write came from a season-2 client). Without it a season-1 row could mint ★ / rebirths on the season-2 board
// by naming season 2. A row with no `econ` field (021-era callers) is not checked.
export const SEASON2_ECON = 13;
const wrongSeasonRow = (row, season) => season === 2 && row && Object.prototype.hasOwnProperty.call(row, 'econ') && Number(row.econ) !== SEASON2_ECON;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const int = (v, min) => {
  const n = Number(v);
  return Math.max(min, Number.isFinite(n) ? Math.floor(n) : min);
};

/** The rebirth GATE standing at `rebirths`, in `season` (null for an unknown season): the level needed (level ≥ gate). */
export function serverGate(rebirths, season = 0) {
  const r = int(rebirths, 0);
  if (season === 2) return GATE2_BASE + GATE2_STEP * r;
  if (season === 0) return GATE0_BASE + GATE0_STEP * r;
  return null;
}
/** Season 2: the rebirth count an ascension needs at `stars` — 10 + 5 × ★. */
export function ascendGate(stars) {
  return ASCEND_AT + ASCEND_STEP * int(stars, 0);
}

/** Log rows of this profile that are still inside `secs` of `now`. */
function within(log, now, secs) {
  return (log || []).filter((e) => e.created_at > now - secs * 1000);
}

/**
 * The shared prelude of both RPCs: bad id, replay, rate. Returns { done } when it already answered.
 * @returns {{done: {result: object, row: object, entry: null}} | null}
 */
function prelude(row, requestId, action, log, now) {
  if (typeof requestId !== 'string' || !UUID_RE.test(requestId)) return { done: { result: { ok: false, reason: 'bad_request' }, row, entry: null } };
  const prev = (log || []).find((e) => e.request_id === requestId);
  if (prev) {
    // a request id is bound to the action it was first sent with
    if (prev.action !== action) return { done: { result: { ok: false, reason: 'bad_request' }, row, entry: null } };
    return { done: { result: { ...prev.result, replay: true }, row, entry: null } };
  }
  if (within(log, now, 1).length >= RATE_PER_SEC) return { done: { result: { ok: false, reason: 'rate' }, row, entry: null } };
  return null;
}

/**
 * public.lb_rebirth, modelled.
 * @param {{level:number, rebirths:number, stars?:number}} row  the STORED profile row
 * @param {{requestId:string, season?:number}} req
 * @param {Array<{request_id:string, action:string, result:object, created_at:number}>} log  this profile's request log
 * @param {number} now  ms since epoch
 * @returns {{result: object, row: object, entry: object|null}}  `row` = the row after the call; `entry` = the log row
 *   to append (null = nothing logged: bad id, replay, rate)
 */
export function decideRebirth(row, { requestId, season = 0 } = {}, log = [], now = Date.now()) {
  const pre = prelude(row, requestId, 'rebirth', log, now);
  if (pre) return pre.done;
  const lv = int(row.level, 1);
  const rb = int(row.rebirths, 0);
  let result;
  let next = row;
  const gate = SEASONS.includes(season) && !wrongSeasonRow(row, season) ? serverGate(rb, season) : null;
  if (gate == null) {
    result = { ok: false, reason: 'season' };
  } else if (lv < gate) {
    result = { ok: false, reason: 'gate', gate, level: lv, rebirths: rb };
  } else {
    const granted = within(log, now, RB_WINDOW_SECS).filter((e) => e.action === 'rebirth' && e.result && e.result.ok === true);
    if (granted.length >= RB_PER_WINDOW) {
      const oldest = Math.min(...granted.map((e) => e.created_at));
      result = { ok: false, reason: 'wait', retry_in: Math.max(1, Math.ceil((oldest + RB_WINDOW_SECS * 1000 - now) / 1000)), rebirths: rb };
    } else {
      // both seasons: rebirths + 1, level → 1
      next = { ...row, rebirths: rb + 1, level: 1 };
      result = { ok: true, rebirths: rb + 1, level: 1 };
    }
  }
  return { result, row: next, entry: { request_id: requestId, action: 'rebirth', result, created_at: now } };
}

/**
 * public.lb_ascend, modelled (029). HIDDEN in FINAL v2: every season-2 call on a season-2 row is refused ('off')
 * (ASCEND_ON false). With it on: R ≥ 10 + 5 × ★ stored → stars + 1, rebirths = 0, level = 1. Same request log,
 * same idempotency and rate limit as lb_rebirth.
 */
export function decideAscend(row, { requestId, season = 0 } = {}, log = [], now = Date.now()) {
  const pre = prelude(row, requestId, 'ascend', log, now);
  if (pre) return pre.done;
  const rb = int(row.rebirths, 0);
  const st = int(row.stars, 0);
  let result;
  let next = row;
  if (season !== 2 || wrongSeasonRow(row, season)) {
    result = { ok: false, reason: 'season' };
  } else if (!ASCEND_ON) {
    result = { ok: false, reason: 'off' };
  } else if (rb < ascendGate(st)) {
    result = { ok: false, reason: 'gate', need: ascendGate(st), rebirths: rb };
  } else {
    const stars = st + 1;
    next = { ...row, stars, rebirths: 0, level: 1 };
    result = { ok: true, stars, rebirths: 0, level: 1 };
  }
  return { result, row: next, entry: { request_id: requestId, action: 'ascend', result, created_at: now } };
}

/** A tiny in-memory "database" of one profile running the two RPCs (the e2e mock and the CI sim use it). */
export function makeRebirthServer(row) {
  const db = { row: { level: 1, rebirths: 0, stars: 0, ...row }, log: [] };
  const run = (decide) => (req, now = Date.now()) => {
    db.log = db.log.filter((e) => e.created_at >= now - LOG_KEEP_DAYS * 86400 * 1000);
    const out = decide(db.row, req, db.log, now);
    db.row = out.row;
    if (out.entry) db.log.push(out.entry);
    return out.result;
  };
  return { db, rebirth: run(decideRebirth), ascend: run(decideAscend) };
}
