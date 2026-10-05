// client.js — the leaderboard's data layer (STEP 24; Andy A13: username only, no sign-in).
//
// Talks to Supabase over plain fetch + PostgREST (no supabase-js: ~0 bytes of new dependency on the
// menu path). The URL + anon key come from Vite env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, set
// in Vercel for Production + Preview); with either missing, the feature is OFF and every call is a
// harmless no-op, so local dev and forks never break.
//
// IDENTITY: no accounts. The browser holds a random SECRET (localStorage taw.lb.secret); the DB
// stores only its SHA-256 and every write goes through a SECURITY DEFINER function that checks it
// (supabase/migrations/001_leaderboard.sql). Lose the secret (clear storage) and the name stays on
// the board, owned by nobody — exactly what a guest handle should do.
import { getRebirths, saveRebirths, storedLevel } from '../progress/xp.js';
import { rebirthWithStars, ascendWithStars } from '../progress/stars.js';
// PROGRESSION v3 (SEASON2, default OFF; 022_season2_board.sql): the season-2 client submits econ 13 ONLY when lb_caps
// says season2 (never season-2 numbers onto the season-1 board), reads public.leaderboard_s2 (★ → R → level), names
// season 2 on lb_rebirth / lb_ascend, and skips the cloud save (it backs up the season-1 keys; season 2's is phase 4).
import { SEASON2, SEASON2_ECON } from '../progress/season.js';
import { isRebirthReadyNow } from '../progress/rebirthNow.js';
import { makeRebirthFlow } from './rebirthFlow.js';
import { MASTERY_MODES, masteryWords } from '../progress/mastery.js';
import { perWordRateNow } from '../progress/wins.js';
import { getLetters } from '../progress/letters.js';
import { backupNow, restoreIfAhead, parseRecoveryCode, wipeProgressKeys, localScore, DEV_RESET_NOTICE_KEY, ECON_RPC_VERSION_V10, econRpcArg } from '../save/cloudSave.js';
import { exportSave } from '../save/saveBackup.js';
import { queueClaim } from '../progress/claims.js';
import { flagOn } from '../lib/featureFlags.js';
import { rankChange, ownDropSince, rivalPing, nextRivalLog, RIVAL_MAX_RANK } from './rival.js';

const RAW_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
const KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';
const BASE = RAW_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

// THE FLAG. On whenever the env is configured (Production + Preview); off otherwise.
export const LEADERBOARD_ENABLED = !!(BASE && KEY);

const SECRET_KEY = 'taw.lb.secret';
const PROFILE_KEY = 'taw.lb.profile';
export const BOARD_SIZE = 10; // Andy oct2 LB10: the board shows the TOP 10; anyone below gets a pinned row with their real rank
const SUBMIT_EVERY_MS = 30 * 1000;
// The board view this client reads: the season-2 board (022 — ★ → R → level, econ-13 rows) with the SEASON2 flag.
const BOARD_VIEW = SEASON2 ? 'leaderboard_s2' : 'leaderboard';

function headers() {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
}

async function rpc(fn, body) {
  const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    let code = (data && data.message) || `http_${r.status}`;
    // a same-name race that reached the unique index (older DB functions) is still "taken"
    if (data && (data.code === '23505' || /duplicate key/i.test(code))) code = 'username_taken';
    const err = new Error(code);
    err.code = code;
    throw err;
  }
  return data;
}

// ---- local identity --------------------------------------------------------------------------
// STEP 52: the secret is mirrored in a long-lived first-party cookie, so a wipe of localStorage alone
// does not lose the identity the cloud save is tied to.
const SECRET_COOKIE = 'taw_lb';
function readSecretCookie() {
  try {
    const m = document.cookie.match(/(?:^|;\s*)taw_lb=([0-9a-f]{32,64})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
function writeSecretCookie(s) {
  try {
    document.cookie = `${SECRET_COOKIE}=${s}; max-age=${400 * 24 * 3600}; path=/; samesite=lax; secure`;
  } catch {
    /* no cookies */
  }
}
/** The secret if this browser has one (localStorage, else the cookie) — never mints a new one. */
export function peekSecret() {
  try {
    const s = localStorage.getItem(SECRET_KEY);
    if (s && s.length >= 32) return s;
  } catch {
    /* blocked */
  }
  const c = readSecretCookie();
  if (c) {
    try {
      localStorage.setItem(SECRET_KEY, c);
    } catch {
      /* blocked */
    }
  }
  return c;
}
export function getSecret() {
  try {
    let s = peekSecret();
    if (!s || s.length < 32) {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      s = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(SECRET_KEY, s);
      // Two tabs minting at once: whichever write landed LAST is the one every later call reads, so
      // re-read rather than trusting the value this tab generated.
      s = localStorage.getItem(SECRET_KEY) || s;
    }
    writeSecretCookie(s);
    return s;
  } catch {
    return null; // storage blocked: the player can still READ the board, just not claim
  }
}

export function getMyProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    return p && typeof p.username === 'string' ? p : null;
  } catch {
    return null;
  }
}

function saveMyProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ id: p.id, username: p.username })); } catch { /* ignore */ }
}

