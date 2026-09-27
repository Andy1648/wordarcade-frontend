// racePace.js — my recent WORD RACE pace (ms per accepted word), so launch-time bots can be
// matched to me (the server clamps whatever we send). Rolling window of the last few races;
// the reported pace is their median. localStorage, wrapped: blocked storage just means "unknown".

export const RACE_PACE_KEY = 'taw.racePace';
const KEEP = 5;

function load() {
  try {
    const raw = JSON.parse(globalThis.localStorage?.getItem(RACE_PACE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((n) => Number.isFinite(n) && n > 0) : [];
  } catch {
    return [];
  }
}

/** Median of my recent paces, or null when I have no race history yet. */
export function recentPace() {
  const xs = load().slice().sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = xs.length >> 1;
  return xs.length % 2 ? xs[m] : Math.round((xs[m - 1] + xs[m]) / 2);
}

/** Record one finished race: `words` accepted over `elapsedMs` of racing. Needs >= 3 words. */
export function recordPace(words, elapsedMs) {
  if (!Number.isFinite(words) || words < 3 || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return null;
  const pace = Math.round(elapsedMs / words);
  const next = [...load(), pace].slice(-KEEP);
  try {
    globalThis.localStorage?.setItem(RACE_PACE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
  return pace;
}
