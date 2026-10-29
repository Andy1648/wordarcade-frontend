// saveCode.js — the SAVE CODE a player copies in SETTINGS → SAVE PROGRESS (Andy oct22 "fix save code - its buggy").
//
// WHAT WAS BROKEN: the code was base64 of the whole save's JSON. A player with a few thousand collected words had a
// 250,000+ character code, and the paste box cut everything past 200,000 — so the biggest saves (the players who care
// most) could never be restored, and the message said "corrupted". Nothing could tell a cut-off code from a typo.
//
// THE CODE NOW:   TAW2.<base64url(gzip(save JSON))>.<crc32 of the middle, 8 hex>
//   * ~3× shorter (gzip, as the cloud copy — cloudCodec.js), and URL-safe (no + or / for a chat app to mangle);
//   * the CHECKSUM at the END: a code whose end is missing has no checksum → "this code is cut off"; a code that was
//     changed fails it → "this code got changed while it was copied". Never a vague "corrupted".
//   * SYNC (fflate, not CompressionStream): COPY has to put the code on the clipboard inside the tap (Safari drops
//     the permission after an await), and old school iPads / Chromebooks lack CompressionStream.
// EVERY OLDER CODE STILL LOADS: a plain (v1) base64 code, any season, and the packed cloud copy (`tawz1:`).
//
// LAZY: only SETTINGS / STATS (their own chunks) load this; the first-load bundle keeps saveBackup.js alone (payload
// ratchet), so the paste cleaning and the plain-English messages live here.
import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';
import { exportSave, parseSaveObject, writeSaveKeys, PRE_RESTORE_KEY } from './saveBackup.js';
import { isMissingRpc, progressScoreFromKeys } from './cloudSave.js';

export const CODE_PREFIX = 'TAW2.';
const CLOUD_PREFIX = 'tawz1:'; // the gzip-packed cloud copy (cloudCodec.js)
const PLAIN_HEAD = 'eyJ'; // a plain (v1) code is base64 of '{"'

// ---- tolerant paste cleaning ------------------------------------------------------------------------------------------
// Players move codes through Google Docs, Classroom, Discord, notes apps and email. Those add line breaks, spaces,
// non-breaking / zero-width characters, "smart quotes" around the code, or a sentence in front ("my save: …"); a chat
// app may turn a `+` into a space. None of that is the code: strip it before reading.
const INVISIBLE = /[\s\u00a0\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u2064\u3000\ufeff]/g;
const WRAPPERS = /[\u0022\u0027\u0060\u00ab\u00bb\u2018-\u201f\u2039\u203a<>()[\]{}]/g;
/** The code inside whatever was pasted: invisible characters and wrapping quotes gone, any text before it dropped. */
export function cleanPaste(text) {
  let s = String(text == null ? '' : text).replace(INVISIBLE, '').replace(WRAPPERS, '');
  for (const p of [CODE_PREFIX, CLOUD_PREFIX, PLAIN_HEAD]) {
    const i = s.indexOf(p);
    if (i >= 0) {
      s = s.slice(i);
      break;
    }
  }
  return s.replace(/[.,;:!?]+$/, ''); // a sentence's full stop after the code (never part of any code's alphabet)
}

// Plain-English answers (shown upper-cased in SETTINGS). Every one says nothing was changed.
export const SAVE_ERRORS = {
  empty: 'Paste a save code first.',
  cutOff: 'This code is cut off — the end is missing. Copy the WHOLE code again. Nothing was changed.',
  startMissing: 'The start of this code is missing. Copy the WHOLE code again. Nothing was changed.',
  changed: 'This code got changed while it was copied. Copy it again and paste it as it is. Nothing was changed.',
  damaged: 'This code is cut off or damaged. Copy the WHOLE code again. Nothing was changed.',
  notOurs: "That isn't a TYPE A WORD save code. Nothing was changed.",
  noProgress: 'That save code has no progress in it. Nothing was changed.',
  season1: "That's a SEASON 1 code. Season 2 started everyone fresh, so it can't be loaded. Your save was not touched.",
};
/** parseSaveObject's short reason → the sentence. */
const said = (r) => (r.ok ? r : { ...r, error: SAVE_ERRORS[r.reason] || SAVE_ERRORS.damaged });

