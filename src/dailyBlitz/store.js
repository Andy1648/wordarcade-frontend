// dailyBlitz/store.js — what DAILY BLITZ keeps in this browser: TODAY's run (so a reload resumes it and a
// finished day shows its results instead of a replay) and the STREAK. Storage is injected (defaults to
// localStorage) and every read/write is try/caught — a blocked store just means nothing persists.
//
// ONE RUN A DAY: each prompt is saved the moment it starts. A reload mid-prompt resumes at the NEXT prompt
// and the interrupted one counts as a miss, so refreshing can't buy a second look at a prompt.
//
// The streak math is the shared, tested one (daily/streak.js recordDailyResult / displayStreak — integer
// day numbers, a replayed day never double-counts), under DAILY BLITZ's own key.
import { recordDailyResult, displayStreak, emptyDailyState } from '../daily/streak.js';
import { PROMPTS } from './day.js';

const RUN_KEY = 'taw.dailyBlitz.run';
const STREAK_KEY = 'taw.dailyBlitz.streak';

function store(s) {
  if (s) return s;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
function read(s, key) {
  try {
    const raw = store(s) && store(s).getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function write(s, key, value) {
  try {
    if (store(s)) store(s).setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — this tab still works */
  }
}

/** A fresh run for `day`. rows[i] = { key, display, prior, typed } once answered, { key: null } once missed. */
export function newRun(day) {
  return { v: 1, day, started: 0, rows: [], done: false, sent: false, tallies: null };
}

/** Today's run (or a fresh one when the stored run is another day's / corrupt). */
export function loadRun(day, s) {
  const r = read(s, RUN_KEY);
  if (!r || r.v !== 1 || r.day !== day || !Array.isArray(r.rows)) return newRun(day);
  return r;
}

export function saveRun(run, s) {
  write(s, RUN_KEY, run);
}

/**
 * The prompt to play next on load: a prompt that was STARTED but never answered (a reload mid-prompt)
 * is recorded as a miss first. Pure — returns { run, at }, at === PROMPTS when the day is over.
 */
export function resumeAt(run) {
  const rows = run.rows.slice(0, PROMPTS);
  if (run.started > rows.length) {
    while (rows.length < Math.min(run.started, PROMPTS)) rows.push({ key: null, display: null, prior: null, typed: '' });
  }
  const next = { ...run, rows }; // done stays finish()'s call: a day whose last prompts were all interrupted closes out on load
  return { run: next, at: rows.length };
}

export function loadStreak(s) {
  const st = read(s, STREAK_KEY);
  return st && Number.isInteger(st.streak) ? st : emptyDailyState();
}

/** Fold a finished day in (same-day replays never double-count) and persist. Returns the new state. */
export function finishDay(day, total, s) {
  const next = recordDailyResult(loadStreak(s), day, total);
  write(s, STREAK_KEY, next);
  return next;
}

/** The streak to show today (0 once a day was skipped). */
export function currentStreak(today, s) {
  return displayStreak(loadStreak(s), today);
}
