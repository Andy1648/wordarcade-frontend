// frenzy.js — FUSE FRENZY (STEP 20 / Andy oct2).
//
// FUSE pays the SAME per word as Word Bomb. What makes it the higher-bar mode is FRENZY: light all
// 26 letters of the strip in a run and FUSE pays ×FRENZY_MULT wins for FRENZY_MS of REAL time. The
// clock is wall-clock (an expiry timestamp in storage), so it persists across runs, reloads and
// the menu — dying in a run doesn't end it, the clock does. Clearing the strip again while it is
// running does NOT extend it (a strong player clears every ~2 min of FUSE — extension would make
// FRENZY permanent and FUSE a flat ×5 mode; claude/econ-oct2/frenzy-sim.mjs). The re-clear still
// pays its trigger bonus and its life.
//
// The multiplier is a named factor of the one payout stack (wins.js perWordFactors → `frenzy`),
// so the receipt, the HUD rate and the bank all read the same ×5.
//
// PURE + guarded store, like every other progress module: blocked storage → no frenzy, never throws.

import { frenzyBonusMs } from './stars.js';
import { announceTimers } from './boost.js';
import { frenzyEveryMode } from './markPerks.js';

export const FRENZY_KEY = 'taw.frenzyUntil';
export const FRENZY_MODE = 'fuse';
export const FRENZY_MULT = 5;
export const FRENZY_MS = 5 * 60 * 1000;
// SEASON 2 (Andy oct8, final: "just 5x XP for 5 minutes is fine — that's like the free version of overdrive, overdrive
// is the premium version"): a FRENZY is ×5 on XP PER KEY (v3/hooks.js xpSwap.d reads frenzyXpMult) and NO wins
// multiplier. v3/install.js flips this on; season 1 keeps ×FRENZY_MULT FUSE wins.
export const FRENZY_XP_MULT = 5;
let xpOnly = false;
/** v3 (SEASON2): FRENZY becomes ×5 XP per key, everywhere; frenzyMult (the wins row) reads ×1. */
export function __v3() {
  xpOnly = true;
}
// The trigger payout: this many words' worth of FUSE wins at the frenzy rate, on the clear itself.
export const FRENZY_TRIGGER_WORDS = 10;

function readUntil() {
  try {
    const v = Number(localStorage.getItem(FRENZY_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

/** ms of FRENZY left at `now` (0 when none). */
export function frenzyRemaining(now = Date.now()) {
  return Math.max(0, readUntil() - now);
}

export function isFrenzyActive(now = Date.now()) {
  return frenzyRemaining(now) > 0;
}

/** The frenzy multiplier for a mode right now: ×FRENZY_MULT for FUSE while active, else 1. The WILDFIRE perk
 *  (ORIGIN, SECRET mark) pays a running FRENZY in EVERY mode. (It is still lit by clearing FUSE's strip.) */
export function frenzyMult(mode, now = Date.now()) {
  if (xpOnly) return 1; // season 2: FRENZY pays XP (frenzyXpMult), never wins
  const m = mode === 'fuse' || mode === FRENZY_MODE ? FRENZY_MODE : mode;
  if (m !== FRENZY_MODE && !frenzyEveryMode()) return 1;
  return isFrenzyActive(now) ? FRENZY_MULT : 1;
}

/** What a FRENZY pays, for labels: season 2 "×5 XP", season 1 "×5" (the FUSE wins multiplier). */
export function frenzyShort() {
  return xpOnly ? `×${FRENZY_XP_MULT} XP` : `×${FRENZY_MULT}`;
}

/** Season 2: ×FRENZY_XP_MULT on XP per key while a FRENZY runs (any screen), else ×1. Season 1: always ×1. */
export function frenzyXpMult(now = Date.now()) {
  return xpOnly && isFrenzyActive(now) ? FRENZY_XP_MULT : 1;
}

/** Start FRENZY (a no-op while one is already running). Returns { started, remaining }. */
export function startFrenzy(now = Date.now()) {
  const left = frenzyRemaining(now);
  if (left > 0) return { started: false, remaining: left };
  const len = FRENZY_MS + frenzyBonusMs(); // + FRENZY+ star perk
  const until = now + len;
  try {
    localStorage.setItem(FRENZY_KEY, String(until));
    localStorage.setItem(FRENZY_COUNT_KEY, String(frenzyCount() + 1));
  } catch {
    /* storage blocked — no frenzy */
  }
  announceTimers();
  return { started: true, remaining: len };
}

export const FRENZY_COUNT_KEY = 'taw.frenzyCount';
/** How many FRENZYs the player has ever started (the FRENZY! achievement + PYRO mark). */
export function frenzyCount() {
  try {
    const n = Number(localStorage.getItem(FRENZY_COUNT_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** m:ss for a countdown. */
export function formatFrenzy(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** How long a FRENZY lasts for this player, in whole minutes (5 + the FRENZY+ star perk). */
export function frenzyMinutes() {
  return Math.round((FRENZY_MS + frenzyBonusMs()) / 60000);
}

// ---- FUSE CLUTCH (STEP 56) ----------------------------------------------------------------------
// A word accepted with CLUTCH_MS or less on the fuse is a CLUTCH: a bonus of CLUTCH_WORDS words at
// the current FUSE rate (so it is ×5 inside a FRENZY), paid through the labelled door — itemised on
// the run's receipt as "CLUTCH!".
export const CLUTCH_MS = 2000;
export const CLUTCH_WORDS = 3;
export function isClutch(leftMs) {
  return Number.isFinite(leftMs) && leftMs >= 0 && leftMs <= CLUTCH_MS;
}