// ---- what the board shows about me -----------------------------------------------------------
// PV10: the AUTHORITATIVE level (xp.js resolves the v10 shape, converts a legacy one, and ignores a
// stale old-bundle write) — never a raw read of taw.xp.lv.
function readLevel() {
  try {
    return Math.max(1, Math.floor(storedLevel() || 1));
  } catch {
    return 1;
  }
}

/** The numbers this browser reports: level, rebirths, lifetime words + LETTERS (STEP 51), WINS/WORD. */
export function myStats() {
  let words = 0;
  for (const m of MASTERY_MODES) words += masteryWords(m) || 0;
  let wpw = 0;
  try { wpw = perWordRateNow({ mode: 'word-bomb' }).rate || 0; } catch { wpw = 0; }
  let letters = 0;
  try { letters = getLetters(); } catch { letters = 0; }
  return { level: readLevel(), rebirths: getRebirths() || 0, lifetimeWords: words, lifetimeLetters: letters, winsPerWord: Math.round(wpw * 10) / 10 };
}

// ---- what the DB can do (STEP 51) ------------------------------------------------------------
// supabase/migrations/005_letters_cjk.sql adds LETTERS + Chinese names and a lb_caps() probe. Until
// it is applied the probe 404s and everything below keeps the v1 behaviour (words, ASCII names).
let capsPromise = null;
export function boardCaps() {
  if (!LEADERBOARD_ENABLED) return Promise.resolve({ letters: false, cjk: false });
  if (!capsPromise) {
    capsPromise = rpc('lb_caps', {})
      // econ: the p_econ to send (cloudSave econRpcArg) — 12 once 018_rebirth_rush.sql runs, 10 with only 016/017
      // (the version-gated lb_submit3 / lb_save2 / lb_load2 exist), 0 = neither (old RPCs)
      // boardEcon: 017_board_reality.sql — the board views carry `econ` (which economy a row last submitted on)
      .then((c) => ({ letters: !!(c && c.letters), cjk: !!(c && c.cjk), cloud: !!(c && c.cloud) && !SEASON2, weekly: !!(c && c.weekly), econ: econRpcArg(c && c.econ), boardEcon: !!(c && c.board_econ), season2: !!(c && c.season2) }))
      .catch(() => ({ letters: false, cjk: false, cloud: false, weekly: false, econ: 0, boardEcon: false, season2: false }));
  }
  return capsPromise;
}

// ---- API -------------------------------------------------------------------------------------
/** 'ok' | 'shape' | 'blocked' | 'taken' — the server's verdict on a name (no secret needed). */
export async function nameStatus(username) {
  if (!LEADERBOARD_ENABLED) return 'ok';
  return rpc('lb_name_status', { p_username: username });
}

/** Claim (or rename to) `username`. Resolves to the profile; rejects with err.code in
 *  username_taken | username_blocked | username_shape | bad_secret | rate_limited | rename_cooldown
 *  | http_*. Pushes stats at once. */
export async function claimName(username) {
  const secret = getSecret();
  if (!LEADERBOARD_ENABLED || !secret) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
  const row = await rpc('lb_claim', { p_secret: secret, p_username: username });
  saveMyProfile(row);
  lastSubmit = 0;
  const pushed = await submitStats(true);
  // Seed the rank-up baseline with where the claim landed — but only if my stats actually reached
  // the board: a failed push leaves the row at LV1 and would stage a fake "#57 → #3" later.
  if (pushed) {
    const rank = await fetchMyRank();
    if (rank) setLastRank(rank);
  }
  return row;
}

let lastSubmit = 0;
// 021: what the last push carried and whether the DB's 5 s throttle would have taken it — so the server-checked
// rebirth pushes fresh stats only when they changed, and waits out the throttle instead of being silently dropped.
const DB_THROTTLE_MS = 5000;
let lastPush = null; // { at, level, rebirths, words, likely }
/** Push my stats if I have a name. Throttled to once per 30 s unless forced; never throws.
 *  021: while a server rebirth is in flight (or one is still unanswered) the push waits for it — a push carrying
 *  the old, lower rebirth count would be read as a RESET and undo the server's rebirth. `internal` = the rebirth
 *  flow's own pre-rebirth push. */