/** A plain (v1) code → its JSON text, or null. Tries the code as pasted, then with a chat app's `+`→space undone. */
function legacyJson(clean, raw) {
  const tries = [clean];
  const spaced = cleanPaste(String(raw == null ? '' : raw).trim().replace(/ /g, '+'));
  if (spaced !== clean) tries.push(spaced);
  for (const t of tries) {
    try {
      const b64 = t.replace(/-/g, '+').replace(/_/g, '/'); // a URL-safe copy of the code
      const json = strFromU8(b64ToBytes(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
      JSON.parse(json);
      return json;
    } catch {
      /* next */
    }
  }
  return null;
}

/** { at, src, code } of the save the last restore replaced (saveBackup.writeSaveKeys), or null. */
export function readPreRestore(storage = globalThis.localStorage) {
  // (`secret`: the bare device secret the replaced save had — UNDO puts it back when the save had no claimed account)
  try {
    const o = JSON.parse(storage.getItem(PRE_RESTORE_KEY) || 'null');
    return o && typeof o.code === 'string' && Number.isFinite(o.at) ? o : null;
  } catch {
    return null;
  }
}

// CRC-32 (IEEE) over the code's middle — the same checksum zip and PNG use.
let TABLE = null;
export function crc32(str) {
  if (!TABLE) {
    TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < str.length; i += 1) c = TABLE[(c ^ str.charCodeAt(i)) & 0xff] ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

function bytesToB64(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}
function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}
const toUrl = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromUrl = (u) => {
  const b = u.replace(/-/g, '+').replace(/_/g, '/');
  return b + '='.repeat((4 - (b.length % 4)) % 4);
};

/** This browser's save as the compact code (TAW2) — WITH the board account (daan oct27), so loading the code brings the
 *  account back too. `storage` as saveBackup.exportSave (tests inject a stub). */
export function exportSaveCode(storage) {
  const json = atobUtf8(exportSave(storage, { account: true }));
  const mid = toUrl(bytesToB64(gzipSync(strToU8(json), { level: 9, mtime: 0 })));
  return `${CODE_PREFIX}${mid}.${crc32(mid)}`;
}
// exportSave hands back base64 of UTF-8 JSON; the JSON itself is what gets packed
function atobUtf8(b64) {
  return strFromU8(b64ToBytes(b64));
}

/** A cleaned TAW2 code → { ok, json } | { ok:false, error } (the plain-English reason). */
function decodeTaw2(clean) {
  const body = clean.slice(CODE_PREFIX.length);
  const dot = body.lastIndexOf('.');
  const sum = dot >= 0 ? body.slice(dot + 1).toLowerCase() : '';
  if (dot < 0 || !/^[0-9a-f]{8}$/.test(sum)) return { ok: false, error: SAVE_ERRORS.cutOff };
  const mid = body.slice(0, dot);
  if (!/^[A-Za-z0-9_-]+$/.test(mid) || crc32(mid) !== sum) return { ok: false, error: SAVE_ERRORS.changed };
  try {
    return { ok: true, json: strFromU8(gunzipSync(b64ToBytes(fromUrl(mid)))) };
  } catch {
    return { ok: false, error: SAVE_ERRORS.changed };
  }
}
/** The packed cloud copy (cloudCodec.js packBlob: tawz1: + base64(gzip(JSON))). */
function decodeCloud(clean) {
  try {
    return { ok: true, json: strFromU8(gunzipSync(b64ToBytes(fromUrl(clean.slice(CLOUD_PREFIX.length))))) };
  } catch {
    return { ok: false, error: SAVE_ERRORS.damaged };
  }
}

/**
 * ANY save code (TAW2, plain v1 of any season, the cloud's tawz1) → { ok, keys } | { ok:false, error }, writing
 * nothing. `opts.season2` as saveBackup.parseSaveObject (a season-1 code is refused in season 2).
 */
export function parseAnySave(text, opts) {
  const clean = cleanPaste(text);
  if (!clean) return { ok: false, error: SAVE_ERRORS.empty };
  let d = null;
  if (clean.startsWith(CODE_PREFIX)) d = decodeTaw2(clean);
  else if (clean.startsWith(CLOUD_PREFIX)) d = decodeCloud(clean);
  else if (clean.startsWith(PLAIN_HEAD)) {
    const json = legacyJson(clean, text);
    d = json == null ? { ok: false, error: SAVE_ERRORS.damaged } : { ok: true, json };
  } else if (/^[0-9a-f]{8}$/i.test(clean.slice(clean.lastIndexOf('.') + 1)) && clean.lastIndexOf('.') > 0) {
    return { ok: false, error: SAVE_ERRORS.startMissing }; // the end of a TAW2 code with its start cut away
  } else return { ok: false, error: SAVE_ERRORS.notOurs };
  if (!d.ok) return d;
  let obj;
  try {
    obj = JSON.parse(d.json);
  } catch {
    return { ok: false, error: SAVE_ERRORS.damaged };
  }
  return withAccount(obj, said(parseSaveObject(obj, opts)));
}

// ---- THE ACCOUNT a code carries (daan oct27) ----------------------------------------------------------------------------
// A board account is only the device secret + the claimed profile. daan's browser lost them; his progress came back under
// a NEW name whose row could never catch up, and his old row was orphaned. A code now carries them (`acct`) and loading it
// adopts them. A code with a MANGLED account is refused whole (it was changed) — never half-applied.
const SECRET_RE = /^[0-9a-f]{32,64}$/;
/** A valid { secret, profile: { id, username } } or null. */
export function cleanAccount(a) {
  if (!a || typeof a !== 'object') return null;
  const secret = typeof a.secret === 'string' ? a.secret.toLowerCase() : '';
  const p = a.profile;
  if (!SECRET_RE.test(secret) || !p || typeof p !== 'object') return null;
  if (typeof p.id !== 'string' || !p.id || p.id.length > 64 || typeof p.username !== 'string' || !p.username || p.username.length > 40) return null;
  return { secret, profile: { id: p.id, username: p.username } };
}
function withAccount(obj, r) {
  if (!r.ok || obj.acct == null) return r;
  const acct = cleanAccount(obj.acct);
  return acct ? { ...r, acct } : { ok: false, reason: 'damaged', error: SAVE_ERRORS.damaged };
}
// per-account board state that must not follow the save onto another account (rank caches, the rival, pending ids)
const ACCOUNT_STATE_KEYS = ['taw.lb.rbreq', 'taw.lb.ascreq', 'taw.lb.lastRank', 'taw.lb.rankFrom', 'taw.lb.rankNews', 'taw.lb.rival', 'taw.lb.lastLv', 'taw.lb.lastRb'];
/** Make `acct` this browser's board account (secret, profile, the secret's cookie mirror). Returns true when it changed. */
export function adoptAccount(acct, storage = globalThis.localStorage) {
  const a = cleanAccount(acct);
  if (!a || !storage) return false;
  let same = false;
  try {
    const p = JSON.parse(storage.getItem('taw.lb.profile') || 'null');
    same = storage.getItem('taw.lb.secret') === a.secret && !!p && p.id === a.profile.id;
  } catch {
    same = false;
  }
  if (same) return false;
  for (const k of ACCOUNT_STATE_KEYS) {
    try { storage.removeItem(k); } catch { /* never throw */ }
  }
  try {
    storage.setItem('taw.lb.secret', a.secret);
    storage.setItem('taw.lb.profile', JSON.stringify(a.profile));
  } catch {
    return false;
  }
  try {
    if (typeof document !== 'undefined') document.cookie = `taw_lb=${a.secret}; max-age=${400 * 24 * 3600}; path=/; samesite=lax; secure`; // client.js SECRET_COOKIE
  } catch {
    /* no cookies: localStorage holds it */
  }
  return true;
}
/** Write a parsed code (keys, then its account) — the ONE door every code restore goes through. */
export function applySave(parsed, storage, opts) {
  const res = writeSaveKeys(parsed.keys, storage, opts);
  if (parsed.acct) adoptAccount(parsed.acct, storage || globalThis.localStorage);
  else if (opts && opts.exact) restoreBareSecret(storage || globalThis.localStorage, opts.secret);
  return res;
}
/** UNDO of a load onto a device whose save carried NO claimed account: put its identity back exactly — the bare device
 *  secret it had (`secret`, recorded in the snapshot), or none — so the account that load adopted does not stay (the next
 *  boot's cloud restore for it would bring the undone save straight back). The adopted account is not lost: the snapshot
 *  the undo just took (taw.preRestore) carries it, and so does the code it came from. */
function restoreBareSecret(storage, secret) {
  if (!storage) return;
  const s = typeof secret === 'string' && SECRET_RE.test(secret) ? secret : null;
  try {
    if (s && storage.getItem('taw.lb.secret') === s && !storage.getItem('taw.lb.profile')) return; // nothing was adopted
  } catch {
    /* fall through */
  }
  for (const k of ['taw.lb.secret', 'taw.lb.profile', SHORT_CACHE_KEY, ...ACCOUNT_STATE_KEYS]) {
    try { storage.removeItem(k); } catch { /* never throw */ }
  }
  try {
    if (s) storage.setItem('taw.lb.secret', s);
  } catch {
    /* blocked */
  }
  try {
    if (typeof document !== 'undefined') {
      document.cookie = s ? `taw_lb=${s}; max-age=${400 * 24 * 3600}; path=/; samesite=lax; secure` : 'taw_lb=; max-age=0; path=/; samesite=lax; secure'; // client.js SECRET_COOKIE
    }
  } catch {
    /* no cookies */
  }
}

/** Restore from ANY save code: validates fully first, snapshots the replaced save (taw.preRestore), then writes. */
export function importAnySave(text, storage, opts) {
  const parsed = parseAnySave(text, opts);
  if (!parsed.ok) return parsed;
  return applySave(parsed, storage, opts);
}

// ---- SHORT CODES (071_short_save_codes.sql; Andy oct27 "much shorter") ----------------------------------------------------
// The long TAW2 code lives on the server under 10 characters from an alphabet with nothing to misread (no 0 O 1 I L),
// shown K7M2Q-X9PAH. One code per account, kept for good; COPY again refreshes what it holds. The stored value IS the
// TAW2 code, so a loaded short code goes through exactly the checks a pasted long one does (CRC, whole-save validation,
// season) before a single key is written. Without 071 (or offline) COPY hands out the long code instead.
export const SHORT_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const SHORT_RE = new RegExp(`^[${SHORT_ALPHABET}]{10}$`);
/** The 10-character code in what was typed / pasted (any case, spaces, dashes, quotes), or null. */
export function normalizeShort(text) {
  const s = String(text == null ? '' : text).replace(INVISIBLE, '').replace(WRAPPERS, '').replace(/[-_.]/g, '').toUpperCase();
  return SHORT_RE.test(s) ? s : null;
}
/** K7M2QX9PAH → K7M2Q-X9PAH */
export const formatShort = (code) => (code && code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : String(code || ''));

export const SHORT_ERRORS = {
  not_found: 'NO SAVE WITH THAT CODE',
  bad_code: 'CHECK THE CODE — 10 LETTERS AND NUMBERS',
  busy: 'TOO MANY TRIES — WAIT A MINUTE',
  offline: 'NO CONNECTION — TRY AGAIN',
  unavailable: 'SHORT CODES ARE OFF — USE THE LONG CODE',
};
const shortFail = (reason) => ({ ok: false, reason, error: SHORT_ERRORS[reason] || SHORT_ERRORS.offline });

// NEVER SHRINK A CODE (save-safety oct28): SETTINGS uploads this device's save the moment it opens (so COPY can put the
// code on the clipboard inside the tap) and the server REPLACES what the account's code holds. A device BEHIND the code —
// the second device of a shared account, a heavy save whose cloud copy is too big to back up — opened SETTINGS to paste
// the code and silently overwrote it with its own lower save first: the code then loaded the LOWER save. Each device now
// remembers its account's code (taw.lb.saveCode — account state, not progress: never inside a save code); with it known,
// the upload first reads what the code holds and KEEPS it when it is ahead of this device (the same progress score the
// cloud restore and the load confirm compare). A device that never saw its code (a wiped browser that kept only its
// secret cookie) cannot know it and uploads as before.
export const SHORT_CACHE_KEY = 'taw.lb.saveCode';
const storeOf = (storage) => storage || (typeof localStorage !== 'undefined' ? localStorage : null);
/** The short code this device last issued / loaded for board account `profileId`, or null. */
export function cachedShortCode(profileId, storage) {
  try {
    const o = JSON.parse(storeOf(storage).getItem(SHORT_CACHE_KEY) || 'null');
    return o && profileId && o.id === profileId ? normalizeShort(o.code) : null;
  } catch {
    return null;
  }
}
export function rememberShortCode(profileId, code, storage) {
  const c = normalizeShort(code);
  if (!profileId || !c) return;
  try {
    storeOf(storage).setItem(SHORT_CACHE_KEY, JSON.stringify({ id: profileId, code: c }));
  } catch {
    /* blocked: the next open just uploads unguarded, as before */
  }
}
const S2_DUP = ['taw.xp', 'taw.xpv10', 'taw.rebirths'];
/** A save's progress score (cloudSave.progressScoreFromKeys, as converted) from a getter; a season-2 save's mapped keys
 *  fall back to their taw.s2.* copy (an unpatched storage, or a code that carries only one of the two). */
export function saveScore(get) {
  const keys = {};
  for (const k of ['taw.xp', 'taw.xpv10', 'taw.econ', 'taw.rebirths', 'taw.letters', 'taw.s2.stars']) {
    let v = get(k);
    if (v == null && S2_DUP.includes(k)) v = get(`taw.s2.${k.slice(4)}`);
    if (v != null) keys[k] = v;
  }
  return progressScoreFromKeys(keys, { asConverted: true });
}
const NET = new Set(['offline', 'busy', 'unavailable']);

/** Upload this browser's save (the TAW2 code, with the account) → { ok, code } | { ok:false, reason }. Never throws.
 *  With `profileId` and this device's remembered code for that account, a code holding a save AHEAD of this device is
 *  kept, not replaced → { ok, code, kept: true, held } (`held` = the parsed save it holds, for the UI to offer). */
export async function issueShortCode({ rpc, secret, storage, profileId = null } = {}) {
  if (!rpc || !secret) return shortFail('unavailable');
  const known = profileId ? cachedShortCode(profileId, storage) : null;
  if (known) {
    const held = await fetchShortSave(known, { rpc });
    if (held.ok && (!held.acct || held.acct.profile.id === profileId)) {
      const s = storeOf(storage);
      const mine = saveScore((k) => {
        try { return s.getItem(k); } catch { return null; }
      });
      const theirs = saveScore((k) => (Object.prototype.hasOwnProperty.call(held.keys, k) ? held.keys[k] : null));
      if (theirs > mine) return { ok: true, code: known, kept: true, held };
    } else if (!held.ok && NET.has(held.reason)) {
      return shortFail(held.reason); // can't see what the code holds: never overwrite it blind
    }
  }
  let blob;
  try {
    blob = exportSaveCode(storage);
  } catch {
    return shortFail('unavailable');
  }
  try {
    const r = await rpc('lb_save_code_put', { p_secret: secret, p_blob: blob });
    const code = r && r.ok ? normalizeShort(r.code) : null;
    if (code && profileId) rememberShortCode(profileId, code, storage);
    return code ? { ok: true, code } : shortFail(r && r.reason === 'busy' ? 'busy' : 'unavailable');
  } catch (e) {
    return shortFail(isMissingRpc(e) || (e && e.status >= 400 && e.status < 500) ? 'unavailable' : 'offline');
  }
}

/** A short code → the save it holds, PARSED and VALIDATED (nothing written) → parseAnySave's shape. Never throws. */
export async function fetchShortSave(text, { rpc, ...opts } = {}) {
  const code = normalizeShort(text);
  if (!code) return shortFail('bad_code');
  if (!rpc) return shortFail('unavailable');
  let r;
  try {
    r = await rpc('lb_save_code_get', { p_code: code });
  } catch (e) {
    return shortFail(isMissingRpc(e) ? 'unavailable' : 'offline');
  }
  if (!r || !r.ok || typeof r.blob !== 'string') return shortFail((r && r.reason) || 'not_found');
  return parseAnySave(r.blob, opts);
}
