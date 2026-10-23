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

import { SEASON2 } from '../progress/season.js';

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
  'taw.raceWords', // oct14: WORD RACE game words (count toward the rebirth gate + lifetime words)
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
  // REBIRTH RUSH: the rolled marks (roll state + the PERMANENT marks they paid for), the fractional wins
  // carry, OVERDRIVE's played-time toward the next trigger (and a live window), and the one-time
  // "YOUR LEVELS BECAME +N REBIRTHS" notice — all progress, none of it device state
  'taw.markRolls',
  'taw.permanentMarks',
  'taw.unlisted', // THE UNLISTED (oct17): found gears + their serials (src/unlisted/unlisted.js)
  'taw.winsCarry',
  'taw.overdrive',
  'taw.rrnotice',
  // GEMS: the roll currency (balance, the LEVEL_UP high-water mark, the win streak, the starting-grant stamp)
  'taw.gems',
  // SAVE CODE FIX (oct22): progress a code silently left behind — the hero you play as, today's DAILY CONTRACTS (so a
  // claimed contract can't be claimed again on the new device), the one-time WORD SENSE refund stamp (without it the
  // refund pays out a second time), the UNLISTED 11:11 wish, and a live boost window
  'taw.main',
  'taw.contracts',
  'taw.wordsenseRefunded',
  'taw.ulwish',
  'taw.boost',
];
// PV10 must-fix 4: migration keys that must NOT survive from THIS browser when a restored blob lacks them.
// Without the blob's own econ stamp the v10 migration has to re-run on the restored (older) save after the
// reload; a local shadow or grandfathered gate belongs to the save being replaced.
// A pending REBIRTH RUSH notice is the replaced save's moment too (the conversion re-queues its own if it re-runs).
// GEMS: a restored blob without taw.gems gets its OWN starting grant on the next boot (from its wins), never this
// browser's balance.
export const REMOVE_IF_ABSENT = ['taw.econ', 'taw.xpv10', 'taw.rbgate', 'taw.rrnotice', 'taw.gems'];

// SEASON 2 (Andy oct8: "you need a button for people to save their progress"): every season-2 save key lives under
// `taw.s2.` (v3/store.js S2_PREFIX — xp, rebirths, power, wins, gems, stock, claims, counters …). None of them were on
// the list above, so a save code carried NO season-2 progress. The prefix is allowlisted as a whole; device / one-shot
// UI keys under it are excluded by name.
export const S2_PREFIX_KEY = 'taw.s2.';
const S2_DEVICE = new Set(['taw.s2.seenWelcome', 'taw.s2.platePick']);
export const isProgressKey = (k) => PROGRESS_KEYS.includes(k) || (typeof k === 'string' && k.startsWith(S2_PREFIX_KEY) && !S2_DEVICE.has(k));
/** Every key this storage holds under the season-2 prefix (Storage-like with length/key(i), else none). */
function s2KeysOf(storage) {
  const out = [];
  try {
    const n = Number(storage.length);
    if (Number.isFinite(n) && typeof storage.key === 'function') {
      for (let i = 0; i < n; i++) {
        const k = storage.key(i);
        if (isProgressKey(k) && !PROGRESS_KEYS.includes(k)) out.push(k);
      }
    }
  } catch {
    /* no enumeration: the season-2 keys are simply not exported */
  }
  return out;
}

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
    get length() {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.length : 0;
      } catch {
        return 0;
      }
    },
    key(i) {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.key(i) : null;
      } catch {
        return null;
      }
    },
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
  for (const k of [...PROGRESS_KEYS, ...s2KeysOf(storage)]) {
    const v = storage.getItem(k);
    if (v != null) keys[k] = v; // omit absent keys; a "new player" simply exports fewer
  }
  return utf8ToB64(JSON.stringify({ format: FORMAT, v: 1, keys }));
}