export async function submitStats(force = false, { internal = false } = {}) {
  if (!LEADERBOARD_ENABLED || !getMyProfile()) return false;
  if (!internal) {
    if (rebirthFlow.isBusy()) return false;
    if (rebirthFlow.hasPending()) {
      let settled = false;
      try { settled = await rebirthFlow.settlePending(); } catch { settled = false; }
      if (!settled) return false;
    }
  }
  const now = Date.now();
  if (!force && now - lastSubmit < SUBMIT_EVERY_MS) return false;
  lastSubmit = now;
  const s = myStats();
  try {
    const caps = await boardCaps();
    if (SEASON2) {
      // v3: only onto the season-2 board (022). Before 022 runs, a season-2 client submits nothing.
      if (!caps.season2) return false;
      await rpc('lb_submit3', {
        p_secret: getSecret(),
        p_level: s.level,
        p_rebirths: s.rebirths,
        p_lifetime_words: s.lifetimeWords,
        p_lifetime_letters: s.lifetimeLetters,
        p_wins_per_word: s.winsPerWord,
        p_econ: SEASON2_ECON,
      });
    } else if (caps.econ) {
      // PV10 (016): the version-gated submit — the old lb_submit2 / lb_submit are no-ops once 016 runs.
      await rpc('lb_submit3', {
        p_secret: getSecret(),
        p_level: s.level,
        p_rebirths: s.rebirths,
        p_lifetime_words: s.lifetimeWords,
        p_lifetime_letters: s.lifetimeLetters,
        p_wins_per_word: s.winsPerWord,
        p_econ: caps.econ,
      });
    } else if (caps.letters) {
      await rpc('lb_submit2', {
        p_secret: getSecret(),
        p_level: s.level,
        p_rebirths: s.rebirths,
        p_lifetime_words: s.lifetimeWords,
        p_lifetime_letters: s.lifetimeLetters,
        p_wins_per_word: s.winsPerWord,
      });
    } else {
      await rpc('lb_submit', {
        p_secret: getSecret(),
        p_level: s.level,
        p_rebirths: s.rebirths,
        p_lifetime_words: s.lifetimeWords,
        p_wins_per_word: s.winsPerWord,
      });
    }
    // `at` = when the push was ANSWERED (≥ the DB's own now()): stamping the moment it was SENT let a slow first push
    // land < 5 s before the rebirth's own push, which the DB then throttled (e2e season2 @390: "LV 99 / 100").
    lastPush = { at: Date.now(), level: s.level, rebirths: s.rebirths, words: s.lifetimeWords, likely: !lastPush || now - lastPush.at > DB_THROTTLE_MS };
    // STEP 52: the cloud save rides the same push (throttled to once a minute; never lowers).
    if (caps.cloud) backupNow({ rpc, secret: getSecret(), econ: caps.econ });
    return true;
  } catch {
    return false;
  }
}

// ---- 021: SERVER-CHECKED REBIRTH (supabase/migrations/021_server_rebirth.sql; flow in rebirthFlow.js) ----------
/** The rebirth flow needs the CURRENT level on the server: push unless the last push already carried it and the DB
 *  will have taken it; if the last push is under 5 s old, wait it out first (the DB would drop it silently). */
