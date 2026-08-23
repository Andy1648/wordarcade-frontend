// lexicon.js — SAT RUSH per-word learning memory.
//
// Pure module: NO React, NO DOM, and it NEVER touches localStorage on its own.
// Storage is INJECTED into load()/save() (a { getItem, setItem } object) so the
// logic is testable and a private-mode / storage-blocked browser degrades to a
// fresh empty state instead of crashing. Every read/write is wrapped — nothing
// here can throw into gameplay.
//
// TIME IS A SESSION COUNTER, not the wall clock (state.session). A player doing
// three runs back to back should not have review words come due mid-session, and
// a counter keeps the Leitner schedule deterministic in tests without injecting a
// clock. The hook bumps state.session once per run start.
//
// WHAT IT REMEMBERS — one record per word:
//   { w, box, seen, cleared, missed, lastSeen, bestStage, antes }
//   box       0..4   Leitner box (see INTERVALS); miss → 0, clear → box+1 (≤4)
//   seen      n      total encounters
//   cleared   n      times captured
//   missed    n      times it escaped
//   lastSeen  n      the session counter at the most recent encounter
//   bestStage n      best ANTE ever earned on a clear (5/3/1; 0 if never cleared)
//   antes     [n]    rolling last few per-encounter ante scores (drives WEAK)
//
// ANTE is the "how fast did you know it" score, mirroring the engine's stage
// multipliers (stage 0 = 5×, 1 = 3×, 2 = 1×). A clear that leaned on the
// spell-along auto-reveals (revealedCount > 1) scores as 1 — the answer was
// nearly given away — regardless of the stage it technically resolved at. A miss
// scores 0. This single number is what separates "knew it cold" from "only got it
// once it was spelled out for me".

const KEY = 'wa_satrush_lexicon';
const VERSION = 1;

// Leitner review intervals by box (in SESSIONS). A word in box b is due when
// currentSession - lastSeen >= INTERVALS[b]. Miss drops to box 0 (due next run);
// each clear promotes it, stretching the gap. Widened from [1,2,5,10,20] so ONE
// clear buys real rest — a word nailed cold shouldn't reappear a run or two later
// (the old box-0/1 gaps of 1-2 sessions made almost everything perpetually "due").
export const INTERVALS = [1, 3, 8, 20, 40];

// Ante by stage index — decoupled from engine.js on purpose (this is a learning
// score, not a scoring rule), but kept numerically in sync with stageMultipliers.
const ANTE = [5, 3, 1];

// A clear counts as "known cold" only if at most this many letters were revealed
// (the free stage-2 first letter). Above it, the clear was given away → ante 1.
const KNOWN_MAX_REVEALED = 1;

const MASTERY_BOX = 3; // box >= this === mastered
const ANTES_WINDOW = 3; // how many recent ante scores we keep per word
const MAX_RECORDS = 2000; // hard cap on stored records (see evict)

/** A clean, empty state. Returned for a fresh player and for any unreadable blob.
 *  `mode` remembers the last mode-select choice ('briefing' | 'lineup') so the
 *  picker can preselect it; a fresh player defaults to 'briefing'. `lastBriefed`
 *  is the LAST 3 briefing DECKS (an array of up-to-3 word-string arrays, newest
 *  last), so the next briefing can exclude the recent window and not re-deal a word
 *  it dealt in any of the last three runs. */
export function freshState() {
  return { v: VERSION, session: 0, mode: 'briefing', lastBriefed: [], records: {} };
}

// Normalise a stored lastBriefed into the current shape: an array of up-to-3 decks
// (each a string[]). Migrates the OLD flat string[] (a single deck) by wrapping it
// as one deck; drops anything malformed. Safe on any input.
function normalizeLastBriefed(v) {
  if (!Array.isArray(v)) return [];
  // Old format: a flat array of word strings === one deck. (An empty array is
  // ambiguous but maps to "no decks" either way.)
  if (v.every((x) => typeof x === 'string')) return v.length ? [v] : [];
  // New format: an array of decks. Keep only valid string[] decks, newest 3.
  const decks = v.filter((d) => Array.isArray(d) && d.every((x) => typeof x === 'string'));
  return decks.slice(-3);
}

// True only for a blob that is safe to trust as-is. Anything else → fresh state,
// so an old/corrupt/partial value can never crash the mode or poison selection.
function isValid(blob) {
  return (
    blob &&
    typeof blob === 'object' &&
    blob.v === VERSION &&
    typeof blob.session === 'number' &&
    blob.records &&
    typeof blob.records === 'object'
  );
}

/**
 * Load state from an injected storage ({ getItem }). Unknown / corrupt / absent
 * → a fresh empty state, never a throw. Missing optional fields are backfilled so
 * callers can assume the full shape.
 */
export function load(storage) {
  try {
    const raw = storage && storage.getItem ? storage.getItem(KEY) : null;
    if (!raw) return freshState();
    const blob = JSON.parse(raw);
    if (!isValid(blob)) return freshState();
    return {
      v: VERSION,
      session: blob.session,
      mode: blob.mode === 'lineup' ? 'lineup' : 'briefing',
      // Migrate lastBriefed to the last-3-decks shape (old flat string[] → one deck).
      lastBriefed: normalizeLastBriefed(blob.lastBriefed),
      records: blob.records,
    };
  } catch {
    return freshState(); // storage unavailable / bad JSON — remember nothing
  }
}