const SEASON2_ECON = 13; // leaderboard/season2Rules.js (not imported: this file is on the first-load path)
// Short reasons; saveCode.js (SETTINGS, lazy) turns each into a plain-English sentence.
const ERR = {
  notOurs: "That isn't a Type a Word save code. Nothing was changed.",
  damaged: 'That save code is corrupted (not readable). Nothing was changed.',
  noProgress: 'That save code has no progress to restore. Nothing was changed.',
  season1: "That's a season 1 code: season 2 started fresh. Nothing was changed.",
};
const fail = (reason) => ({ ok: false, reason, error: ERR[reason] });
/**
 * Validate a decoded save object WITHOUT writing anything → { ok, keys } | { ok:false, reason, error }. Only
 * allowlisted keys with string values survive. In SEASON 2 a code from before the season (taw.econ < 13, or none) is
 * refused: loading it stamped the old econ and the season-2 boot then wiped the whole save (oct21 audit B4).
 */
export function parseSaveObject(obj, { season2 = SEASON2 } = {}) {
  if (!obj || obj.format !== FORMAT || typeof obj.keys !== 'object' || obj.keys === null) return fail('notOurs');
  // Strict allowlist: only known progress keys, only string values. Device keys / unknown keys /
  // non-string values are dropped here — they can never reach storage.
  const keys = {};
  for (const k of Object.keys(obj.keys)) {
    if (!isProgressKey(k)) continue; // the allowlist (+ the season-2 prefix)
    const v = obj.keys[k];
    if (typeof v !== 'string') return fail('damaged');
    keys[k] = v;
  }
  if (Object.keys(keys).length === 0) return fail('noProgress');
  const econ = keys['taw.econ'];
  if (season2 && !(econ != null && Number(econ) >= SEASON2_ECON)) return fail('season1');
  return { ok: true, keys };
}

// Parse + validate a PLAIN (v1) save code WITHOUT writing anything. Returns { ok, keys } or { ok:false, error }.
// (Any code a player pastes — the compact TAW2 code, a mangled paste — goes through saveCode.js parseAnySave.)
export function parseSave(text, opts) {
  const trimmed = String(text == null ? '' : text).replace(/\s+/g, '');
  if (!trimmed) return fail('notOurs');
  let obj;
  try {
    obj = JSON.parse(b64ToUtf8(trimmed));
  } catch {
    return fail(trimmed.startsWith('eyJ') ? 'damaged' : 'notOurs');
  }
  return parseSaveObject(obj, opts);
}

// The save as it was just before the last restore (a pasted code, or the cloud bringing a save back) — so a wrong
// paste can be undone (SETTINGS → UNDO LAST RESTORE), and support can see what was replaced. Device-only: never
// exported (not a progress key).
export const PRE_RESTORE_KEY = 'taw.preRestore';

/** Write already-validated keys (parseSave / parseSaveObject) — after snapshotting the save they replace.
 *  `source`: 'code' (a pasted save code — SETTINGS offers UNDO for it) or 'restore' (the cloud; no UNDO: the cloud
 *  would only bring the higher save back on the next load). */
export function writeSaveKeys(keys, storage = defaultStorage(), { snapshot = true, source = 'restore' } = {}) {
  if (snapshot) {
    try {
      storage.setItem(PRE_RESTORE_KEY, JSON.stringify({ at: Date.now(), src: source, code: exportSave(storage) }));
    } catch {
      /* quota: the restore still goes ahead */
    }
  }
  for (const [k, v] of Object.entries(keys)) {
    storage.setItem(k, v);
  }
  // PV10: the blob's econ stamp is written above when it has one; when it has none (a pre-STEP-52 or
  // pre-v10 blob) the LOCAL stamp, shadow and gate are removed so the migration re-runs on reload.
  for (const k of REMOVE_IF_ABSENT) {
    if (!Object.prototype.hasOwnProperty.call(keys, k) && typeof storage.removeItem === 'function') {
      try {
        storage.removeItem(k);
      } catch {
        /* never throw */
      }
    }
  }
  return { ok: true, imported: Object.keys(keys).length };
}

// Restore from a plain save code. Validates fully first (parseSave), then writes ONLY the allowlisted
// progress keys. On any validation failure it writes nothing and returns the readable error, so a
// corrupt code never wipes or partially clobbers existing progress. Device keys are never touched.
export function importSave(text, storage = defaultStorage(), opts) {
  const parsed = parseSave(text, opts);
  if (!parsed.ok) return parsed;
  return writeSaveKeys(parsed.keys, storage, opts);
}