async function pushForRebirth() {
  const s = myStats();
  if (lastPush && lastPush.likely && lastPush.level === s.level && lastPush.rebirths === s.rebirths && lastPush.words === s.lifetimeWords) return true;
  const wait = lastPush ? lastPush.at + DB_THROTTLE_MS + 250 - Date.now() : 0;
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
const rebirthFlow = makeRebirthFlow({
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
  // v3 ASCEND (season 2): `target` = the server's new ★ total, null = local
  localAscendReady: () => SEASON2 && (getRebirths() || 0) >= 10,
  applyAscend: (target) => ascendWithStars(target),
});
/**
 * THE rebirth action (021). Today's CONFIRM REBIRTH button and the REBIRTH READY one-tap call it; the v2 kit's
 * HOLD-TO-REBIRTH button calls it when its hold completes. Single-flight. Resolves to
 *   { ok:true, mode:'server'|'local', rc, stars }  — applied locally (server mode: on the server's count)
 *   { ok:false, reason:'pending'|'gate'|'wait'|'rate'|'offline'|'season'|'bad_request', gate?, level?, retry_in? }
 * Never throws.
 */
export async function performRebirth() {
  const res = await rebirthFlow.performRebirth();
  // the server checked an older level than this browser has (another tab pushed, or the DB dropped our push):
  // the next try pushes again instead of trusting the last push
  if (res && res.reason === 'gate' && res.mode === 'server' && lastPush && Number(res.level) < readLevel()) lastPush = { ...lastPush, likely: false };
  return res;
}
/** lb_rebirth with a persisted request id (no local apply) — performRebirth is the action; this is the raw call. */
export function requestRebirth() {
  return rebirthFlow.requestRebirth();
}
/** lb_ascend with a persisted request id (no local apply) — performAscend is the action. */
export function requestAscend() {
  return rebirthFlow.requestAscend();
}
/**
 * THE ascension (v3, season 2, R10+): server-checked through lb_ascend when the player has a season-2 board row
 * (022 live), else local. Single-flight with the rebirth. Resolves { ok:true, mode, stars, added } or
 * { ok:false, reason }. Never throws.
 */
export function performAscend() {
  return rebirthFlow.performAscend();
}
/** Is a server rebirth in flight? (the UI keeps the button disabled) */
export function rebirthPending() {
  return rebirthFlow.isBusy();
}

// ---- STEP 52: cloud save ----------------------------------------------------------------------
/**
 * On the menu: if this browser has a secret and the cloud save is AHEAD of local progress, import it
 * and report { restored: true } (the caller reloads). Also re-learns the profile after a wipe.
 */
export async function restoreFromCloud({ restore = true } = {}) {
  if (!LEADERBOARD_ENABLED || SEASON2) return { restored: false }; // v3: the season-2 save is local (phase 4)
  const secret = peekSecret();
  if (!secret) return { restored: false };
  const caps = await boardCaps();
  if (!caps.cloud) return { restored: false };
  const r = await restoreIfAhead({ rpc, secret, restore, econ: caps.econ });
  if (r.id && r.username && !getMyProfile()) saveMyProfile({ id: r.id, username: r.username });
  if (r.resetAll) return obeyDevReset(secret);
  return r;
}

/**
 * 012_admin_reset: the dev set profiles.reset_all for this name. Wipe like Stats → RESET ALL PROGRESS
 * but keep the claim + device secret, then lb_reset_ack stores the fresh save (the one time a LOWER
 * save is accepted), zeroes the board row and clears the flag. Leaves a notice for the reloaded menu.
 * Returns { reset: true } — the caller reloads so every module re-reads zeros. If the ack fails the
 * flag stays set and the next boot repeats this (the wipe is idempotent).
 */
export async function obeyDevReset(secret = peekSecret()) {
  wipeProgressKeys(localStorage, [SECRET_KEY, PROFILE_KEY]);
  let acked = false;
  try {
    const r = await rpc('lb_reset_ack', { p_secret: secret, p_blob: exportSave(), p_score: localScore().toString() });
    acked = !!(r && r.reset);
  } catch {
    acked = false;
  }
  try {
    localStorage.setItem(DEV_RESET_NOTICE_KEY, '1');
  } catch {
    /* blocked */
  }
  return { restored: false, reset: true, acked };
}
/**
 * N2 (Andy oct2): Stats → RESET ALL PROGRESS. Wipes every taw.* progress key but KEEPS the claimed
 * name + device secret, then asks the server (014 lb_self_reset — the admin reset path from 012) to
 * overwrite the cloud save with the fresh one and zero the board row. If the server half can't happen
 * (no name, offline, 014 not run yet) it falls back to the old local reset and drops the name + secret
 * too — keeping them without a server reset would let the next boot RESTORE the old cloud save (it is
 * strictly ahead) and silently undo the reset. Returns { server }.
 */
export async function selfReset() {
  const secret = peekSecret();
  wipeProgressKeys(localStorage, [SECRET_KEY, PROFILE_KEY]);
  let server = false;
  if (secret && LEADERBOARD_ENABLED && getMyProfile()) {
    try {
      const r = await rpc('lb_self_reset', { p_secret: secret, p_blob: exportSave(), p_score: localScore().toString() });
      server = !!(r && r.reset);
    } catch {
      server = false;
    }
  }
  if (!server) {
    // the old local-only reset — and the secret's cookie mirror too, or the next boot re-adopts the
    // secret from it and restores the old cloud save (the same undo, one layer down)
    wipeProgressKeys(localStorage, []);
    try {
      document.cookie = `${SECRET_COOKIE}=; max-age=0; path=/; samesite=lax; secure`;
    } catch {
      /* no cookies */
    }
  }
  return { server };
}
/** The one-shot "reset by the dev" notice (set by obeyDevReset before the reload): peek, then clear. */
export function hasDevResetNotice() {
  try {
    return localStorage.getItem(DEV_RESET_NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}
export function clearDevResetNotice() {
  try {
    localStorage.removeItem(DEV_RESET_NOTICE_KEY);
  } catch {
    /* blocked */
  }
}
/** A recovery code typed on a new device: adopt that identity, then restore. */
export async function adoptRecoveryCode(code) {
  const secret = parseRecoveryCode(code);
  if (!secret) return { ok: false, error: 'bad_code' };
  const caps = await boardCaps();
  if (!caps.cloud) return { ok: false, error: 'unavailable' };
  let loaded;
  try {
    loaded = caps.econ ? await rpc('lb_load2', { p_secret: secret, p_econ: caps.econ }) : await rpc('lb_load', { p_secret: secret });
  } catch {
    return { ok: false, error: 'unknown_code' };
  }
  try {
    localStorage.setItem(SECRET_KEY, secret);
  } catch {
    /* blocked */
  }
  writeSecretCookie(secret);
  if (loaded && loaded.id) saveMyProfile({ id: loaded.id, username: loaded.username });
  const r = await restoreIfAhead({ rpc, secret, econ: caps.econ });
  return { ok: true, restored: r.restored, username: loaded && loaded.username };
}

/** The top of the board + (if I have a name and I'm below it) my own row. */
// 017: `econ` is selected only once lb_caps says the view has it — and a PostgREST 400 (unknown column, e.g.
// the view was rebuilt by an older migration after 017) falls back to the select without it, for the session.
let econColBroken = false;
/** True when a board row's wins/word is from the CURRENT economy (or the DB can't say yet — pre-017). */
export function rowEconCurrent(row) {
  if (!row || row.econ === undefined || row.econ === null) return true; // pre-017: no econ column to judge by
  // v11 left WINS untouched, so a row last submitted on v10 still has a current wins/word. Rebirth Rush (econ 12)
  // deliberately keeps this at >= 10: RR wins only go UP (×5^R), so a 10/11 row shows a LOWER, never an inflated,
  // number until its next submit (the "—" exists for stale-high values like XAVI's 1e9); and an RR client on a
  // server without 018 writes RR numbers stamped econ 10, which gating on 12 would hide.
  return Number(row.econ) >= ECON_RPC_VERSION_V10;
}
export async function fetchBoard(limit = BOARD_SIZE) {
  if (!LEADERBOARD_ENABLED) return { rows: [], me: null };
  const caps = await boardCaps();
  // v3: the season-2 board carries ★ (its order is ★ → R → level; 022)
  const base = `rank,id,username,level,rebirths,lifetime_words,${caps.letters ? 'lifetime_letters,' : ''}wins_per_word${SEASON2 ? ',stars' : ''}`;
  let cols = caps.boardEcon && !econColBroken ? `${base},econ` : base;
  let r = await fetch(`${BASE}/rest/v1/${BOARD_VIEW}?select=${cols}&order=rank.asc&limit=${limit}`, { headers: headers() });
  if (!r.ok && r.status === 400 && cols !== base) {
    econColBroken = true;
    cols = base;
    r = await fetch(`${BASE}/rest/v1/${BOARD_VIEW}?select=${cols}&order=rank.asc&limit=${limit}`, { headers: headers() });
  }
  if (!r.ok) throw Object.assign(new Error(`http_${r.status}`), { code: `http_${r.status}` });
  const rows = await r.json();
  const mine = getMyProfile();
  let me = null;
  if (mine && mine.id && !rows.some((x) => x.id === mine.id)) {
    const r2 = await fetch(`${BASE}/rest/v1/${BOARD_VIEW}?select=${cols}&id=eq.${encodeURIComponent(mine.id)}`, { headers: headers() });
    if (r2.ok) me = (await r2.json())[0] || null;
  }
  return { rows, me };
}

// ---- BB3: THIS WEEK (013_weekly_board.sql) ------------------------------------------------------
/** The weekly board (words typed this ET week; resets Monday 00:00 ET in the DB) + my own row. */
export async function fetchWeekly(limit = BOARD_SIZE) {
  if (!LEADERBOARD_ENABLED) return { rows: [], me: null };
  const cols = 'rank,id,username,level,rebirths,week_words';
  const r = await fetch(`${BASE}/rest/v1/leaderboard_weekly?select=${cols}&order=rank.asc&limit=${limit}`, { headers: headers() });
  if (!r.ok) throw Object.assign(new Error(`http_${r.status}`), { code: `http_${r.status}` });
  const rows = await r.json();
  const mine = getMyProfile();
  let me = null;
  if (mine && mine.id && !rows.some((x) => x.id === mine.id)) {
    const r2 = await fetch(`${BASE}/rest/v1/leaderboard_weekly?select=${cols}&id=eq.${encodeURIComponent(mine.id)}`, { headers: headers() });
    if (r2.ok) me = (await r2.json())[0] || null;
  }
  return { rows, me };
}

const DOW = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
/** ms until the weekly board resets: the next Monday 00:00 in America/New_York (DST-safe to the hour). */
export function weekResetInMs(now = Date.now()) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(now))) parts[p.type] = p.value;
  const since = (((DOW[parts.weekday] || 0) * 24 + Number(parts.hour) % 24) * 60 + Number(parts.minute)) * 60 + Number(parts.second);
  return Math.max(0, 7 * 24 * 3600 - since) * 1000;
}
/** "3D 4H" / "4H 12M" / "12M" — the reset countdown, coarse on purpose. */
export function formatResetIn(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}D ${h}H`;
  if (h > 0) return `${h}H ${m % 60}M`;
  return `${Math.max(1, m)}M`;
}

// ---- STEP 47: pulling players in -------------------------------------------------------------
// The board's order, as a comparator: REBIRTHS desc, then LEVEL desc, then lifetime words desc
// (Andy oct3 19:55 — he ran this view on prod; 017_board_reality.sql carries it). A HYPOTHETICAL
// row (someone not on the board yet) loses every exact tie — the existing row got there first, the
// same rule the view's created_at tiebreak applies. KEEP IN SYNC WITH serverRankFor below.
export function ranksAhead(row, me) {
  const r = Number(row.rebirths) || 0;
  const l = Number(row.level) || 0;
  const w = Number(row.lifetime_words) || 0;
  const mr = Number(me.rebirths) || 0;
  const ml = Number(me.level) || 0;
  const mw = Number(me.lifetimeWords) || 0;
  if (r !== mr) return r > mr;
  if (l !== ml) return l > ml;
  return w >= mw;
}

/** The rank `stats` would take on a board whose top rows are `rows` (null if off the top-N). */
export function hypotheticalRank(rows, stats, size = BOARD_SIZE) {
  let ahead = 0;
  for (const row of rows) if (ranksAhead(row, stats)) ahead += 1;
  const rank = ahead + 1;
  return rank <= size ? rank : null;
}

const PROMPT_SESSION_KEY = 'taw.lb.promptShown'; // seen ON SCREEN this session
const PROMPT_CHECKED_KEY = 'taw.lb.promptChecked'; // the one board read this session already happened
const PROMPT_DISMISS_KEY = 'taw.lb.promptDismiss'; // { n, at } across sessions
const DISMISS_BACKOFF_MS = 7 * 24 * 3600 * 1000;
/** May the end-screen claim prompt run at all right now? (once per session; 3 ✕ → quiet for a week) */
export function claimPromptAllowed() {
  try {
    if (sessionStorage.getItem(PROMPT_SESSION_KEY) === '1') return false;
    if (sessionStorage.getItem(PROMPT_CHECKED_KEY) === '0') return false; // checked: off the board
    const d = JSON.parse(localStorage.getItem(PROMPT_DISMISS_KEY) || 'null');
    if (d && d.n >= 3 && Date.now() - d.at < DISMISS_BACKOFF_MS) return false;
    return true;
  } catch {
    return false; // no session storage → we can't keep "once per session", so never
  }
}
// The session's one board read, cached: the rank it found, or '0' for "not on the top N / failed".
function cachedPromptRank() {
  try { const v = sessionStorage.getItem(PROMPT_CHECKED_KEY); return v == null ? undefined : Number(v) || null; } catch { return null; }
}
function cachePromptRank(rank) {
  try { sessionStorage.setItem(PROMPT_CHECKED_KEY, String(rank || 0)); } catch { /* ignore */ }
}
export function markClaimPromptSeen() {
  try { sessionStorage.setItem(PROMPT_SESSION_KEY, '1'); } catch { /* ignore */ }
}
export function noteClaimPromptDismissed() {
  try {
    const d = JSON.parse(localStorage.getItem(PROMPT_DISMISS_KEY) || 'null') || { n: 0, at: 0 };
    const fresh = Date.now() - d.at >= DISMISS_BACKOFF_MS;
    localStorage.setItem(PROMPT_DISMISS_KEY, JSON.stringify({ n: (fresh && d.n >= 3 ? 0 : d.n) + 1, at: Date.now() }));
  } catch { /* ignore */ }
}

/** The PostgREST `or=` filter for "rows ranked ahead of (rebirths, level, words)" — ranksAhead, server-side. */
export function rankAheadFilter(rb, l, w) {
  return `(rebirths.gt.${rb},and(rebirths.eq.${rb},level.gt.${l}),and(rebirths.eq.${rb},level.eq.${l},lifetime_words.gte.${w}))`;
}

/**
 * The TRUE rank `stats` would take on the live board — counted on the SERVER (how many rows rank
 * ahead under the view's order: rebirths, then level, then words; an exact tie goes to the existing
 * row), so it is right past the visible top 10 (Andy oct2 LB10). null when offline.
 */
export async function serverRankFor(stats) {
  if (!LEADERBOARD_ENABLED || !stats) return null;
  const w = Math.max(0, Math.floor(Number(stats.lifetimeWords) || 0));
  const l = Math.max(1, Math.floor(Number(stats.level) || 1));
  const rb = Math.max(0, Math.floor(Number(stats.rebirths) || 0));
  const or = rankAheadFilter(rb, l, w);
  try {
    const r = await fetch(`${BASE}/rest/v1/${BOARD_VIEW}?select=id&or=${encodeURIComponent(or)}`, {
      method: 'HEAD',
      headers: { ...headers(), Prefer: 'count=exact' },
    });
    if (!r.ok) return null;
    const total = Number(String(r.headers.get('content-range') || '').split('/')[1]);
    return Number.isFinite(total) ? total + 1 : null;
  } catch {
    return null;
  }
}

/** The rank this browser's stats would claim right now — TRUE past the top 10 — or null (claimed
 *  already / offline). Never throws. */
export async function rankIfClaimed() {
  if (!LEADERBOARD_ENABLED || getMyProfile()) return null;
  // ONE rank read per session: a prompt that rendered below the fold and was never scrolled to can
  // come back on the next end screen with the cached rank, without asking the server again.
  const cached = cachedPromptRank();
  if (cached !== undefined) return cached;
  cachePromptRank(0); // claim the read before it starts (a second end screen mid-fetch won't refetch)
  try {
    const stats = myStats();
    let rank = await serverRankFor(stats);
    if (rank == null) {
      // the count endpoint failed: estimate from the top rows (a rank past them is unknown, not "unranked")
      const { rows } = await fetchBoard();
      rank = hypotheticalRank(rows, stats);
    }
    cachePromptRank(rank);
    return rank;
  } catch {
    return null;
  }
}

/** My current rank on the live board (claimed players only), or null. */
export async function fetchMyRank() {
  const mine = getMyProfile();
  if (!LEADERBOARD_ENABLED || !mine || !mine.id) return null;
  try {
    const r = await fetch(`${BASE}/rest/v1/${BOARD_VIEW}?select=rank&id=eq.${encodeURIComponent(mine.id)}`, { headers: headers() });
    if (!r.ok) return null;
    const row = (await r.json())[0];
    return row ? Number(row.rank) : null;
  } catch {
    return null;
  }
}

const LAST_RANK_KEY = 'taw.lb.lastRank';
const RANK_NEWS_KEY = 'taw.lb.rankNews';
// H2a: where an UNSEEN rise started. The menu's checkRankUp moves lastRank to the new rank, so by the
// time the board opens lastRank already equals it — this keeps the "from" for the board's ▲N slide.
// Held until the board has LOADED (the oldest unseen rank wins, so two rises read as one bigger one).
// It is independent of the trophy's news flag: the menu clears that flag the moment the trophy is
// tapped, before the board has read anything, so the board must not depend on it.
const RANK_FROM_KEY = 'taw.lb.rankFrom';
// Bumped every time the board is opened. A checkRankUp that STARTED before an open must not write
// when it lands after it — or a stale result would re-raise the news / rankFrom the board just
// consumed, and the next open would replay the same ▲N.
let boardSeenEpoch = 0;
export function markBoardSeen() { boardSeenEpoch += 1; }
export function getBoardSeenEpoch() { return boardSeenEpoch; }
export function getRankFrom() {
  try { const n = Number(localStorage.getItem(RANK_FROM_KEY)); return Number.isFinite(n) && n > 0 ? n : null; } catch { return null; }
}
export function clearRankFrom() {
  try { localStorage.removeItem(RANK_FROM_KEY); } catch { /* ignore */ }
}
/**
 * The board's rank move since it was last opened: { from, to } when `now` is better than the rank the
 * player last SAW (the pending rankFrom, else lastRank), else null. Pure read — the caller stores.
 */
export function rankMoveSinceSeen(now) {
  const to = Number(now);
  if (!Number.isFinite(to) || to <= 0) return null;
  const from = getRankFrom() || getLastRank();
  return from && to < from ? { from, to } : null;
}
export function getLastRank() {
  try { const n = Number(localStorage.getItem(LAST_RANK_KEY)); return Number.isFinite(n) && n > 0 ? n : null; } catch { return null; }
}
export function setLastRank(n) {
  try { if (Number.isFinite(n) && n > 0) localStorage.setItem(LAST_RANK_KEY, String(n)); } catch { /* ignore */ }
}
export function hasRankNews() {
  try { return localStorage.getItem(RANK_NEWS_KEY) === '1'; } catch { return false; }
}
export function setRankNews(on) {
  try { if (on) localStorage.setItem(RANK_NEWS_KEY, '1'); else localStorage.removeItem(RANK_NEWS_KEY); } catch { /* ignore */ }
}

/**
 * Menu-mount check: compares my live rank with the last one this browser saw. Returns
 * { from, to } when it IMPROVED (and raises the trophy-badge flag), else null. Stores the new rank
 * either way, so a drop never shows a moment and the next rise is measured from the truth.
 */
export async function checkRankUp(epoch = boardSeenEpoch) {
  const now = await fetchMyRank();
  if (!now) return null;
  // the board was opened since this check began: it already took the baseline; this result is stale
  if (epoch !== boardSeenEpoch) return null;
  const before = getLastRank();
  const prev = getRankBaseline();
  const cur = { rb: getRebirths() || 0, lv: readLevel() };
  const up = applyRankCheck(now);
  setRankBaseline(cur); // every check re-baselines: a rebirth is measured against the visit before it
  if (up) return up;
  return rivalCheck({ before, now, prev, cur, epoch });
}

// ---- extensions-spec a: RIVAL PINGS (dormant, flagOn('rival')) ------------------------------------
// A DROP names who passed you — one extra board read, only on a drop that could ping. Never across my own
// rebirth / reset (the board ranks rebirths, then level: either moves me on its own, not a pass).
const LAST_RB_KEY = 'taw.lb.lastRb';
const LAST_LV_KEY = 'taw.lb.lastLv';
const RIVAL_LOG_KEY = 'taw.lb.rival'; // { day, n, last } — 3 a day, never the same passer twice in a row
export function getRankBaseline() {
  try {
    const rb = localStorage.getItem(LAST_RB_KEY);
    const lv = localStorage.getItem(LAST_LV_KEY);
    if (rb == null || lv == null) return null;
    return { rb: Number(rb), lv: Number(lv) };
  } catch {
    return null;
  }
}
export function setRankBaseline({ rb, lv }) {
  try {
    localStorage.setItem(LAST_RB_KEY, String(Number(rb) || 0));
    localStorage.setItem(LAST_LV_KEY, String(Number(lv) || 1));
  } catch { /* ignore */ }
}
function readRivalLog() {
  try { return JSON.parse(localStorage.getItem(RIVAL_LOG_KEY) || 'null'); } catch { return null; }
}
function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** The row just above `rank` on the live board (not me), or null. One GET. */
export async function fetchRowAbove(rank) {
  if (!LEADERBOARD_ENABLED) return null;
  const mine = getMyProfile();
  try {
    const r = await fetch(`${BASE}/rest/v1/${BOARD_VIEW}?select=rank,id,username,level,rebirths&rank=lt.${Number(rank)}&order=rank.desc&limit=2`, { headers: headers() });
    if (!r.ok) return null;
    const rows = await r.json();
    return (rows || []).find((x) => !mine || x.id !== mine.id) || null;
  } catch {
    return null;
  }
}
/** { kind: 'passed', name, from, to, levels } when a rival ping should show, else null. Records it. */
export async function rivalCheck({ before, now, prev, cur, epoch = boardSeenEpoch }) {
  if (!flagOn('rival')) return null;
  // cheap guards first: no board read unless this drop could ping
  if (rankChange(before, now) !== 'drop' || ownDropSince(prev, cur) || now > RIVAL_MAX_RANK) return null;
  const passer = await fetchRowAbove(now);
  if (epoch !== boardSeenEpoch) return null;
  const today = localDay();
  const ping = rivalPing({ before, now, prev, cur, passer, log: readRivalLog(), today });
  if (!ping) return null;
  try { localStorage.setItem(RIVAL_LOG_KEY, JSON.stringify(nextRivalLog(readRivalLog(), ping.name, today))); } catch { /* ignore */ }
  return { kind: 'passed', ...ping };
}

/** The storage half of checkRankUp, given the live rank (exported for the unit test). */
export function applyRankCheck(now) {
  const before = getLastRank();
  setLastRank(now);
  if (before && now < before) {
    try { if (!getRankFrom()) localStorage.setItem(RANK_FROM_KEY, String(before)); } catch { /* ignore */ }
    setRankNews(true);
    return { from: before, to: now };
  }
  return null;
}

// ---- STEP 61: redeem codes ---------------------------------------------------------------------
// Codes live server-side (supabase/migrations/007_redeem_codes.sql): Andy adds rows in the Table
// Editor; the server checks expiry, the use cap and one-per-player. A redeemed code's wins do NOT
// land directly — they queue as a claim (Andy oct2: everything outside a game is CLAIMED), so the
// REWARDS badge lights and the player taps it in.
// Returns { ok: true, code, wins, label } or { ok: false, reason } where reason is one of
// bad_code / expired / used_up / already_redeemed / rate_limited / not_ready (007 not applied) /
// offline.
export const REDEEM_REASONS = {
  bad_code: "THAT CODE DOESN'T EXIST",
  expired: 'THAT CODE HAS EXPIRED',
  used_up: 'THAT CODE HAS BEEN USED UP',
  already_redeemed: 'YOU ALREADY REDEEMED THAT CODE',
  rate_limited: 'TOO MANY TRIES — WAIT AN HOUR',
  not_ready: 'CODES AREN’T SWITCHED ON YET',
  offline: 'COULDN’T REACH THE SERVER — TRY AGAIN',
};
export function normaliseCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
}
export async function redeemCode(raw) {
  const code = normaliseCode(raw);
  if (code.length < 3) return { ok: false, reason: 'bad_code' };
  if (!LEADERBOARD_ENABLED) return { ok: false, reason: 'not_ready' };
  const secret = getSecret();
  if (!secret) return { ok: false, reason: 'offline' };
  let res;
  try {
    res = await rpc('lb_redeem', { p_secret: secret, p_code: code });
  } catch (e) {
    const m = String((e && e.code) || '');
    if (/rate_limited/.test(m)) return { ok: false, reason: 'rate_limited' };
    if (/lb_redeem|PGRST202|http_404|Could not find the function/i.test(m)) return { ok: false, reason: 'not_ready' };
    return { ok: false, reason: 'offline' };
  }
  if (!res || res.error) return { ok: false, reason: (res && REDEEM_REASONS[res.error] && res.error) || 'bad_code' };
  // R10 (migration 010): a code may be a BOOST (×boost_mult on every mode for boost_min minutes) and a
  // wins code may be PER-LEVEL (wins × the player's level at claim). Before 010 runs the response has
  // none of these fields and this is exactly the old wins code. Floats are fine (no-caps).
  const wins = Math.max(0, Number(res.wins) || 0);
  const label = String(res.label || res.code).toUpperCase();
  if (res.kind === 'boost') {
    const mult = Number(res.boost_mult) > 1 ? Math.floor(Number(res.boost_mult)) : 3;
    const min = Number(res.boost_min) > 0 ? Number(res.boost_min) : 10;
    queueClaim({ id: `code:${res.code}`, kind: 'boost', label: `BOOST — ${label}`, amount: 0, meta: { mult, min } });
    return { ok: true, code: res.code, kind: 'boost', mult, min, wins: 0, label: res.label || res.code };
  }
  const perLevel = res.per_level === true;
  queueClaim({ id: `code:${res.code}`, kind: 'code', label: `CODE — ${label}`, amount: wins, meta: perLevel ? { perLevel: true } : undefined });
  return { ok: true, code: res.code, wins, perLevel, label: res.label || res.code };
}
