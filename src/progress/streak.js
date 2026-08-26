// streak.js — the DAILY STREAK: consecutive local days on which the player got at least one
// word accepted. Stored at taw.streak as { count, lastDay, freezes }; every access wrapped so a
// blocked/absent store degrades to a fresh zero streak and never throws.
//
// The streak is an ACHIEVEMENT, never a contract — the ONLY consequence of missing days is the
// counter resetting. There is no guilt copy, no "don't lose it" pressure anywhere that reads
// this. The reward is a gentle XP multiplier that folds into the existing xpPerInput stack.
//
// FREEZE TOKENS: the player earns one freeze per 7 days held (at count 7, 14, 21 …). A SINGLE
// missed day (a one-day gap) spends a token instead of resetting the streak. A larger gap, or a
// one-day gap with no token, resets the count to 1 (today). Freezes are kept across a reset —
// they're earned, not forfeited.
//
// PURITY: the day-math core (`advanceStreak`) and the reward curve (`streakMultiplier`) are pure
// functions — they take their inputs and return a value, so they're directly unit-testable. The
// storage wrappers (`recordStreakActivity`, `getStreak`, `getStreakMult`) sit on top and read the
// local clock only there.

export const STREAK_KEY = 'taw.streak';

// The reward ladder: consecutive-day count → XP multiplier, capped at ×1.25. Pure.
//   < 3 days → ×1 (no bonus yet) · 3 → ×1.05 · 7 → ×1.10 · 14 → ×1.20 · 30+ → ×1.25 (cap)
export function streakMultiplier(count) {
  const c = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (c >= 30) return 1.25;
  if (c >= 14) return 1.2;
  if (c >= 7) return 1.1;
  if (c >= 3) return 1.05;
  return 1;
}

// One freeze token is granted each time the streak reaches a fresh multiple of 7 (7, 14, 21 …).
// Since every advance moves the count by at most +1, "count is a multiple of 7" means we just
// crossed that boundary this advance. Pure helper over a candidate next-state.
function grantFreezeIfMilestone(next) {
  if (next.count > 0 && next.count % 7 === 0) {
    return { ...next, freezes: next.freezes + 1 };
  }
  return next;
}

// Coerce anything into a valid { count, lastDay, freezes } with zeros where absent/garbage.
export function normalizeStreak(raw) {
  const base = { count: 0, lastDay: 0, freezes: 0 };
  if (!raw || typeof raw !== 'object') return base;
  if (Number.isFinite(raw.count) && raw.count >= 0) base.count = Math.floor(raw.count);
  if (Number.isFinite(raw.lastDay) && raw.lastDay >= 0) base.lastDay = Math.floor(raw.lastDay);
  if (Number.isFinite(raw.freezes) && raw.freezes >= 0) base.freezes = Math.floor(raw.freezes);
  return base;
}

// PURE core: given the prior streak state and today's day index, return the next state. Never
// mutates `prev`. The only "punishment" is a reset of `count` to 1 — freezes always carry over.
//   • first ever activity, or a stale/zeroed streak → count 1 (today)
//   • same day (or a backwards clock) → unchanged (already counted today)
//   • the very next day (gap 1) → count + 1
//   • exactly one missed day (gap 2) WITH a token → count + 1, spend one token
//   • one missed day with NO token, or any larger gap → reset to count 1 (today)
export function advanceStreak(prev, todayDay) {
  const p = normalizeStreak(prev);
  if (!Number.isFinite(todayDay)) return p;
  const day = Math.floor(todayDay);

  // No usable prior day → today starts (or restarts) the streak at 1.
  if (p.lastDay === 0 || p.count === 0) {
    return grantFreezeIfMilestone({ count: 1, lastDay: day, freezes: p.freezes });
  }
  // Same day already counted (or the clock moved backwards) → no change.
  if (day <= p.lastDay) return p;

  const gap = day - p.lastDay;
  if (gap === 1) {
    return grantFreezeIfMilestone({ count: p.count + 1, lastDay: day, freezes: p.freezes });
  }
  if (gap === 2 && p.freezes > 0) {
    // One missed day, absorbed by a freeze token — the streak survives.
    return grantFreezeIfMilestone({ count: p.count + 1, lastDay: day, freezes: p.freezes - 1 });
  }
  // A miss we can't cover → reset to today. Keep earned freezes (never forfeited).
  return { count: 1, lastDay: day, freezes: p.freezes };
}

// Local day index (days since the local-time epoch). Injected `now` (ms) keeps it deterministic
// in tests; the timezone offset makes the day boundary the viewer's local midnight, not UTC's.
export function localDayIndex(now) {
  const t = Number.isFinite(now) ? now : Date.now();
  const offsetMs = new Date(t).getTimezoneOffset() * 60000;
  return Math.floor((t - offsetMs) / 86400000);
}

// ---- Storage wrappers (the only place that touches localStorage / the clock) ----

export function getStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw == null) return { count: 0, lastDay: 0, freezes: 0 };
    return normalizeStreak(JSON.parse(raw));
  } catch {
    return { count: 0, lastDay: 0, freezes: 0 };
  }
}

function saveStreak(s) {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked — the streak lives only in memory this session */
  }
}

// The live XP multiplier for the current streak (1 when < 3 days). Read by xpPerInput.
export function getStreakMult() {
  return streakMultiplier(getStreak().count);
}

// Record that the player got a word accepted TODAY. Idempotent within a day (a second call the
// same day is a no-op write of the same state). Returns the new streak state.
export function recordStreakActivity(now) {
  const next = advanceStreak(getStreak(), localDayIndex(now));
  saveStreak(next);
  return next;
}

// The SINGLE guarded streak "touch" every accepted-word path calls: the shared word counter
// (wordCount.addWords) AND the solo CHAIN/FUSE accept path (useSoloGame, which never routes
// through addWords). Wraps recordStreakActivity so a streak failure can never disrupt the caller.
// Returns the new streak, or null if it threw. Keeping this the one entry point means no mode can
// have its own copy of the day logic drift out of sync.
export function touchStreak(now) {
  try {
    return recordStreakActivity(now);
  } catch {
    return null;
  }
}
