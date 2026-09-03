// schema.js — VERSIONED save envelope for Type a Word (feat/save-schema, branch-only, DO NOT MERGE).
//
// The world today is 23 loose `taw.*` progression keys (see saveBackup.PROGRESS_KEYS). This module
// adds a single versioned record — `taw.save = { v: <int>, data: { '<key>': '<raw string>', … } }` —
// built from those loose keys, upgradeable through a pure migration chain, and export/import-able.
//
// SAFETY MODEL (see claude/save-migration-plan.md):
//   • v0 = today's world: the loose keys, read verbatim. `data` is keyed by the SAME key names.
//   • Migrations are PURE `(data) => data`; v0→v1 transforms NO player value (a byte-for-byte wrap),
//     v1→v2 is a stub that only proves the chain runs in order (it touches a test-only scratch key,
//     never a real one).
//   • loadSave(): read `taw.save`; if absent/corrupt, rebuild from the loose keys; migrate to CURRENT;
//     write `taw.save` back ATOMICALLY (one setItem). Never throws, never wipes.
//   • Legacy keys are KEPT and still READ as the v0 source; this module NEVER deletes them. (The
//     steady-state cutover that also STOPS the 23 module writers from writing legacy is the separate,
//     supervised Tier-1 step — not done here; that's why the loose keys stay authoritative for now and
//     `taw.save` is the versioned mirror + export source.)
//
// Because a single `setItem('taw.save', …)` is atomic and legacy is never deleted, there is no
// destructive half-state: at every instant either `taw.save` is absent (legacy is the truth) or it is
// present and WHOLE. A crash between reading legacy and writing `taw.save` just leaves the legacy
// world, which the next load rebuilds. Idempotent.

import { PROGRESS_KEYS } from './saveBackup.js';

// The current on-disk schema version. Bump this + append a migration when the shape changes.
export const CURRENT_VERSION = 2;
export const SAVE_KEY = 'taw.save';
const FORMAT = 'taw-save-v'; // export envelope tag (distinct from saveBackup's 'taw-save')

// The migration chain. `MIGRATIONS[n]` upgrades a `data` object from version n to n+1 and MUST be a
// pure function of `data` (clone-in, clone-out is fine; it's called on an already-cloned object).
// v0→v1: a verbatim wrap — it transforms NO real player value. (The `taw.__probe` line only fires for
//         the ordering test's scratch key; real saves have no `taw.__probe`, so this is identity.)
// v1→v2: STUB proving the chain runs in order (same scratch-key-only no-op on real data).
const MIGRATIONS = [
  function migrate_0_to_1(data) {
    if (Object.prototype.hasOwnProperty.call(data, 'taw.__probe')) data['taw.__probe'] += ':v1';
    return data;
  },
  function migrate_1_to_2(data) {
    if (Object.prototype.hasOwnProperty.call(data, 'taw.__probe')) data['taw.__probe'] += ':v2';
    return data;
  },
];

// Guarded default storage (same shape saveBackup uses; tests inject a Map-backed stub).
function defaultStorage() {
  return {
    getItem(k) {
      try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch { return null; }
    },
    setItem(k, v) {
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch { /* quota/blocked */ }
    },
  };
}

// UTF-8-safe base64 (mirrors saveBackup).
function utf8ToB64(s) { return btoa(unescape(encodeURIComponent(s))); }
function b64ToUtf8(b) { return decodeURIComponent(escape(atob(b))); }

// Build the v0 record from the loose keys — reads each progression key VERBATIM (present keys only).
export function buildV0FromLegacy(storage = defaultStorage()) {
  const data = {};
  for (const k of PROGRESS_KEYS) {
    const v = storage.getItem(k);
    if (v != null) data[k] = v; // omit absent keys — a "new player" simply has fewer
  }
  return { v: 0, data };
}

// Is this a structurally valid `{ v:int, data:object }`?
function isValidSave(s) {
  return !!s && Number.isInteger(s.v) && typeof s.data === 'object' && s.data !== null && !Array.isArray(s.data);
}

