// cloudSave.js — STEP 52 (Andy oct2): a friend's progress reset. Progress now also lives in Supabase,
// tied to the claimed username's device secret, and comes back by itself.
//
// WHY PROGRESS DISAPPEARS (claude/cloud-save/investigation.md): Safari/iOS deletes all script-written
// storage of a site not visited for 7 days (ITP); in-app browsers (Discord, Instagram, TikTok) and
// embeds keep storage separate from Safari/Chrome, so the "same" game opened from a chat link starts
// at LV 1; "clear history / website data" wipes it; a private window never had it. None of these is
// a bug in the save — the save simply lived in ONE browser's localStorage.
//
// THE PIECES
//   * BACKUP: the game's own validated save export (save/saveBackup.js) goes to lb_save every time the
//     menu pushes stats (throttled), with a PROGRESS SCORE. The DB ignores a save with a lower score.
//   * RESTORE: on the menu, if the cloud's score beats this browser's, the cloud save is imported (only
//     allowlisted progress keys, validated first) and the page reloads into it. A restore can never
//     LOWER progress: it only ever runs when the cloud is strictly ahead.
//   * RECOVERY CODE: the device secret, shown once at claim time as a readable code. Typing it on a new
//     device (or after a wipe) adopts that secret, and the restore above brings the save back.
//   * The secret is also kept in a long-lived first-party cookie, so a wipe of localStorage alone (or
//     a storage-only clear) does not lose the identity.
//
// Feature-detected: until supabase/migrations/006_cloud_save.sql is applied, lb_caps() reports no
// `cloud` and every call here is a no-op.
import { exportSave, importSave, parseSave } from './saveBackup.js';
import { resolveXpState } from '../progress/xp.js';

// PROGRESSION v10 (016_econ_v10.sql): when lb_caps reports econ: 10 the save goes through the
// version-gated lb_save2 / lb_load2 (p_econ = 10); the old lb_save becomes a no-op there so an old
// bundle can't write. Before 016 is run, the old functions are used unchanged.
export const ECON_RPC_VERSION = 12;
// REBIRTH RUSH (018_rebirth_rush.sql): the client speaks econ 12. Until Andy runs 018, a server with only
// 016/017 reports econ: 10 and its lb_submit3 / lb_save2 / lb_load2 accept p_econ = 10 ONLY — so the client
// sends what the server reports (never more than 12): 018 in → 12 (and v10 / v11 tabs are refused), 016 only
// → 10 (as before), neither → the old RPCs. (No server ever reports 11: v11's 018 was never run — it became
// 018_rebirth_rush.sql — so 11 falls to 10 like any 016-era value.) A stale v11 bundle sends at most 11 and a
// stale v10 bundle 10, so once 018 runs both are out.
export const ECON_RPC_VERSION_V10 = 10;
/** The p_econ to send for the server's lb_caps.econ: 12, 10, or 0 (= use the old RPCs). */
export function econRpcArg(serverEcon) {
  const e = Number(serverEcon);
  if (e >= ECON_RPC_VERSION) return ECON_RPC_VERSION;
  if (e >= ECON_RPC_VERSION_V10) return ECON_RPC_VERSION_V10;
  return 0;
}
// `econ` (backupNow / restoreIfAhead): true = ECON_RPC_VERSION, a number = that p_econ, falsy = old RPCs.
const econArg = (econ) => (econ === true ? ECON_RPC_VERSION : Number(econ) > 0 ? Number(econ) : 0);

const LAST_BACKUP_KEY = 'taw.cloud.lastBackup';
const BACKUP_EVERY_MS = 60 * 1000;

// ---- progress score: a single number that only goes up with real progress ------------------------
// Rebirths dominate, then level, then lifetime letters (a monotone counter), then lifetime wins.
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
export function progressScoreFromKeys(keys) {
  const get = (k) => (keys && Object.prototype.hasOwnProperty.call(keys, k) ? keys[k] : null);
  // PV10: the AUTHORITATIVE level — the v10 shape, a converted legacy one, or (after a stale
  // old-bundle write) the v10 shadow. The migration keeps every level, so the score is unchanged by it.
  let lv = 1;
  try {
    lv = Math.max(1, Math.floor(num(resolveXpState(get).level) || 1));
  } catch {
    lv = 1;
  }
  // NO CAPS (Andy oct2): rebirths are the top key and UNCAPPED (was 999); level and letters are
  // sub-keys, each bounded below 1e12 only so it can never spill into the key above (level 1e12 and
  // a trillion letters are not reachable). Every old score is <= the new score for the same save, so
  // a stored cloud save never blocks the next one. The DB column becomes plain numeric (011_no_caps).
  const rb = Math.floor(num(get('taw.rebirths')));
  const SUB = 10n ** 12n;
  const lvKey = BigInt(Math.min(Math.floor(lv), 1e12 - 1));
  const letters = BigInt(Math.min(Math.floor(num(get('taw.letters'))), 1e12 - 1));
  return BigInt(rb) * SUB * SUB + lvKey * SUB + letters;
}
export function localScore(storage) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return 0n;
  const keys = {};
  for (const k of ['taw.xp', 'taw.xpv10', 'taw.econ', 'taw.rebirths', 'taw.letters']) {
    try {
      const v = s.getItem(k);
      if (v != null) keys[k] = v;
    } catch {
      /* blocked */
    }
  }
  return progressScoreFromKeys(keys);
}

