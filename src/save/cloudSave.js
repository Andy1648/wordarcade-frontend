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
  let lv = 1;
  try {
    lv = Math.max(1, Math.floor(num(JSON.parse(get('taw.xp') || '{}').lv) || 1));
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
  for (const k of ['taw.xp', 'taw.rebirths', 'taw.letters']) {
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

// ---- network (injected so this file stays testable and client.js owns the transport) -------------
/**
 * Back up now if due. `rpc` = client.js rpc; `secret` = the device secret. Never throws.
 */
export async function backupNow({ rpc, secret, force = false, storage } = {}) {
  if (!rpc || !secret) return false;
  const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  try {
    const last = Number(s && s.getItem(LAST_BACKUP_KEY)) || 0;
    if (!force && Date.now() - last < BACKUP_EVERY_MS) return false;
    const blob = exportSave();
    const r = await rpc('lb_save', { p_secret: secret, p_blob: blob, p_score: localScore(s).toString() });
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
export async function restoreIfAhead({ rpc, secret, storage } = {}) {
  if (!rpc || !secret) return { restored: false };
  try {
    const r = await rpc('lb_load', { p_secret: secret });
    if (!r || !r.blob) return { restored: false, username: r && r.username, id: r && r.id };
    const d = shouldRestore(r.blob, storage);
    if (!d.restore) return { restored: false, username: r.username, id: r.id, reason: d.reason };
    const res = importSave(r.blob);
    return { restored: !!res.ok, username: r.username, id: r.id };
  } catch {
    return { restored: false };
  }
}
