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

/** This browser's save as the compact code (TAW2). `storage` as saveBackup.exportSave (tests inject a stub). */
export function exportSaveCode(storage) {
  const json = atobUtf8(exportSave(storage));
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
  return said(parseSaveObject(obj, opts));
}

/** Restore from ANY save code: validates fully first, snapshots the replaced save (taw.preRestore), then writes. */
export function importAnySave(text, storage, opts) {
  const parsed = parseAnySave(text, opts);
  if (!parsed.ok) return parsed;
  return writeSaveKeys(parsed.keys, storage, opts);
}
