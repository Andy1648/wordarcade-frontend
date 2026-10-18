// unlisted.js — THE UNLISTED: the gear tier you cannot roll, buy or be told about. You FIND it.
//
// WHY. "People have been begging me for secret gear" (Andy oct17). The one SECRET gear (ORIGIN) is a 1-in-15,000 roll,
// which is a long grind, not a secret. A Pokémon secret rare is numbered PAST the set total (223/197) — its identity is
// "not on the list". So this tier is not on the list: it has no odds, it is not in the roll pool, nothing in the shop
// sells it, and the index shows it only as riddles. Each gear is one of the five word-secrets the game already hides
// (secrets/secrets.js), plus one per season that never comes back.
//
// THE RULES (load-bearing — the players include minors):
//   1. NO RANDOMNESS YOU CAN PAY INTO. The MIDAS gear rides the existing 1-in-750 golden word, which is free play,
//      never gems. Nothing here reads or spends a currency.
//   2. NO ODDS, ANYWHERE. A tile is a riddle, never "1 IN X". `unlistedIndex` has no odds field to leak.
//   3. NOT STRONGER THAN ORIGIN. A worn UNLISTED pays the PERMANENT main (the LEGENDARY ×3 on wins AND XP, like the
//      achievement gears) — a trophy you can wear, never the reason a number is large.
//   4. THE SERIAL IS THE BRAG. "#0042" is your discovery rank for that gear, handed out by the server in the order the
//      finds arrive (supabase 052_unlisted.sql). Until the server answers it reads "#····" — never a made-up number.
//
// Pure + a guarded read/write of ONE storage key (injectable, so every rule is unit-testable). It survives rebirth and
// the season reset: the key is not one of the season-2 progression keys (v3/install.js maps only those).

import { UNLISTED_KEY, UNLISTED_TIER } from './unlistedIds.js';
export { UNLISTED_KEY, UNLISTED_TIER };
/** The season this build is in. A season gear is findable only while its season is the current one. */
export const CURRENT_SEASON = 2;

// `secret` = the secrets.js id whose detection grants it (null = granted by its own detector, `season` gear).
// `riddle` = the ONE line the index shows while it is unfound. Cryptic on purpose: it says what to do, never how.
export const UNLISTED_GEARS = Object.freeze([
  { id: 'mk-ul-og', secret: 'newgrounds', name: 'O.G.', art: 'og', riddle: 'SAY THE NAME OF THE PLACE THAT RAISED US' },
  { id: 'mk-ul-wishbone', secret: 'wish', name: 'WISHBONE', art: 'wishbone', riddle: 'PLAY WHEN THE CLOCK SEES DOUBLE, TWICE' },
  { id: 'mk-ul-typewriter', secret: 'typewriter', name: 'TYPEWRITER', art: 'typewriter', riddle: 'NEVER LIFT YOUR FINGERS' },
  { id: 'mk-ul-mirror', secret: 'palindrome', name: 'MIRROR', art: 'mirror', riddle: 'IT READS THE SAME BOTH WAYS' },
  { id: 'mk-ul-midas', secret: 'midas', name: 'MIDAS', art: 'midas', riddle: 'SOMETIMES A WORD TURNS TO GOLD' },
  { id: 'mk-ul-tripledouble', secret: 'tripledouble', name: 'TRIPLE DOUBLE', art: 'tripledouble', season: 2, riddle: 'ONE WORD, THREE PAIRS · THIS SEASON ONLY' },
].map((g) => Object.freeze({ season: null, ...g, tier: UNLISTED_TIER })));

const BY_ID = new Map(UNLISTED_GEARS.map((g) => [g.id, g]));
const BY_SECRET = new Map(UNLISTED_GEARS.map((g) => [g.secret, g]));

