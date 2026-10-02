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

export const FRENZY_KEY = 'taw.frenzyUntil';
export const FRENZY_MODE = 'fuse';
export const FRENZY_MULT = 5;
export const FRENZY_MS = 5 * 60 * 1000;
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

/** The frenzy multiplier for a mode right now: ×FRENZY_MULT for FUSE while active, else 1. */
export function frenzyMult(mode, now = Date.now()) {
  const m = mode === 'fuse' || mode === FRENZY_MODE ? FRENZY_MODE : mode;
  return m === FRENZY_MODE && isFrenzyActive(now) ? FRENZY_MULT : 1;
}

/** Start FRENZY (a no-op while one is already running). Returns { started, remaining }. */
export function startFrenzy(now = Date.now()) {
  const left = frenzyRemaining(now);
  if (left > 0) return { started: false, remaining: left };
  const until = now + FRENZY_MS;
  try {
    localStorage.setItem(FRENZY_KEY, String(until));
  } catch {
    /* storage blocked — no frenzy */
  }
  return { started: true, remaining: FRENZY_MS };
}

/** m:ss for a countdown. */
export function formatFrenzy(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