/** Persist state to an injected storage ({ setItem }). Silent on any failure. */
export function save(storage, state) {
  try {
    if (!storage || !storage.setItem) return;
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable / quota — nothing to persist, no harm done */
  }
}

function ensureRecord(state, word) {
  let rec = state.records[word];
  if (!rec) {
    rec = { w: word, box: 0, seen: 0, cleared: 0, missed: 0, lastSeen: 0, bestStage: 0, antes: [] };
    state.records[word] = rec;
  }
  return rec;
}

// The per-encounter ante score (see the ANTE note up top).
function anteScore({ cleared, stage, revealedCount }) {
  if (!cleared) return 0;
  if (revealedCount > KNOWN_MAX_REVEALED) return 1; // spelled out for them
  const s = Math.max(0, Math.min(ANTE.length - 1, stage | 0));
  return ANTE[s];
}

// Keep the store bounded. Evict highest-box-oldest first: mastered words are the
// safest to forget (they're mastered), and among equal boxes the least-recently
// seen goes. Only runs when we're over the cap, so it's off the hot path.
function evict(state) {
  const words = Object.keys(state.records);
  if (words.length <= MAX_RECORDS) return;
  words.sort((a, b) => {
    const ra = state.records[a];
    const rb = state.records[b];
    if (rb.box !== ra.box) return rb.box - ra.box; // highest box first
    return ra.lastSeen - rb.lastSeen; // then oldest first
  });
  const over = words.length - MAX_RECORDS;
  for (let i = 0; i < over; i++) delete state.records[words[i]];
}

/**
 * Record the outcome of one encounter. Mutates state in place (the hook holds a
 * single state ref) and returns it.
 *   cleared        — did the player capture the word this time?
 *   stage          — the stage index it resolved at (0/1/2)
 *   revealedCount  — letters revealed at completion (gates "known cold" vs given-away)
 * lastSeen is stamped with state.session, so the caller must bump the session
 * once per run before recording that run's outcomes.
 */
export function recordResult(state, word, { cleared, stage = 0, revealedCount = 0 } = {}) {
  if (!word) return state;
  const rec = ensureRecord(state, word);
  rec.seen += 1;
  if (cleared) {
    rec.cleared += 1;
    rec.box = Math.min(INTERVALS.length - 1, rec.box + 1);
  } else {
    rec.missed += 1;
    rec.box = 0; // a miss resets the schedule — see it again soon
  }
  const a = anteScore({ cleared, stage, revealedCount });
  rec.bestStage = Math.max(rec.bestStage, a);
  rec.antes.push(a);
  if (rec.antes.length > ANTES_WINDOW) rec.antes = rec.antes.slice(-ANTES_WINDOW);
  rec.lastSeen = state.session;
  evict(state);
  return state;
}

/**
 * Words due for review per Leitner, most-overdue first (tie: lower box first, so
 * the shakiest words lead). Only ever includes words the player has actually seen
 * — a fresh player has none. Pass the session the upcoming run will use.
 */
export function dueWords(state, session) {
  const out = [];
  for (const w of Object.keys(state.records)) {
    const rec = state.records[w];
    const interval = INTERVALS[Math.min(INTERVALS.length - 1, rec.box)];
    const overdue = session - rec.lastSeen - interval;
    if (overdue >= 0) out.push({ w, overdue, box: rec.box });
  }
  out.sort((a, b) => b.overdue - a.overdue || a.box - b.box || (a.w < b.w ? -1 : 1));
  return out.map((e) => e.w);
}

/**
 * "Weak" words: cleared, but only ever at the give-away level on their last two
 * encounters (both ante 1). The player gets them right, but not until the answer
 * is nearly spelled out — a different failure than an outright miss, and worth
 * surfacing separately (misses are already handled by the box reset).
 */
export function weakWords(state) {
  const out = [];
  for (const w of Object.keys(state.records)) {
    const rec = state.records[w];
    if (rec.cleared >= 1 && rec.antes.length >= 2 && rec.antes.slice(-2).every((a) => a === 1)) {
      out.push(w);
    }
  }
  return out;
}

/**
 * Does this word genuinely need re-studying? TRUE only when the player's LAST
 * encounter with it was a miss (ante 0) or a give-away clear (ante 1) — i.e. they
 * do NOT know it cold. A word cleared cold (ante 3 or 5) on its last encounter
 * does NOT need review, even if earlier attempts were shaky: only the most recent
 * result counts. A never-seen word is not "review" (there's nothing to re-study).
 * This is the gate the briefing uses to decide whether a review slot is warranted
 * at all — separate from Leitner timing (dueWords), which says WHEN it's time.
 */
export function needsReview(state, word) {
  const rec = state.records[word];
  if (!rec || rec.antes.length === 0) return false;
  const lastAnte = rec.antes[rec.antes.length - 1];
  return lastAnte <= 1; // antes are only ever 0/1/3/5, so this catches miss + give-away
}

/** How many words the player has mastered (box >= MASTERY_BOX). The results stat. */
export function masteredCount(state) {
  let n = 0;
  for (const w of Object.keys(state.records)) {
    if (state.records[w].box >= MASTERY_BOX) n += 1;
  }
  return n;
}

/** Is this specific word mastered? (Used to keep briefing families un-mastered.) */
export function isMastered(state, word) {
  const rec = state.records[word];
  return !!rec && rec.box >= MASTERY_BOX;
}

/** Has the player ever encountered this word? (Used for the "you know this" ticks.) */
export function hasSeen(state, word) {
  const rec = state.records[word];
  return !!rec && rec.seen > 0;
}
