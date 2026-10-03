// saveBackup.js — "copy my save" / "restore from this string" for Type a Word (feat/save-export).
//
// This is the RECOVERY PATH ONLY — it ships BEFORE any versioned-save migration. It reads and writes
// the CURRENT loose `taw.*` keys directly; there is no schema change and no `taw.save` blob yet.
//
// It moves PROGRESS ONLY. The five device/UX keys (mute, volume, clack, the one-shot hint, sfx flags)
// are deliberately excluded so a save code carries your account, not a device's audio settings.
//
// SAFETY: importing VALIDATES the whole blob before writing a single key, so a corrupt code can never
// half-wipe progress; and it writes through a strict allowlist (PROGRESS_KEYS), so an import can never
// touch a device key or any key not on the list — even if the blob claims to contain one.

// The 28 progression keys a backup carries. (The 5 excluded device/UX keys: taw.seenWinsHint,
// taw.sfxEvents, taw.clack, taw.audioVolume, taw.musicMuted — never exported, never imported.)
export const PROGRESS_KEYS = [
  'taw.wins',
  'taw.winsLifetime',
  'taw.xp',
  'taw.rebirths',
  'taw.keytier',
  'taw.wordsense',
  'taw.momentum',
  'taw.forge',
  'taw.forgeFromMomentum',
  'taw.claims',
  'taw.rankClaimed',
  'taw.frenzyUntil',
  'taw.frenzyCount',
  'taw.mark',
  'taw.marksOwned',
  'taw.marksRevealed',
  'taw.markWords',
  'taw.stars',
  'taw.letters',
  // STEP 52: everything a restored save needs to not re-run a one-time migration or re-reveal
  'taw.econ',
  'taw.themesRetired',
  'taw.menuTierSeen',
  'taw.wallTierSeen',
  'taw.layer.forge',
  'taw.layer.marks',
  'taw.layer.stars',
  'taw.layer.auto',
  'wa_words',
  'taw.mastery',
  'taw.collection',
  'taw.achievements',
  'taw.records',
  'taw.records.seen',
  'taw.streak',
  'taw.equipped',
  'taw.owned',
  'taw.themesOwned',
  'taw.freeUnlocks',
  'taw.theme',
  'taw.chain.runs',
  'taw.fuse.runs',
  'taw.rounds',
  'taw.returnClaim',
  'taw.wpm',
  // PROGRESSION v10: the level-state shadow (a stale old-bundle write can't raise the level), the one-time
  // grandfathered rebirth gate, and the one-time "LEVELS NOW TAKE LONGER" notice flag
  'taw.xpv10',
  'taw.rbgate',
  'taw.pv10notice',
];
// PV10 must-fix 4: migration keys that must NOT survive from THIS browser when a restored blob lacks them.
// Without the blob's own econ stamp the v10 migration has to re-run on the restored (older) save after the
// reload; a local shadow or grandfathered gate belongs to the save being replaced.
export const REMOVE_IF_ABSENT = ['taw.econ', 'taw.xpv10', 'taw.rbgate'];

const FORMAT = 'taw-save';

// UTF-8-safe base64 (values are ASCII-ish today, but be safe against any unicode in a name/theme).
function utf8ToB64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

// Default storage = a guarded localStorage wrapper; tests inject a Map-backed stub.
function defaultStorage() {
  return {
    getItem(k) {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null;
      } catch {
        return null;
      }
    },
    setItem(k, v) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
      } catch {
        /* quota / blocked — ignore, never throw */
      }
    },
    removeItem(k) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
      } catch {
        /* blocked — ignore, never throw */
      }
    },
  };
}

// Snapshot the present progress keys into one base64 code the player can copy.
export function exportSave(storage = defaultStorage()) {
  const keys = {};
  for (const k of PROGRESS_KEYS) {
    const v = storage.getItem(k);
    if (v != null) keys[k] = v; // omit absent keys; a "new player" simply exports fewer
  }
  return utf8ToB64(JSON.stringify({ format: FORMAT, v: 1, keys }));
}

// Parse + validate a save code WITHOUT writing anything. Returns { ok, keys } or { ok:false, error }.
// `error` is a short player-readable sentence. Only PROGRESS_KEYS with string values survive.
export function parseSave(text) {
  const trimmed = String(text == null ? '' : text).trim();
  if (!trimmed) return { ok: false, error: 'Paste a save code first.' };
  let json;
  try {
    json = b64ToUtf8(trimmed);
  } catch {
    return { ok: false, error: "That doesn't look like a Type a Word save code." };
  }
  let obj;
  try {
    obj = JSON.parse(json);
  } catch {
    return { ok: false, error: 'That save code is corrupted (not readable). Nothing was changed.' };
  }
  if (!obj || obj.format !== FORMAT || typeof obj.keys !== 'object' || obj.keys === null) {
    return { ok: false, error: "That isn't a Type a Word save code. Nothing was changed." };
  }
  // Strict allowlist: only known progress keys, only string values. Device keys / unknown keys /
  // non-string values are dropped here — they can never reach storage.
  const keys = {};
  for (const k of PROGRESS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj.keys, k)) {
      const v = obj.keys[k];
      if (typeof v !== 'string') {
        return { ok: false, error: 'That save code is corrupted (bad field). Nothing was changed.' };
      }
      keys[k] = v;
    }
  }
  if (Object.keys(keys).length === 0) {
    return { ok: false, error: 'That save code has no progress to restore. Nothing was changed.' };
  }
  return { ok: true, keys };
}

// Restore from a save code. Validates fully first (parseSave), then writes ONLY the allowlisted
// progress keys. On any validation failure it writes nothing and returns the readable error, so a
// corrupt code never wipes or partially clobbers existing progress. Device keys are never touched.
export function importSave(text, storage = defaultStorage()) {
  const parsed = parseSave(text);
  if (!parsed.ok) return parsed;
  for (const [k, v] of Object.entries(parsed.keys)) {
    storage.setItem(k, v);
  }
  // PV10: the blob's econ stamp is written above when it has one; when it has none (a pre-STEP-52 or
  // pre-v10 blob) the LOCAL stamp, shadow and gate are removed so the migration re-runs on reload.
  for (const k of REMOVE_IF_ABSENT) {
    if (!Object.prototype.hasOwnProperty.call(parsed.keys, k) && typeof storage.removeItem === 'function') {
      try {
        storage.removeItem(k);
      } catch {
        /* never throw */
      }
    }
  }
  return { ok: true, imported: Object.keys(parsed.keys).length };
}