// ---- recovery code ------------------------------------------------------------------------------
// The secret is 48 hex chars; shown as 12 groups of 4 so it can be read aloud or retyped.
export function formatRecoveryCode(secret) {
  const s = String(secret || '').toUpperCase().replace(/[^0-9A-F]/g, '');
  return s.match(/.{1,4}/g)?.join('-') || '';
}
export function parseRecoveryCode(text) {
  const s = String(text || '').toLowerCase().replace(/[^0-9a-f]/g, '');
  return s.length >= 32 && s.length <= 64 ? s : null;
}

// ---- the decision, pure ---------------------------------------------------------------------------
/** Restore iff the cloud blob is valid and STRICTLY ahead of this browser. */
export function shouldRestore(cloudBlob, storage) {
  if (!cloudBlob) return { restore: false, reason: 'none' };
  const parsed = parseSave(cloudBlob);
  if (!parsed.ok) return { restore: false, reason: 'invalid' };
  const cloud = progressScoreFromKeys(parsed.keys);
  const local = localScore(storage);
  if (cloud > local) return { restore: true, cloud, local };
  return { restore: false, reason: 'local-ahead', cloud, local };
}

// ---- admin FULL RESET (012_admin_reset.sql) -------------------------------------------------------
/**
 * Wipe exactly like Stats → RESET ALL PROGRESS (every taw.* key) except the `keep` keys — the claimed
 * name and the device secret, so the player stays on the board. Returns the removed key count.
 */
export function wipeProgressKeys(storage, keep = []) {
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return 0;
  const doomed = [];
  try {
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i);
      if (k && k.startsWith('taw.') && !keep.includes(k)) doomed.push(k);
    }
    doomed.forEach((k) => s.removeItem(k));
  } catch {
    /* storage blocked */
  }
  return doomed.length;
}
export const DEV_RESET_NOTICE_KEY = 'taw.devResetNotice';

// ---- network (injected so this file stays testable and client.js owns the transport) -------------
/**
 * Back up now if due. `rpc` = client.js rpc; `secret` = the device secret. Never throws.
 */
export async function backupNow({ rpc, secret, force = false, storage, econ = false } = {}) {
  if (!rpc || !secret) return false;
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  try {
    const last = Number(s && s.getItem(LAST_BACKUP_KEY)) || 0;
    if (!force && Date.now() - last < BACKUP_EVERY_MS) return false;
    const blob = exportSave();
    const body = { p_secret: secret, p_blob: blob, p_score: localScore(s).toString() };
    const pe = econArg(econ);
    const r = pe ? await rpc('lb_save2', { ...body, p_econ: pe }) : await rpc('lb_save', body);
    if (s) s.setItem(LAST_BACKUP_KEY, String(Date.now()));
    return !!(r && r.saved);
  } catch {
    return false;
  }
}

/**
 * Restore from the cloud if it is ahead. Returns { restored, username } — the caller reloads the
 * page when restored (every module re-reads its keys). Never lowers progress, never throws.
 */
export async function restoreIfAhead({ rpc, secret, storage, restore = true, econ = false } = {}) {
  if (!rpc || !secret) return { restored: false };
  try {
    const pe = econArg(econ);
    const r = pe ? await rpc('lb_load2', { p_secret: secret, p_econ: pe }) : await rpc('lb_load', { p_secret: secret });
    // 012_admin_reset: the dev flagged this profile for a FULL RESET — that outranks any restore (the
    // cloud copy is the progress being reset). The caller obeys via obeyDevReset in client.js.
    if (r && r.reset_all === true) return { restored: false, resetAll: true, username: r.username, id: r.id };
    if (!restore) return { restored: false, username: r && r.username, id: r && r.id, reason: 'check-only' };
    if (!r || !r.blob) return { restored: false, username: r && r.username, id: r && r.id };
    const d = shouldRestore(r.blob, storage);
    if (!d.restore) return { restored: false, username: r.username, id: r.id, reason: d.reason };
    const res = importSave(r.blob);
    return { restored: !!res.ok, username: r.username, id: r.id };
  } catch {
    return { restored: false };
  }
}
