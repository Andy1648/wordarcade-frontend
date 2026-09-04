// dailySeed.js — the DAILY SHARED SEED. Wordle's whole engine is "everyone got the
// same puzzle today"; this derives a deterministic seed from the LOCAL calendar date
// so every player worldwide on the same date gets the SAME CHAIN opener, FUSE
// fragment sequence, and Blitz categories — and it rolls over at each player's local
// midnight (like Wordle). Pure: NO React, NO DOM; storage is injected into load/save.
//
// WHY LOCAL DATE, not UTC: two players in different timezones on the same wall-clock
// CALENDAR date should share a puzzle, and each player's puzzle should flip at THEIR
// midnight. `localDateKey` reads the local Y/M/D, so the seed is identical for anyone
// whose local date reads e.g. 2026-09-04, and changes the instant local midnight ticks.
//
// The engines (chain.js / fuse.js) already accept an INJECTED rng, so making a mode
// deterministic for the day is just: pass `dailyRng(dateKey, mode)` as that rng.

const KEY = 'wa_daily_seed';
const VERSION = 1;
export const DAILY_MODES = ['chain', 'fuse', 'blitz'];

/** Local calendar date as "YYYY-MM-DD" (local Y/M/D, so it flips at LOCAL midnight
 *  and is identical for every player whose local date reads the same). */
export function localDateKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// xmur3 string hash → a well-mixed 32-bit seed. Pure function of the string only, so
// the SAME string yields the SAME seed on every machine (no locale/timezone leaks in).
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

// mulberry32 — a tiny deterministic PRNG (same algorithm the engines/luck use).
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The deterministic 32-bit seed for a given date + mode. Mode-salted so CHAIN,
 *  FUSE and Blitz get DIFFERENT (but each deterministic) sequences from one date. */
export function seedFor(dateKey, mode = '') {
  return xmur3(`${dateKey}#${mode}`);
}

/** A seeded RNG for (date, mode) — inject this as the engine's `rng` to make the
 *  day's CHAIN opener / FUSE fragment bag deterministic and identical worldwide. */
export function dailyRng(dateKey, mode = '') {
  return mulberry32(seedFor(dateKey, mode));
}

/** Deterministically pick `n` distinct Blitz categories for the day. Pure of the
 *  date + the provided category list, so every player with the same list + date gets
 *  the same categories, in the same order. (Partial Fisher-Yates with the daily rng.) */
export function dailyBlitzCategories(dateKey, categories = [], n = 3) {
  const pool = categories.slice();
  const rnd = dailyRng(dateKey, 'blitz');
  const out = [];
  const take = Math.min(n, pool.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(rnd() * (pool.length - i));
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    out.push(pool[i]);
  }
  return out;
}

// ---- one-attempt-per-day + personal best, per mode ----
export function emptyState() {
  return { v: VERSION, byMode: { chain: null, fuse: null, blitz: null } };
}

function isValid(blob) {
  return blob && typeof blob === 'object' && blob.v === VERSION && blob.byMode && typeof blob.byMode === 'object';
}

export function load(storage) {
  try {
    const raw = storage && storage.getItem ? storage.getItem(KEY) : null;
    if (!raw) return emptyState();
    const blob = JSON.parse(raw);
    if (!isValid(blob)) return emptyState();
    const s = emptyState();
    for (const m of DAILY_MODES) {
      const r = blob.byMode[m];
      if (r && typeof r === 'object' && typeof r.day === 'string') {
        s.byMode[m] = { day: r.day, score: Number(r.score) || 0, best: Number(r.best) || 0, bestDay: r.bestDay || null };
      }
    }
    return s;
  } catch {
    return emptyState();
  }
}

export function save(storage, state) {
  try {
    if (storage && storage.setItem) storage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — nothing persisted, no harm */
  }
}

/** Has today's daily for this mode already been completed? (One attempt/day/mode.) */
export function hasPlayedToday(state, mode, dateKey = localDateKey()) {
  const r = state && state.byMode ? state.byMode[mode] : null;
  return !!r && r.day === dateKey;
}

/** Record a completed daily. Sets today as played for the mode and updates the
 *  all-time personal best. A SECOND call for the same day is a no-op on `day`
 *  (already played) but still lifts the personal best if the score is higher.
 *  Returns the mutated state. */
export function recordDaily(state, mode, score, dateKey = localDateKey()) {
  if (!DAILY_MODES.includes(mode)) return state;
  const s = Number(score) || 0;
  const prev = state.byMode[mode];
  const best = Math.max(prev ? prev.best : 0, s);
  const bestDay = prev && prev.best >= s ? (prev.bestDay || null) : dateKey;
  state.byMode[mode] = { day: dateKey, score: s, best, bestDay };
  return state;
}

/** The all-time personal best for a mode's daily (0 if never played). */
export function personalBest(state, mode) {
  const r = state && state.byMode ? state.byMode[mode] : null;
  return r ? r.best : 0;
}
