// wins.js — the WINS currency + per-mode round counters. localStorage-backed, every access
// wrapped (a blocked/absent store degrades to 0, never throws). Wins are a SPENDABLE
// balance (taw.wins); taw.winsLifetime is a never-decremented all-time total tracked
// separately; taw.rounds.{wordBomb,blitz,satRush} counts completed rounds per mode.
//
// A round only "counts" (pays wins + bumps its mode counter) when the player got at least
// MIN_WORDS accepted — a sub-3 round is treated as not-really-played.

export const WINS_KEY = 'taw.wins';
export const WINS_LIFETIME_KEY = 'taw.winsLifetime';
export const ROUNDS_KEY = 'taw.rounds';
export const ROUND_MODES = ['wordBomb', 'blitz', 'satRush'];
const MIN_WORDS = 3;

function readInt(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}
function writeInt(key, n) {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    /* storage blocked */
  }
}

export function getWins() {
  return readInt(WINS_KEY);
}
export function saveWins(n) {
  writeInt(WINS_KEY, n);
}
export function getWinsLifetime() {
  return readInt(WINS_LIFETIME_KEY);
}
export function saveWinsLifetime(n) {
  writeInt(WINS_LIFETIME_KEY, n);
}

export function getRounds() {
  const out = {};
  for (const m of ROUND_MODES) out[m] = 0;
  try {
    const raw = localStorage.getItem(ROUNDS_KEY);
    if (raw == null) return out;
    const o = JSON.parse(raw) || {};
    for (const m of ROUND_MODES) {
      const v = Number(o[m]);
      if (Number.isFinite(v) && v >= 0) out[m] = Math.floor(v);
    }
  } catch {
    /* fall through to zeroed out */
  }
  return out;
}
export function saveRounds(rounds) {
  try {
    localStorage.setItem(ROUNDS_KEY, JSON.stringify(rounds));
  } catch {
    /* storage blocked */
  }
}

// Wins granted for a round (PURE). <3 words → 0; else 10 + 2·words.
//   2 → 0   3 → 16   10 → 30
export function awardWins({ wordsAccepted } = {}) {
  const w = Number.isFinite(wordsAccepted) ? wordsAccepted : 0;
  return w < MIN_WORDS ? 0 : 10 + 2 * w;
}

// A finite "+N WINS" menu stamp is queued here when a round pays out, and consumed by the
// homepage on the next menu visit (so returning to the menu shows one stamp for the total).
let pendingStamp = 0;
export function consumePendingWinsStamp() {
  const s = pendingStamp;
  pendingStamp = 0;
  return s;
}

// Apply a completed round: grant wins (balance + lifetime) and bump the mode's round
// counter — but ONLY when wordsAccepted >= MIN_WORDS. Returns the wins granted.
export function recordRound({ mode, wordsAccepted } = {}) {
  const granted = awardWins({ wordsAccepted });
  const counts = (Number.isFinite(wordsAccepted) ? wordsAccepted : 0) >= MIN_WORDS;
  if (counts) {
    saveWins(getWins() + granted);
    saveWinsLifetime(getWinsLifetime() + granted);
    if (mode && ROUND_MODES.includes(mode)) {
      const r = getRounds();
      r[mode] += 1;
      saveRounds(r);
    }
    pendingStamp += granted;
  }
  return granted;
}
