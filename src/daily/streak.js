// src/daily/streak.js
// Daily Challenge streak bookkeeping. PURE logic + thin localStorage wrappers,
// so the math runs under node --test with no DOM.
//
// All day arithmetic is INTEGER UTC day numbers (the server's own currency:
// game_over's daily.dayNumber). No Date parsing, no local midnight, no DST
// traps — a streak is simply "lastDayNumber was yesterday's number".

// Mirrors the backend (categoryBlitzLogic.DAILY_EPOCH_UTC): day #1 = 2026-01-01 UTC.
export const DAILY_EPOCH_UTC = Date.UTC(2026, 0, 1);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Today's day number by the CLIENT clock — display only (menu button). The
 *  authoritative number always comes from the server's game payloads. */
export function currentDayNumber(nowMs = Date.now()) {
  return Math.floor((nowMs - DAILY_EPOCH_UTC) / MS_PER_DAY) + 1;
}

/** Empty history for a first-ever run (also the corrupt-storage fallback). */
export function emptyDailyState() {
  return {
    lastDayNumber: null, // last day (server dayNumber) a daily was completed
    streak: 0, // consecutive-day run ending at lastDayNumber
    bestStreak: 0,
    lastScore: null, // best score achieved on lastDayNumber
    bestScore: null, // best daily score ever
    playedCount: 0, // total days played (not attempts)
  };
}

function isValidState(s) {
  return (
    s &&
    typeof s === 'object' &&
    (s.lastDayNumber === null || Number.isInteger(s.lastDayNumber)) &&
    Number.isInteger(s.streak) &&
    s.streak >= 0
  );
}

/** True if the given (server) day has already been completed. */
export function hasPlayedDay(state, dayNumber) {
  return !!state && state.lastDayNumber === dayNumber;
}

/**
 * Folds one completed daily (server dayNumber + final score) into the state.
 * Pure — returns the NEXT state, never mutates.
 *
 * Rules:
 *  - first play on a new day right after yesterday's -> streak + 1
 *  - first play after a gap (or ever)               -> streak resets to 1
 *  - replaying the same day                          -> streak/playedCount
 *    unchanged; only the day's score can improve (best-of kept)
 *  - a dayNumber EARLIER than lastDayNumber (clock skew / stale tab) is
 *    ignored entirely — never let weirdness torch a streak.
 */
export function recordDailyResult(state, dayNumber, score) {
  const s = isValidState(state) ? state : emptyDailyState();
  const pts = Math.max(0, Number(score) || 0);

  if (!Number.isInteger(dayNumber)) return s;
  if (s.lastDayNumber !== null && dayNumber < s.lastDayNumber) return s;

  if (s.lastDayNumber === dayNumber) {
    // Same-day replay: best score of the day only.
    return {
      ...s,
      lastScore: Math.max(s.lastScore ?? 0, pts),
      bestScore: Math.max(s.bestScore ?? 0, pts),
    };
  }

  const streak = s.lastDayNumber === dayNumber - 1 ? s.streak + 1 : 1;
  return {
    lastDayNumber: dayNumber,
    streak,
    bestStreak: Math.max(s.bestStreak || 0, streak),
    lastScore: pts,
    bestScore: Math.max(s.bestScore ?? 0, pts),
    playedCount: (s.playedCount || 0) + 1,
  };
}

/**
 * The streak to SHOW for "today" (menu badge): the stored run, but only if it
 * is still alive — i.e. the last play was today or yesterday. A dead run
 * displays as 0 (it will restart at 1 on the next play).
 */
export function displayStreak(state, todayNumber) {
  if (!isValidState(state) || state.lastDayNumber === null) return 0;
  return todayNumber - state.lastDayNumber <= 1 ? state.streak : 0;
}

// ---- localStorage wrappers (browser only; storage failures never throw) ----

const STORAGE_KEY = 'wa_daily';

export function loadDailyState(storage) {
  try {
    const store = storage || window.localStorage;
    const parsed = JSON.parse(store.getItem(STORAGE_KEY));
    return isValidState(parsed) ? parsed : emptyDailyState();
  } catch {
    return emptyDailyState();
  }
}

export function saveDailyState(state, storage) {
  try {
    const store = storage || window.localStorage;
    store.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota — this session's in-memory state still works */
  }
}
