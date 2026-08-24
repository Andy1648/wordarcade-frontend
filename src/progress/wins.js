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

// Per-mode wins multiplier on the base payout: CHAIN pays 3×, FUSE 5× (harder solo modes).
// Every other mode is ×1.
export const WINS_MULT = { chain: 3, fuse: 5 };

// Difficulty multiplier for the modes that HAVE a difficulty (Word Bomb / Category Blitz).
// The engine's difficulty KEYS in ascending order are chill < easy < medium < hard (the
// player-facing labels are CHILL / HARD / CRAZY / HELL). We map that ladder onto the spec's
// 1.0 → 2.0 ramp, so the easiest tier pays base and the hardest (HELL) doubles. Modes with
// no difficulty (or an unknown/absent key) fall through to ×1.
export const DIFFICULTY_MULT = { chill: 1.0, easy: 1.25, medium: 1.5, hard: 2.0 };

// A representative round used ONLY to preview a mode's payout on its menu card. Ten accepted
// words puts the base at 30, so the card reads "~30 WINS / ROUND" at ×1 (CHAIN ~90, FUSE ~150).
export const TYPICAL_ROUND_WORDS = 10;

// Wins granted for a round (PURE). <3 words → 0; else (10 + 2·words) × difficulty × mode mult,
// rounded. Difficulty defaults to ×1 (unspecified/no-difficulty modes), so the base payouts
// are unchanged:  3 → 16   10 → 30   (chain 3 → 48   fuse 3 → 80).
export function awardWins({ wordsAccepted, mode, difficulty } = {}) {
  const w = Number.isFinite(wordsAccepted) ? wordsAccepted : 0;
  if (w < MIN_WORDS) return 0;
  const diffMult = DIFFICULTY_MULT[difficulty] ?? 1;
  return Math.round((10 + 2 * w) * diffMult * (WINS_MULT[mode] || 1));
}

// The card's payout preview: the wins a typical round would pay for this mode at the given
// difficulty (defaults to the easiest tier / ×1). Pure wrapper over awardWins.
export function roundWinsEstimate({ mode, difficulty } = {}) {
  return awardWins({ wordsAccepted: TYPICAL_ROUND_WORDS, mode, difficulty });
}

// A finite "+N WINS" menu stamp is queued here when a round pays out, and consumed by the
// homepage on the next menu visit (so returning to the menu shows one stamp for the total).
let pendingStamp = 0;
export function consumePendingWinsStamp() {
  const s = pendingStamp;
  pendingStamp = 0;
  return s;
}

// Grant wins directly (no round gating) into BOTH the spendable balance and the never-
// decremented lifetime total. Used by the menu level-up payout. Returns the new balance.
export function grantWins(n) {
  const amt = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  if (amt <= 0) return getWins();
  const next = getWins() + amt;
  saveWins(next);
  saveWinsLifetime(getWinsLifetime() + amt);
  return next;
}

// Apply a completed round: grant wins (balance + lifetime) and bump the mode's round
// counter — but ONLY when wordsAccepted >= MIN_WORDS. Returns the wins granted. `difficulty`
// (Word Bomb / Category Blitz tier key) scales the payout via DIFFICULTY_MULT.
export function recordRound({ mode, wordsAccepted, difficulty } = {}) {
  const granted = awardWins({ wordsAccepted, mode, difficulty });
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
