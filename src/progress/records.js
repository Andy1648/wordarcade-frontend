// records.js — the PERMANENT RECORD: personal bests + lifetime firsts that no other screen
// surfaces. Feeds the Stats "PERSONAL RECORDS" grid. Same defensive idiom as wpm.js / wordCount.js:
// every storage access is wrapped, so a blocked/absent/garbage store degrades to fresh zeros and
// never throws — a records failure can never disturb the accept path that calls it.
//
// TWO keys, both under the taw.* namespace so RESET ALL PROGRESS (which wipes every taw.* key)
// clears them:
//   taw.records       — the small fixed-shape blob below, rewritten only when a record changes.
//   taw.records.seen  — the DISTINCT-word set: a JSON array of every unique accepted word
//                       (trimmed + lowercased). Hydrated into an in-memory Set ONCE per session;
//                       only a genuinely-new word triggers a write. This is the one unbounded
//                       field — it grows by ~(word length + 3) bytes per distinct word.
//
// The record fields split into what NEEDED new tracking (here) and what is READ from existing
// storage by the grid (best/avg WPM → wpm.js, current streak → streak.js, rebirths → xp.js).
import { rarityOf } from './rarityIndex.js';

export const RECORDS_KEY = 'taw.records';
export const SEEN_KEY = 'taw.records.seen';
const VERSION = 1;

// A fresh, valid record blob. `distinct` is DERIVED from the seen set at read time (never stored
// here) so the two can't drift; `rarest` is null until a word is accepted.
function freshRecords() {
  return {
    v: VERSION,
    longestCombo: 0, // best in-game answer combo (GameScreen useCombo peak)
    longestStreak: 0, // best daily-streak count ever held
    rarest: null, // { word, band, mult } — the highest-multiplier word ever accepted
    obscure: 0, // OBSCURE-band accepts ("lucky words hit"), every occurrence counted
    maxLevel: 1, // highest LEVEL ever reached (survives rebirth, which zeroes the live level)
    firstPlayed: 0, // epoch ms of the first session (0 = unknown)
    sessions: 0, // total sessions started
  };
}

// Coerce anything (missing / non-JSON / partial / negative / garbage) into a valid blob.
function normalize(raw) {
  const base = freshRecords();
  if (!raw || typeof raw !== 'object') return base;
  if (Number.isFinite(raw.longestCombo) && raw.longestCombo >= 0) base.longestCombo = Math.floor(raw.longestCombo);
  if (Number.isFinite(raw.longestStreak) && raw.longestStreak >= 0) base.longestStreak = Math.floor(raw.longestStreak);
  if (Number.isFinite(raw.obscure) && raw.obscure >= 0) base.obscure = Math.floor(raw.obscure);
  if (Number.isFinite(raw.maxLevel) && raw.maxLevel >= 1) base.maxLevel = Math.floor(raw.maxLevel);
  if (Number.isFinite(raw.firstPlayed) && raw.firstPlayed >= 0) base.firstPlayed = Math.floor(raw.firstPlayed);
  if (Number.isFinite(raw.sessions) && raw.sessions >= 0) base.sessions = Math.floor(raw.sessions);
  const r = raw.rarest;
  if (r && typeof r === 'object' && typeof r.word === 'string' && Number.isFinite(Number(r.mult))) {
    base.rarest = { word: r.word, band: typeof r.band === 'string' ? r.band : 'COMMON', mult: Number(r.mult) };
  }
  return base;
}

// Guarded read of the raw blob (no derived fields). Internal writers use this.
function readRaw() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (raw == null) return freshRecords();
    return normalize(JSON.parse(raw));
  } catch {
    return freshRecords();
  }
}

function write(rec) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(rec));
  } catch {
    /* storage blocked — the record lives only in memory this session */
  }
}

// ---- The distinct-word set (taw.records.seen) -----------------------------------------
// Hydrated once per session into an in-memory Set so the per-word accept path only pays a
// Set.has (never a re-parse of the whole array). Only a NEW word writes.
let seenSet = null;
function hydrateSeen() {
  if (seenSet) return seenSet;
  seenSet = new Set();
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) for (const w of arr) if (typeof w === 'string' && w) seenSet.add(w);
    }
  } catch {
    /* blocked/garbage — an empty set; distinct simply counts from zero this session */
  }
  return seenSet;
}
function persistSeen() {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seenSet]));
  } catch {
    /* storage blocked — distinct lives only in memory this session */
  }
}

// ---- Recorders (called from the accept / session / rebirth paths) ---------------------

// Fold one accepted word into the record: distinct set, OBSCURE ("lucky") count, and rarest-ever.
// `rarity` may be passed (the accept sites already compute it) or is looked up here. Fully
// guarded — never throws, so it is safe on the live WS accept path.
export function noteWord(word, rarity) {
  try {
    const w = typeof word === 'string' ? word.trim().toLowerCase() : '';
    if (!w) return;
    const r = rarity && typeof rarity === 'object' ? rarity : rarityOf(w);
    // distinct — the only field that can grow the seen set (and only on a genuinely-new word).
    const seen = hydrateSeen();
    if (!seen.has(w)) {
      seen.add(w);
      persistSeen();
    }
    const rec = readRaw();
    let changed = false;
    // "Lucky words hit" → every OBSCURE-band accept (repeats counted as separate hits).
    if (r && r.band === 'OBSCURE') {
      rec.obscure += 1;
      changed = true;
    }
    // Rarest ever — the highest total multiplier (band + length); first word wins a tie.
    const mult = r && Number.isFinite(r.mult) ? r.mult : 1;
    if (!rec.rarest || mult > rec.rarest.mult) {
      rec.rarest = { word: w, band: r && r.band ? r.band : 'COMMON', mult };
      changed = true;
    }
    if (changed) write(rec);
  } catch {
    /* a records failure must never break the accept path */
  }
}

// Record an in-game combo length — bumps the all-time longest if it beats it. No-op otherwise.
export function noteCombo(n) {
  try {
    const c = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    const rec = readRaw();
    if (c > rec.longestCombo) {
      rec.longestCombo = c;
      write(rec);
    }
  } catch {
    /* guarded */
  }
}

// Record the current daily-streak count — bumps the all-time longest. Called from touchStreak.
export function noteStreak(count) {
  try {
    const c = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
    const rec = readRaw();
    if (c > rec.longestStreak) {
      rec.longestStreak = c;
      write(rec);
    }
  } catch {
    /* guarded */
  }
}

// Record the current LEVEL — bumps the highest ever reached. Called on Stats mount (folds in the
// current run) and just before a rebirth zeroes the live level (captures that run's peak).
export function noteLevel(level) {
  try {
    const l = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
    const rec = readRaw();
    if (l > rec.maxLevel) {
      rec.maxLevel = l;
      write(rec);
    }
  } catch {
    /* guarded */
  }
}

// Record a new session: increments the session count and stamps firstPlayed once. `now` is
// injectable for tests; defaults to the wall clock.
export function noteSession(now) {
  try {
    const rec = readRaw();
    rec.sessions += 1;
    if (!rec.firstPlayed) rec.firstPlayed = Number.isFinite(now) ? Math.floor(now) : Date.now();
    write(rec);
  } catch {
    /* guarded */
  }
}

// ---- The reader the grid uses ---------------------------------------------------------
// The full record, with `distinct` derived live from the seen set so it can never disagree.
export function readRecords() {
  const rec = readRaw();
  rec.distinct = hydrateSeen().size;
  return rec;
}

// Test hook: drop the in-memory seen set so the next read re-hydrates from storage.
export function __resetSeenForTest() {
  seenSet = null;
}
