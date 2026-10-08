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
//   * TYPED in-game letters credit at MENU_LETTER_SHARE (×0.2, the menu's anti-mash share) — gibberish in a game
//     input pays no more than gibberish on the menu. When a word is ACCEPTED, its letters top up to the full rate
//     (creditAcceptedWordLetters, called from wins.js awardWordXp — the one per-accepted-word path every mode
//     takes): BASE 10 XP / LETTER is what the LETTERS OF YOUR WORDS pay.
import { createRateLimiter, creditXp, loadProgress, saveProgress, levelXpPerLetter, getKeyTier, getRebirths, roundWordXp, MENU_LETTER_SHARE, setLetterBaseAdd } from './xp.js';
import { markXpMult, markBaseXp } from './markRollsCore.js';
import { MARK_TIERS } from './marks.js';
import { letterPerkMult } from './markPerks.js';
import { emitMidGameLevelUp } from './levelUpSignal.js';
import { boostMult } from './boost.js';
import { notePlay } from './overdrive.js';
// SEASON 2 (PROGRESSION FINAL v2, "mashing is the game"): ANY key counts — no rate cap — and a typed game letter pays
// ×1 at once (no ×0.2 typed share, no accepted-word top-up). OFF = unchanged.
import { SEASON2 } from './season.js';

// The worn MAIN mark's XP boost by tier (base finish) — the SAME bonus wins get (MARKS via ROLLS: one MARK).
// Read LAZILY (enumerable getters): wins.js imports this module, and marks.js → claims.js → wins.js → here is a
// cycle, so MARK_TIERS may not be initialised yet while this module evaluates (marks.js loaded first).
const MARK_TIER_IDS = ['common', 'rare', 'epic', 'legendary', 'mythic', 'secret'];
export const MARK_XP_BOOST = Object.freeze(
  Object.defineProperties({}, Object.fromEntries(MARK_TIER_IDS.map((t) => [t, { enumerable: true, get: () => MARK_TIERS[t].bonus }]))),
);

/** The MARK on XP per letter (MARKS v2): the worn +N% XP stat (or a PERMANENT's MAIN) × the INDEX bonus —
 *  markRollsCore.markXpMult. ×1 with nothing worn on a save that has never rolled. `markId` undefined = the worn
 *  mark. Guarded: a failure is ×1. */
export function markXpBoost(markId) {
  return markXpMult({ markId });
}
// The worn +N BASE XP/LETTER, read by levelXpPerLetter for every letter path (menu keys included).
setLetterBaseAdd(() => markBaseXp());

/** XP per letter for the live save: (BASE 10 + MARK BASE XP) × KEY × REBIRTH 5^R × MARK × BOOST (code boost ×
 *  OVERDRIVE) × the DOUBLE LETTERS perk (LEVIATHAN: letters count ×2). */
export function letterXpNow() {
  return levelXpPerLetter(getKeyTier(), getRebirths(), markXpBoost()) * letterPerkMult() * boostMult();
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
let lastCreditAt = 0;
export function creditLetterXp(letters, { mode, perLetter } = {}) {
  const n = Number.isFinite(letters) && letters > 0 ? Math.floor(letters) : 0;
  if (!n) return null;
  // OVERDRIVE's clock: the time since the previous credit is PLAY (capped per gap in overdrive.js)
  const now = Date.now();
  if (lastCreditAt) notePlay(now - lastCreditAt, now);
  lastCreditAt = now;
  const per = Number.isFinite(perLetter) && perLetter > 0 ? perLetter : letterXpNow();
  // SEASON 2 (FINAL v3, BASE 1 XP a letter): the credit stays FRACTIONAL (the bar stores the fraction) — rounding a
  // one-letter flush of 1.1 XP to 1 would make every small mark / boost pay nothing at the start. Season 1 unchanged.
  const xp = SEASON2 ? n * per : roundWordXp(n * per);
  const before = loadProgress();
  const res = creditXp(before, xp);
  saveProgress(res.state);
  if (res.leveledUp && mode && mode !== 'menu') emitMidGameLevelUp(res.level, mode, before.level);
  return { ...res, xp };
}

// ---- the ONE letter limiter (menu + games) ---------------------------------------------------------------
export const LETTER_RATE_CAP = 12; // credited letters per rolling second, menu and games together
let limiter = createRateLimiter({ capacity: LETTER_RATE_CAP, windowMs: 1000 });
/** Consume one letter credit from the shared cap (useXpCapture calls this for menu keys / taps). */
export function tryLetterCredit(now = Date.now()) {
  if (SEASON2) return true; // season 2: no rate cap
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
    if (SEASON2) ok = k; // season 2: no rate cap
    else for (let i = 0; i < k; i++) if (limiter.tryConsume(now)) ok += 1;
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

/** Credit everything pending (one storage read + one write) at the TYPED share (×MENU_LETTER_SHARE — an
 *  accepted word tops its own letters up to full, creditAcceptedWordLetters). Safe to call any time. */
export function flushLetterXp() {
  scheduled = false;
  const n = pending;
  const mode = pendingMode;
  pending = 0;
  if (!n) return null;
  try {
    return creditLetterXp(n, { mode, perLetter: letterXpNow() * (SEASON2 ? 1 : MENU_LETTER_SHARE) });
  } catch {
    return null;
  }
}

/** An ACCEPTED word's letter top-up: its `length` letters already paid the typed share (×MENU_LETTER_SHARE) as
 *  they were typed, so the word adds the rest — (1 − share) × length × XP per letter — through creditLetterXp.
 *  Not rate-capped (the word was accepted by the game, not mashed). Menu words never top up. Never throws. */
export function creditAcceptedWordLetters(length, mode) {
  try {
    const n = Number.isFinite(length) && length > 0 ? Math.floor(length) : 0;
    if (SEASON2 || !n || !mode || mode === 'menu') return null; // season 2: typed letters already paid ×1
    return creditLetterXp(n, { mode, perLetter: letterXpNow() * (1 - MENU_LETTER_SHARE) });
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
  lastCreditAt = 0;
}
