// contracts/calendar.js — the STREAK CALENDAR (preview, Andy oct21: "every day you get a better and better reward, and
// at the end of 7 days, you could get a legendary roll"). A 7-day reward track on the CONTRACTS screen.
//
//   CHECK IN   a day's reward is claimable once you have PLAYED today (one accepted word — the same bar that keeps the
//              streak, streak.js lastDay === today). One claim a day; the track moves one step per claim.
//   THE TRACK  DAY 1 25 · DAY 2 40 · DAY 3 60 gems · DAY 4 a FREE ROLL · DAY 5 100 · DAY 6 125 gems · DAY 7 a
//              guaranteed LEGENDARY+ ROLL. After DAY 7 the next week starts at DAY 1 (the week count goes up).
//   MISSED     ONE missed day HOLDS your place (life happens — the streak's freeze has the same grace); TWO or more
//              missed days in a row send the track back to DAY 1. Nothing already claimed is ever taken back.
//   PAY        gems through gemsCore.grantGems (reason 'calendar'). The two ROLL days have no grant path yet:
//              PREVIEW pays their gem worth (DAY 4 = 75, one roll; DAY 7 = 300) until the server's guaranteed
//              LEGENDARY roll lands (draft migration 060_streak_legendary_roll.sql — not applied, Tier 1).
//
// PURE core (calendarView / claimStep) over an injected state + day index; the storage half sits under it.
import { grantGems } from '../gemsCore.js';
import { getStreak, localDayIndex } from '../streak.js';

export const CALENDAR_KEY = 'taw.calendar';
export const CALENDAR_CHANGE = 'taw:calendar-change';
export const ROLL_GEMS = 75; // v3/econ.js ROLL_PRICE — what a FREE ROLL is worth until it is a real roll
export const DAYS = [
  { day: 1, kind: 'gems', gems: 25 },
  { day: 2, kind: 'gems', gems: 40 },
  { day: 3, kind: 'gems', gems: 60 },
  { day: 4, kind: 'roll', gems: ROLL_GEMS }, // PREVIEW: paid as one roll's gems
  { day: 5, kind: 'gems', gems: 100 },
  { day: 6, kind: 'gems', gems: 125 },
  { day: 7, kind: 'legendary', gems: 300 }, // PREVIEW: paid as gems until migration 060's guaranteed LEGENDARY+ roll
];

export function fresh() {
  return { v: 1, pos: 0, last: 0, week: 1 };
}
function norm(raw) {
  const s = fresh();
  if (!raw || typeof raw !== 'object') return s;
  if (Number.isInteger(raw.pos) && raw.pos >= 0 && raw.pos < DAYS.length) s.pos = raw.pos;
  if (Number.isFinite(raw.last) && raw.last >= 0) s.last = Math.floor(raw.last);
  if (Number.isInteger(raw.week) && raw.week >= 1) s.week = raw.week;
  return s;
}

/** PURE: the track as of `today` — after the missed-day rule — before any claim. */
export function settle(state, today) {
  const s = norm(state);
  if (!s.last || today <= s.last) return s;
  const gap = today - s.last; // 1 = claimed yesterday · 2 = missed one day (held) · 3+ = missed two or more (reset)
  if (gap >= 3) return { ...s, pos: 0, week: 1, reset: true };
  return s;
}

/**
 * PURE: what the screen draws. `played` = an accepted word today.
 * → { pos, week, claimable, claimedToday, needPlay, reset, days: [{ ...DAYS[i], state: 'got'|'today'|'next'|'later' }] }
 */
export function calendarView(state, today, played) {
  const s = settle(state, today);
  const claimedToday = s.last === today;
  const cur = claimedToday ? (s.pos + DAYS.length - 1) % DAYS.length : s.pos; // the tile that is (or was) today's
  const wrapped = claimedToday && s.pos === 0; // DAY 7 claimed today: the whole week shows GOT
  const days = DAYS.map((d, i) => {
    let st = 'later';
    if (wrapped || i < cur || (claimedToday && i === cur)) st = 'got';
    else if (i === cur) st = 'today';
    else if (i === cur + 1) st = 'next';
    return { ...d, state: st };
  });
  return { pos: s.pos, week: s.week, reset: !!s.reset, claimedToday, claimable: !claimedToday && !!played, needPlay: !claimedToday && !played, days };
}

/** PURE: claim today's step. Returns { state, paid: DAYS row } or null when nothing is claimable. */
export function claimStep(state, today, played) {
  const v = calendarView(state, today, played);
  if (!v.claimable) return null;
  const s = settle(state, today);
  const row = DAYS[s.pos];
  const pos = (s.pos + 1) % DAYS.length;
  return { state: { v: 1, pos, last: today, week: pos === 0 ? s.week + 1 : s.week }, paid: row };
}

// ---- storage + the live clock ---------------------------------------------------------------------------------------
function read() {
  try { return JSON.parse(localStorage.getItem(CALENDAR_KEY) || 'null'); } catch { return null; }
}
function write(s) {
  try { localStorage.setItem(CALENDAR_KEY, JSON.stringify(s)); } catch { /* memory only */ }
  try { window.dispatchEvent(new CustomEvent(CALENDAR_CHANGE)); } catch { /* node */ }
}
const playedToday = (today) => getStreak().lastDay === today;

/** The live view (today's local day, the real streak). */
export function liveCalendar(now = Date.now()) {
  const today = localDayIndex(now);
  return calendarView(read(), today, playedToday(today));
}
/** Claim today's reward. Returns the DAYS row paid (with `granted` gems), or null. */
export function claimToday(now = Date.now()) {
  const today = localDayIndex(now);
  const r = claimStep(read(), today, playedToday(today));
  if (!r) return null;
  write(r.state);
  const granted = grantGems(r.paid.gems, 'calendar', { detail: `day-${r.paid.day}` });
  return { ...r.paid, granted };
}