export function unlistedById(id) {
  return BY_ID.get(id) || null;
}
export function isUnlistedId(id) {
  return BY_ID.has(id);
}
/** The gear a secrets.js find grants, or null. */
export function gearForSecret(secretId) {
  return BY_SECRET.get(secretId) || null;
}
/** The painted art for a gear (public/gear/unlisted/<art>.webp). */
export function unlistedArt(g) {
  const gear = typeof g === 'string' ? unlistedById(g) : g;
  return gear ? `/gear/unlisted/${gear.art}.webp` : null;
}
/** Is this gear findable right now? A season gear only in its own season — it never returns. */
export function isFindable(g, season = CURRENT_SEASON) {
  return !!g && (g.season == null || g.season === season);
}

// ------------------------------------------------------------------------------------------- serial
const SERIAL_MAX = 99999;
/** A valid server serial (1…99,999) or null. */
export function cleanSerial(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= SERIAL_MAX ? n : null;
}
/** "#0042" — four digits, more when the count passes 9,999. Pending (no server answer yet) is "#····". */
export function formatSerial(v) {
  const n = cleanSerial(v);
  return n == null ? '#····' : `#${String(n).padStart(4, '0')}`;
}

// -------------------------------------------------------------------------------------------- store
function defaultStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
const WORD_RE = /^[A-Z0-9:]{1,24}$/;
/** Repair any stored shape: unknown ids dropped, serials validated, the word kept only if it is a plain word. */
export function normalizeUnlisted(raw) {
  const out = { owned: {} };
  const owned = raw && typeof raw === 'object' && raw.owned && typeof raw.owned === 'object' ? raw.owned : {};
  for (const [id, v] of Object.entries(owned)) {
    if (!BY_ID.has(id)) continue;
    const o = v && typeof v === 'object' ? v : {};
    const at = Number.isFinite(Number(o.at)) && Number(o.at) > 0 ? Math.floor(Number(o.at)) : 0;
    const word = typeof o.word === 'string' && WORD_RE.test(o.word) ? o.word : null;
    out.owned[id] = { at, serial: cleanSerial(o.serial), word };
  }
  return out;
}
export function loadUnlisted(storage = defaultStorage()) {
  try {
    const raw = storage && storage.getItem ? storage.getItem(UNLISTED_KEY) : null;
    return normalizeUnlisted(raw ? JSON.parse(raw) : null);
  } catch {
    return { owned: {} };
  }
}
function saveUnlisted(state, storage) {
  try {
    if (storage && storage.setItem) storage.setItem(UNLISTED_KEY, JSON.stringify(state));
  } catch {
    /* storage blocked — the find shows this session; the secret re-arms next time */
  }
}
export function ownsUnlisted(id, storage = defaultStorage()) {
  return !!loadUnlisted(storage).owned[id];
}
export function ownedUnlistedIds(storage = defaultStorage()) {
  return UNLISTED_GEARS.filter((g) => loadUnlisted(storage).owned[g.id]).map((g) => g.id);
}

/** The worn-gear key (marks.js MARKS_EQUIPPED_KEY — repeated here so this module stays a leaf). */
const WORN_KEY = 'taw.mark';
/** Wear an OWNED unlisted gear as the MAIN (taw.mark). false when it is not owned or storage is blocked. */
export function wearUnlisted(id, storage = defaultStorage()) {
  if (!unlistedById(id) || !loadUnlisted(storage).owned[id]) return false;
  try {
    storage.setItem(WORN_KEY, id);
    return true;
  } catch {
    return false;
  }
}

/**
 * THE GRANT. Called when a discovery fires. Returns { gear, word, serial: null, fresh: true } the FIRST time, null
 * when the gear is unknown, already owned, or out of season (a season gear never returns). Pure apart from `storage`.
 *   word  the word that found it (shown under the stamp + on the card), uppercased; null when the find had no word
 */
export function grantUnlisted(id, { word = null, now = Date.now(), season = CURRENT_SEASON, storage = defaultStorage() } = {}) {
  const gear = unlistedById(id);
  if (!gear || !isFindable(gear, season)) return null;
  const state = loadUnlisted(storage);
  if (state.owned[id]) return null;
  const w = typeof word === 'string' ? word.trim().toUpperCase().slice(0, 24) : '';
  const entry = { at: Math.floor(now), serial: null, word: WORD_RE.test(w) ? w : null };
  state.owned[id] = entry;
  saveUnlisted(state, storage);
  return { gear, word: entry.word, serial: null, fresh: true };
}

