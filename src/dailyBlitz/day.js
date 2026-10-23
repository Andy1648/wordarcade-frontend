// dailyBlitz/day.js — the two facts the MENU needs (the day number and the prompt count), split out of engine.js
// so the menu's DAILY BLITZ tile never pulls the game into the first paint (payload ratchet). Pure.
export const PROMPTS = 6; // engine.test.js asserts this equals pool tiers x PER_TIER
const EPOCH = Date.UTC(2026, 0, 1);
const DAY_MS = 86400000;

/** 'YYYY-MM-DD' -> day number (#1 = 2026-01-01). NaN for a malformed key. */
export function dayNumberFor(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  if (!m) return NaN;
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - EPOCH) / DAY_MS) + 1;
}

/** day number -> 'YYYY-MM-DD'. */
export function dateKeyFor(dayNumber) {
  return new Date(EPOCH + (dayNumber - 1) * DAY_MS).toISOString().slice(0, 10);
}
