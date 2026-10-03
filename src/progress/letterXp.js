// letterXp.js — PROGRESSION v11 (amended oct3 18:15): THE BAR FILLS FROM LETTERS.
//
// ANDY: "GAME WORDS GIVE WINS ONLY." / "THE BAR fills from typing LETTERS (menu + in-game) × KEY tier
// XP/letter × rebirth/mark XP boosts. That's the loop: play → wins → buy KEY → more XP per letter → level
// faster." This module is the ONE shared path for IN-GAME letters (Word Bomb / Blitz, CHAIN / FUSE, SAT
// RUSH, WORD RACE); the menu keeps its own keystroke path (useXpCapture), priced by the same
// levelXpPerLetter() × the same worn-mark boost (markXpBoost below).
//
// THE RULES (the menu's, applied in-game):
//   * one letter = one credit, a–z only; a jump of 3+ letters in one change (paste, autocomplete) is 0;
//   * ONE anti-mash cap SHARED by the menu and every game input: at most LETTER_RATE_CAP (12) credited
//     letters per rolling second (≈ 140 WPM — above any honest burst, far below a held-down mash);
//   * BATCHED: noteTypedLetters / noteLetters only count (O(1), no storage, no layout, no React state)
//     and schedule ONE flush per animation frame; the flush reads the level state once, credits
//     letters × XP-per-letter through creditXp, writes once, and fires the mid-game LV chip on a
//     level-up. So a keystroke costs a counter bump — input latency is untouched.
import { createRateLimiter, creditXp, loadProgress, saveProgress, levelXpPerLetter, getKeyTier, getRebirths, roundWordXp } from './xp.js';
import { wornMarkId, markEntry } from './markRollsCore.js';
import { emitMidGameLevelUp } from './levelUpSignal.js';

// The worn MAIN mark's XP boost — modest and readable, by tier (a rolled PERMANENT reads as LEGENDARY).
export const MARK_XP_BOOST = { common: 0.1, rare: 0.2, epic: 0.3, legendary: 0.5 };

/** ×(1 + boost) for the worn mark (×1 with nothing worn). Guarded: a storage failure is ×1. */
export function markXpBoost(markId) {
  try {
    const id = markId === undefined ? wornMarkId() : markId;
    if (!id) return 1;
    const m = markEntry(id);
    const b = m ? MARK_XP_BOOST[m.tier] : 0;
    return 1 + (Number.isFinite(b) ? b : 0);
  } catch {
    return 1;
  }
}

/** XP per letter for the live save: BASE 10 × KEY × rebirth × worn mark. */
export function letterXpNow() {
  return levelXpPerLetter(getKeyTier(), getRebirths(), markXpBoost());
}

const LETTER = /[a-z]/gi;
const countLetters = (s) => (typeof s === 'string' ? (s.match(LETTER) || []).length : 0);
export const MAX_LETTERS_PER_CHANGE = 2; // more than this in one change event is a paste / autocomplete

/** Letters ADDED by one input change (prev → next value). 0 for deletions and pastes. PURE. */
export function lettersAdded(prev, next) {
  const d = countLetters(next) - countLetters(prev);
  return d > 0 && d <= MAX_LETTERS_PER_CHANGE ? d : 0;
}

/**
 * Credit `letters` typed letters NOW (synchronous): letters × XP-per-letter through creditXp, persisted.
 * The flush below and the loop sim both call this. Returns creditXp's result plus { xp }.
 */
export function creditLetterXp(letters, { mode, perLetter } = {}) {
  const n = Number.isFinite(letters) && letters > 0 ? Math.floor(letters) : 0;
  if (!n) return null;
  const per = Number.isFinite(perLetter) && perLetter > 0 ? perLetter : letterXpNow();
  const xp = roundWordXp(n * per);
  const res = creditXp(loadProgress(), xp);
  saveProgress(res.state);
  if (res.leveledUp && mode && mode !== 'menu') emitMidGameLevelUp(res.level, mode);
  return { ...res, xp };
}

// ---- the ONE letter limiter (menu + games) ---------------------------------------------------------------
export const LETTER_RATE_CAP = 12; // credited letters per rolling second, menu and games together
let limiter = createRateLimiter({ capacity: LETTER_RATE_CAP, windowMs: 1000 });
/** Consume one letter credit from the shared cap (useXpCapture calls this for menu keys / taps). */
export function tryLetterCredit(now = Date.now()) {
  try {
    return limiter.tryConsume(now);
  } catch {
    return false;
  }
}

// ---- the batched in-game path -------------------------------------------------------------------------
let pending = 0;
let pendingMode = null;
let scheduled = false;

function schedule() {
  if (scheduled) return;
  scheduled = true;
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 16);
  raf(flushLetterXp);
}

/** Count `n` typed letters for `mode` (rate-capped) and schedule the per-frame flush. Never throws. */
export function noteLetters(n, mode, now = Date.now()) {
  try {
    const k = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    let ok = 0;
    for (let i = 0; i < k; i++) if (limiter.tryConsume(now)) ok += 1;
    if (!ok) return 0;
    pending += ok;
    pendingMode = mode || pendingMode;
    schedule();
    return ok;
  } catch {
    return 0;
  }
}

/** The input-change form: credit the letters a controlled input's value gained (prev → next). */
export function noteTypedLetters(prev, next, mode) {
  const n = lettersAdded(prev, next);
  return n ? noteLetters(n, mode) : 0;
}

/** Credit everything pending (one storage read + one write). Safe to call any time; returns the result. */
export function flushLetterXp() {
  scheduled = false;
  const n = pending;
  const mode = pendingMode;
  pending = 0;
  if (!n) return null;
  try {
    return creditLetterXp(n, { mode });
  } catch {
    return null;
  }
}

/** Tests: a fresh limiter and an empty buffer. */
export function resetLetterXp() {
  limiter = createRateLimiter({ capacity: LETTER_RATE_CAP, windowMs: 1000 });
  pending = 0;
  pendingMode = null;
  scheduled = false;
}
