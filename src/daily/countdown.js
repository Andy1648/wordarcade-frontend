// countdown.js — the "time until the NEXT daily" clock, PURE (no React, no DOM, no
// timers). The daily rolls over at each player's LOCAL midnight (see dailySeed.js
// localDateKey), so the countdown is simply the ms from now to the next local midnight.
// The React component (DailyCountdown.jsx) owns the setInterval; this file only does math,
// so it's unit-testable under `node --test` with a fixed Date and no clock.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Milliseconds from `now` to the next LOCAL midnight (00:00 tomorrow, local time).
 * Always in the range (0, 86400000]: at exactly midnight the NEXT midnight is a full
 * day away, never 0, so the countdown never reads a dead "00:00:00" for a whole tick.
 * Built from local Y/M/D so it lands on the same instant localDateKey flips.
 */
export function msUntilLocalMidnight(now = new Date()) {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1, // tomorrow, 00:00:00.000 local
    0,
    0,
    0,
    0
  );
  const ms = nextMidnight.getTime() - now.getTime();
  // Guard against a pathological clock: clamp into (0, MS_PER_DAY].
  if (!Number.isFinite(ms) || ms <= 0) return MS_PER_DAY;
  return Math.min(ms, MS_PER_DAY);
}

/** Format a millisecond span as "HH:MM:SS" (hours 0-23, never negative). */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Convenience: the formatted "time until the next daily" for `now`. */
export function nextDailyIn(now = new Date()) {
  return formatCountdown(msUntilLocalMidnight(now));
}
