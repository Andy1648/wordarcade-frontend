// cloudCodec.js — the CLOUD copy of a save, gzip-packed (oct21 progression bug audit, B2).
//
// The server caps a cloud blob at 65,536 characters (006_cloud_save.sql: a CHECK on the table, and every lb_save* /
// lb_reset_ack / lb_self_reset RPC raises 'bad_blob' above it). A save code is base64(JSON) of every progress key, and
// taw.collection alone reaches ~140 KB at its 5,000-word detail cap, so a heavy SAT/CHAIN/FUSE player crossed the cap
// around 1,300–1,500 distinct words. From then on every backup was REFUSED and the error swallowed: the cloud silently
// kept an older and older copy (which a restore or a second device then trusted).
//
// The fix, two halves: the cloud copy is gzip-compressed (~2.7× smaller; tagged `tawz1:` so a reader knows to inflate
// it), and 056_cloud_blob_1mb.sql lifts the server cap to 1 MB — packing alone only moves the wall to ~4,000 words. Old plain blobs (and save codes typed by hand) still read exactly as before. A blob that
// is STILL over the cap after packing is not sent at all — the caller records why (BACKUP_FAIL_KEY) instead of
// pretending it saved.
// Everything here is async (CompressionStream); a browser without it sends the plain code, as before.

export const PACK_PREFIX = 'tawz1:';
// 056_cloud_blob_1mb.sql raised the server cap to 1 MB (before it runs, a bigger blob is refused and recorded)
export const CLOUD_BLOB_CAP = 1048576;
export const BACKUP_FAIL_KEY = 'taw.cloudBackupFail';

const hasStreams = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function' && typeof Blob === 'function';

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
async function pipe(bytes, stream) {
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * A save code (base64 of the JSON) → the smallest form to send: `tawz1:` + base64(gzip(JSON bytes)) when that is
 * shorter, else the code itself. Never throws (a failure sends the plain code).
 */
export async function packBlob(code) {
  if (typeof code !== 'string' || !code || !hasStreams()) return code;
  try {
    const packed = PACK_PREFIX + bytesToB64(await pipe(b64ToBytes(code), new CompressionStream('gzip')));
    return packed.length < code.length ? packed : code;
  } catch {
    return code;
  }
}

/** Whatever the cloud holds → a plain save code parseSave can read (a plain blob passes through untouched). */
export async function unpackBlob(blob) {
  if (typeof blob !== 'string' || !blob.startsWith(PACK_PREFIX)) return blob;
  if (!hasStreams()) return null; // a packed blob this browser can't read: treat as no usable cloud copy
  try {
    return bytesToB64(await pipe(b64ToBytes(blob.slice(PACK_PREFIX.length)), new DecompressionStream('gzip')));
  } catch {
    return null;
  }
}

/** Does this (packed) blob fit the server's cap? */
export const fitsCloud = (blob) => typeof blob === 'string' && blob.length > 0 && blob.length <= CLOUD_BLOB_CAP;

/** Remember why the last backup did not go out (size or server refusal) — read by support/debugging, cleared on success. */
export function noteBackupFail(storage, reason, size) {
  try {
    if (storage) storage.setItem(BACKUP_FAIL_KEY, JSON.stringify({ at: Date.now(), reason: String(reason || 'error'), size: Number(size) || 0 }));
  } catch {
    /* storage blocked */
  }
}
export function clearBackupFail(storage) {
  try {
    if (storage) storage.removeItem(BACKUP_FAIL_KEY);
  } catch {
    /* storage blocked */
  }
}