/** The server answered: store this gear's serial. Ignores an unowned gear or an invalid number. Returns it or null. */
export function setUnlistedSerial(id, serial, storage = defaultStorage()) {
  const n = cleanSerial(serial);
  const state = loadUnlisted(storage);
  if (n == null || !state.owned[id]) return null;
  state.owned[id].serial = n;
  saveUnlisted(state, storage);
  return n;
}
/** The owned gears still waiting on a serial (the claim retries these). */
export function pendingSerialIds(storage = defaultStorage()) {
  const { owned } = loadUnlisted(storage);
  return Object.keys(owned).filter((id) => owned[id].serial == null);
}

/**
 * ONCE, at boot: a player who found a word-secret BEFORE this tier existed gets its gear (no stamp, no word — it was
 * found before the gear was). `foundSecretIds` = secrets.js's found set. Idempotent. Returns the newly granted ids.
 */
export function grantForPastSecrets(foundSecretIds, { now = Date.now(), storage = defaultStorage() } = {}) {
  const out = [];
  for (const sid of foundSecretIds || []) {
    const g = gearForSecret(sid);
    if (!g || g.season != null) continue; // a season gear is never back-filled
    if (grantUnlisted(g.id, { now, storage })) out.push(g.id);
  }
  return out;
}

/** The word-secrets' own found set (secrets/secrets.js stores it under this key — repeated so this stays a leaf). */
export const SECRETS_FOUND_KEY = 'wa_menu_secrets';
/**
 * BACK-FILL (run by unlistedIndex — the INDEX / PROFILE open — so it costs the menu's first load nothing): back-fill the gear for every word-secret this save found before the tier
 * existed. Idempotent and guarded. Returns the ids granted this boot (their serials are claimed on the next index open).
 */
export function bootUnlisted({ storage = defaultStorage(), now = Date.now() } = {}) {
  let found = [];
  try {
    const raw = storage && storage.getItem ? storage.getItem(SECRETS_FOUND_KEY) : null;
    const blob = raw ? JSON.parse(raw) : null;
    found = blob && Array.isArray(blob.found) ? blob.found : [];
  } catch {
    found = [];
  }
  return found.length ? grantForPastSecrets(found, { now, storage }) : [];
}

// -------------------------------------------------------------------------------------------- index
/**
 * What the INDEX may show. THE MASK: an unfound tile carries its riddle and nothing else — no name, no art, no odds
 * (there is no odds field at all, so none can leak). The count reads "?/?" until you own one (Pokémon: the set total
 * is the secret), then "1/6". A season gear you did not find in its season is GONE — not a tile, not in the total.
 * → { label, owned, total|null, tiles: [{ id, owned, name, riddle, art|null, serial|null, serialText|null, word|null, season }] }
 */
export function unlistedIndex({ season = CURRENT_SEASON, storage = defaultStorage() } = {}) {
  try { bootUnlisted({ storage }); } catch { /* the back-fill is best-effort */ }
  const { owned } = loadUnlisted(storage);
  const shown = UNLISTED_GEARS.filter((g) => owned[g.id] || isFindable(g, season));
  const have = shown.filter((g) => owned[g.id]).length;
  return {
    owned: have,
    total: have > 0 ? shown.length : null,
    label: have > 0 ? `${have}/${shown.length}` : '?/?',
    tiles: shown.map((g) => {
      const e = owned[g.id];
      if (!e) return { id: g.id, owned: false, name: '???', riddle: g.riddle, art: null, serial: null, serialText: null, word: null, season: g.season };
      return { id: g.id, owned: true, name: g.name, riddle: g.riddle, art: unlistedArt(g), serial: e.serial, serialText: formatSerial(e.serial), word: e.word, at: e.at, season: g.season };
    }),
  };
}