// Run the migration chain from `save.v` up to CURRENT_VERSION, in order. PURE: never mutates the
// input (deep-clones `data` first). Throws on a structurally invalid save or an out-of-range version
// so callers can try/catch and fall back — it never silently produces garbage.
export function migrate(save) {
  if (!isValidSave(save)) throw new Error('migrate: invalid save envelope');
  if (save.v > CURRENT_VERSION) throw new Error(`migrate: save is newer (v${save.v}) than app (v${CURRENT_VERSION})`);
  let data = JSON.parse(JSON.stringify(save.data)); // clone — migrations may mutate freely
  for (let v = save.v; v < CURRENT_VERSION; v += 1) {
    const step = MIGRATIONS[v];
    if (typeof step !== 'function') throw new Error(`migrate: no migration for v${v}→v${v + 1}`);
    data = step(data);
    if (data == null || typeof data !== 'object') throw new Error(`migrate: v${v}→v${v + 1} returned non-object`);
  }
  return { v: CURRENT_VERSION, data };
}

// The current, fully-migrated save built fresh from the loose keys — always reflects live progress.
export function currentSave(storage = defaultStorage()) {
  return migrate(buildV0FromLegacy(storage));
}

// LOAD: detect `taw.save`; migrate it (in case CURRENT advanced) OR rebuild from legacy; write back
// atomically. NEVER throws, NEVER wipes: on any parse/migrate failure it falls back to the legacy
// world (which is still present). Returns the in-memory migrated save even if the write-back fails.
export function loadSave(storage = defaultStorage()) {
  let save = null;
  const raw = storage.getItem(SAVE_KEY);
  if (raw != null) {
    try {
      const parsed = JSON.parse(raw);
      save = migrate(parsed); // upgrade an older stored version to CURRENT
    } catch {
      save = null; // corrupt or newer-than-app → fall back to legacy below
    }
  }
  if (save == null) {
    try { save = currentSave(storage); } catch { save = { v: CURRENT_VERSION, data: {} }; }
  }
  // Atomic write-back (single setItem). If it throws (quota), we still return the in-memory save and
  // the legacy keys are untouched, so the next load recovers.
  try { storage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* quota/blocked — legacy intact */ }
  return save;
}

// EXPORT: a copyable base64 code of the CURRENT migrated save (always fresh from legacy).
export function exportVersionedSave(storage = defaultStorage()) {
  const save = currentSave(storage);
  return utf8ToB64(JSON.stringify({ format: FORMAT, ...save }));
}

// Parse + validate an exported versioned code WITHOUT writing. Returns { ok, save } or { ok:false,error }.
// Only PROGRESS_KEYS with string values survive into `save.data` (strict allowlist — a code can never
// carry a device key or an unknown key into storage). Runs it through the migration chain so an OLD
// export upgrades to CURRENT on import.
export function parseVersionedSave(text) {
  const trimmed = String(text == null ? '' : text).trim();
  if (!trimmed) return { ok: false, error: 'Paste a save code first.' };
  let json;
  try { json = b64ToUtf8(trimmed); } catch { return { ok: false, error: "That doesn't look like a save code." }; }
  let obj;
  try { obj = JSON.parse(json); } catch { return { ok: false, error: 'That save code is corrupted. Nothing was changed.' }; }
  if (!obj || obj.format !== FORMAT || !isValidSave(obj)) {
    return { ok: false, error: "That isn't a versioned save code. Nothing was changed." };
  }
  let migrated;
  try { migrated = migrate({ v: obj.v, data: obj.data }); } catch { return { ok: false, error: 'That save code is from a newer version. Nothing was changed.' }; }
  // Strict allowlist: keep only known progress keys with string values.
  const data = {};
  for (const k of PROGRESS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(migrated.data, k)) {
      const v = migrated.data[k];
      if (typeof v !== 'string') return { ok: false, error: 'That save code is corrupted (bad field). Nothing was changed.' };
      data[k] = v;
    }
  }
  if (Object.keys(data).length === 0) return { ok: false, error: 'That save code has no progress to restore. Nothing was changed.' };
  return { ok: true, save: { v: migrated.v, data } };
}

// IMPORT: validate fully, then restore. Because the live game still READS the loose keys, import
// writes the restored progress BOTH into `taw.save` and back into the loose keys (allowlisted), so the
// running app sees the restored progress immediately. On any validation failure it writes nothing.
export function importVersionedSave(text, storage = defaultStorage()) {
  const parsed = parseVersionedSave(text);
  if (!parsed.ok) return parsed;
  for (const [k, v] of Object.entries(parsed.save.data)) storage.setItem(k, v); // restore into legacy (the read path)
  try { storage.setItem(SAVE_KEY, JSON.stringify(parsed.save)); } catch { /* quota */ }
  return { ok: true, imported: Object.keys(parsed.save.data).length };
}
