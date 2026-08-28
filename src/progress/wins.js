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

// Per-mode wins multiplier on the base payout (Economy v6, exponential): SAT Rush ×2, CHAIN
// ×10, FUSE ×15 (the solo modes). Word Bomb / Blitz are ×1. (Key matches recordRound's mode:
// 'satRush'.) SAT Rush dropped ×5→×2 once RARITY scoring landed: rarity rewards vocabulary
// directly (SAT's forced advanced deck sits ~56% OBSCURE), so a ×5 mode mult double-counted the
// same skill and let the UNGATED SAT Rush out-earn the LV20-gated CHAIN and LV25-gated FUSE. At
// ×2 the median-wins ordering matches the unlock ladder again (see claude/rarity-sim.mjs).
export const WINS_MULT = { satRush: 2, chain: 10, fuse: 15 };

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
// round-mode key used by perWordWins/recordRound — GameCard passes game.id), ×2 SAT Rush ·
// ×10 CHAIN · ×15 FUSE, then × difficulty, snapped to a round multiple of 10 (word-bomb/blitz
// 20, sat-rush 40, chain 200, fuse 300 at the ×1 difficulty default). This is the R0 BASE
// per-word rate; the card/dialog copy shows it and ANNOTATES the active rebirth boost
// separately via currentRebirthMult() below (e.g. "200 WINS / WORD (×2)"), so the stable base
// stays readable while the rebirth gain is visible. (SAT ×5→×2: see WINS_MULT above — rarity now
// rewards SAT's vocabulary directly, so the mode mult no longer double-counts it.)
export const WORD_WINS_MULT = { 'sat-rush': 2, chain: 10, fuse: 15 };
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

// Bank wins INCREMENTALLY as accepted words climb, so leaving mid-round never forfeits what
// was already earned (§2). Called once per accepted word with the round's running accept count
// BEFORE (prevWords) and AFTER (nowWords) this word. Pays perWordWins for every word past the
// MIN_WORDS gate: word 3 banks 3×perWord RETROACTIVELY (the round crosses the gate), words 4+
// bank 1×perWord each, words 1-2 bank nothing (still gated). Grants into balance + lifetime +
// the menu stamp, and bumps the mode's round counter ONCE (the first crossing). Returns the
// wins granted THIS call. Pure given rebirthCount (only side effect is localStorage).
//
// This REPLACES the end-of-round recordRound() payout in every mode — the two must never both
// run for the same round or wins double-pay. recordRound is kept (tested, pure) but no longer
// called from gameplay; the per-word ledger is now the single source of the payout.
// RARITY (word-value): the gate is on the COUNT of accepted words (still MIN_WORDS), but the
// PAYOUT is on a rarity WEIGHT — the running SUM of each word's rarity multiplier (see rarity.js:
// COMMON ×1 … OBSCURE ×4, + length bonus, capped ×4.5). Callers pass the cumulative weight BEFORE
// (prevWeight) and AFTER (nowWeight) this word alongside the counts. Because the paid weight is
// zero until the COUNT clears the gate, the first three words' full rarity is released
// RETROACTIVELY the instant word 3 lands (paidNow jumps from 0 to the whole cumulative weight),
// and words 4+ each release exactly their own weight — full per-word fidelity, no caller-side
// buffer. prevWeight/nowWeight DEFAULT to the counts (every word ×1) when omitted, so any caller
// that doesn't pass a weight behaves byte-identically to the pre-rarity payout.
export function bankWordWins({ mode, difficulty, prevWords, nowWords, prevWeight, nowWeight, rebirthCount } = {}) {
  const iCount = (x) => (Number.isFinite(x) ? Math.floor(x) : 0);
  const prevN = iCount(prevWords);
  const nowN = iCount(nowWords);
  const prevW = Number.isFinite(prevWeight) ? prevWeight : prevN;
  const nowW = Number.isFinite(nowWeight) ? nowWeight : nowN;
  // Paid weight is the cumulative weight, but ZERO until the count clears the gate.
  const paidPrev = prevN >= MIN_WORDS ? prevW : 0;
  const paidNow = nowN >= MIN_WORDS ? nowW : 0;
  const deltaWeight = paidNow - paidPrev;
  if (deltaWeight <= 0) return 0;
  // Snap each grant to a round multiple of 10 (the payout invariant — every grant ends in a
  // zero) after applying the rarity weight to the base per-word rate.
  const granted = round10(deltaWeight * perWordWins({ mode, difficulty, rebirthCount }));
  saveWins(getWins() + granted);
  saveWinsLifetime(getWinsLifetime() + granted);
  pendingStamp += granted;
  // First time this round crosses the gate → count the round (mode counters only).
  if (prevN < MIN_WORDS && nowN >= MIN_WORDS && mode && ROUND_MODES.includes(mode)) {
    const r = getRounds();
    r[mode] += 1;
    saveRounds(r);
  }
  return granted;
}

// Apply a completed round: grant wins (balance + lifetime) and bump the mode's round
// counter — but ONLY when wordsAccepted >= MIN_WORDS. Returns the wins granted. `difficulty`
// (Word Bomb / Category Blitz tier key) scales the payout via DIFFICULTY_MULT.
// NOTE: superseded by bankWordWins() for live gameplay (kept for its unit tests / as the pure
// reference for the total a full round pays). Do NOT call this AND bankWordWins for one round.
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
