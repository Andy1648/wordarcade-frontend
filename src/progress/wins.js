// wins.js — the WINS currency + per-mode round counters. localStorage-backed, every access
// wrapped (a blocked/absent store degrades to 0, never throws). Wins are a SPENDABLE
// balance (taw.wins); taw.winsLifetime is a never-decremented all-time total tracked
// separately; taw.rounds.{wordBomb,blitz,satRush} counts completed rounds per mode.
//
// A round only "counts" (pays wins + bumps its mode counter) when the player got at least
// MIN_WORDS accepted — a sub-3 round is treated as not-really-played.

import { rebirthMult, getRebirths, round10 } from './xp.js';

export const WINS_KEY = 'taw.wins';
export const WINS_LIFETIME_KEY = 'taw.winsLifetime';
// One-time flag: has the "WINS BUY UPGRADES IN THE SHOP" first-earn explainer been shown yet?
export const WINS_HINT_KEY = 'taw.seenWinsHint';
export const ROUNDS_KEY = 'taw.rounds';
export const ROUND_MODES = ['wordBomb', 'blitz', 'satRush'];
// The payout gate: a round pays nothing until this many words are accepted. Exported
// so the in-game HUD pill can show the gate ("3 WORDS TO EARN") before it's crossed.
export const MIN_WORDS = 3;

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

// The one-time first-earn WINS explainer: read/set its "already shown" flag. Guarded like every
// other access — a blocked store simply never remembers, so the worst case is the tip re-showing.
export function hasSeenWinsHint() {
  try {
    return localStorage.getItem(WINS_HINT_KEY) === '1';
  } catch {
    return false;
  }
}
export function markWinsHintSeen() {
  try {
    localStorage.setItem(WINS_HINT_KEY, '1');
  } catch {
    /* storage blocked */
  }
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

// Per-mode wins multiplier on the base payout (Economy v6, exponential): SAT Rush ×5, CHAIN
// ×10, FUSE ×15 (the solo modes). Word Bomb / Blitz are ×1. (Key matches recordRound's mode:
// 'satRush'.)
export const WINS_MULT = { satRush: 5, chain: 10, fuse: 15 };

// Difficulty multiplier for the modes that HAVE a difficulty (Word Bomb / Category Blitz).
// The engine's difficulty KEYS in ascending order are chill < easy < medium < hard (the
// player-facing labels are CHILL / HARD / CRAZY / HELL). We map that ladder onto the spec's
// 1.0 → 2.0 ramp, so the easiest tier pays base and the hardest (HELL) doubles. Modes with
// no difficulty (or an unknown/absent key) fall through to ×1.
export const DIFFICULTY_MULT = { chill: 1.0, easy: 1.25, medium: 1.5, hard: 2.0 };

// A representative round used ONLY to preview a mode's payout on its menu card. Ten accepted
// words at the ×1 base reads "~200 WINS / ROUND" (SAT ~1000, CHAIN ~2000, FUSE ~3000).
export const TYPICAL_ROUND_WORDS = 10;

// Economy v6: wins are paid PER WORD and go EXPONENTIAL. The per-word rate is
//   20 base × mode mult × difficulty × REBIRTH mult, snapped to a round multiple of 10.
// At R0 that reads word-bomb/blitz 20, SAT 100 (×5), CHAIN 200 (×10), FUSE 300 (×15). Rebirth
// multiplies wins on the SAME ladder as XP (×1.5, ×2, ×2.5 …), read live from taw.rebirths
// unless a `rebirthCount` is passed (keeps the function pure/testable).
export const WORD_WINS_BASE = 20;
export function perWordWins({ mode, difficulty, rebirthCount } = {}) {
  const diffMult = DIFFICULTY_MULT[difficulty] ?? 1;
  const modeMult = WINS_MULT[mode] || 1;
  const rc = Number.isFinite(rebirthCount) ? rebirthCount : getRebirths();
  return round10(WORD_WINS_BASE * modeMult * diffMult * rebirthMult(rc));
}

// Wins granted for a round (PURE given rebirthCount). <3 accepted words → 0; else
// (combo-weighted or plain) word count × the per-word rate, snapped to a round 10.
// Difficulty defaults to ×1 (unspecified / no-difficulty modes).
//
// COMBO (Job 2): an optional `weightedWords` — the run's combo-weighted word count
// (Σ of each accepted word's live multiplier, see progress/combo.js) — REPLACES the raw
// count in the multiplication when it's a positive number. The <3-word GATE always uses
// the raw integer count, so a combo can't sneak a sub-3 run past the gate. Omitting
// weightedWords (every existing caller) leaves the payout exactly as before: since
// perWordWins is already a multiple of 10, round10(count × rate) == count × rate.
export function awardWins({ wordsAccepted, mode, difficulty, rebirthCount, weightedWords } = {}) {
  const w = Number.isFinite(wordsAccepted) ? Math.floor(wordsAccepted) : 0;
  if (w < MIN_WORDS) return 0;
  const weight = Number.isFinite(weightedWords) && weightedWords > 0 ? weightedWords : w;
  return round10(weight * perWordWins({ mode, difficulty, rebirthCount }));
}

// The card's per-ROUND payout preview: a typical round's wins for this mode/difficulty
// (defaults to the easiest tier / ×1). Pure wrapper over awardWins.
export function roundWinsEstimate({ mode, difficulty } = {}) {
  return awardWins({ wordsAccepted: TYPICAL_ROUND_WORDS, mode, difficulty });
}

// PER-WORD wins preview shown on the menu cards. Base 20 per word, keyed by game.id (NOT the
// round-mode key used by perWordWins/recordRound — GameCard passes game.id), ×5 SAT Rush ·
// ×10 CHAIN · ×15 FUSE, then × difficulty, snapped to a round multiple of 10 (word-bomb/blitz
// 20, sat-rush 100, chain 200, fuse 300 at the ×1 difficulty default). This is the R0 BASE
// per-word rate; the card/dialog copy shows it and ANNOTATES the active rebirth boost
// separately via currentRebirthMult() below (e.g. "200 WINS / WORD (×2)"), so the stable base
// stays readable while the rebirth gain is visible.
export const WORD_WINS_MULT = { 'sat-rush': 5, chain: 10, fuse: 15 };
export function wordWinsEstimate({ mode, difficulty } = {}) {
  const diffMult = DIFFICULTY_MULT[difficulty] ?? 1;
  const modeMult = WORD_WINS_MULT[mode] || 1;
  return round10(WORD_WINS_BASE * modeMult * diffMult);
}

// The player's live rebirth WINS multiplier (same ladder as XP), 1 at R0. Exposed so the menu
// card + mode-dialog copy can annotate the per-word rate with the active rebirth boost. Reads
// taw.rebirths unless a count is passed (keeps it pure/testable).
export function currentRebirthMult(rebirthCount) {
  const rc = Number.isFinite(rebirthCount) ? rebirthCount : getRebirths();
  return rebirthMult(rc);
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
export function recordRound({ mode, wordsAccepted, difficulty, weightedWords } = {}) {
  const granted = awardWins({ wordsAccepted, mode, difficulty, weightedWords });
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
