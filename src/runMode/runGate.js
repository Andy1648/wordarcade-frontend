// runGate.js — THE FREE FIRST RUN (fix/onramp).
//
// THE RUN is the mode that makes a newcomer stay, but it's level-gated (LV8), so on a
// fresh account the menu's hero card is a grey padlock — the worst possible first
// impression (stranger test, verdict-4). The fix: let a brand-new player play ONE run
// immediately; the LV8 gate applies only from the SECOND run onward. So THE RUN card is
// locked iff (below the unlock level) AND (the free first run has already been used).
//
// The flag is set the moment a run's first round actually STARTS (see useRunMode), so
// merely opening the wall preview and backing out does NOT burn the freebie — you must
// really play. Guarded localStorage; a read/write failure just means "not used yet",
// which fails safe toward letting the player in.
export const RUN_FREE_KEY = 'taw.runFreeUsed';

export function hasUsedFreeRun() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(RUN_FREE_KEY) === '1';
  } catch {
    return false; // storage blocked → treat as unused (let them in)
  }
}

export function markFreeRunUsed() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(RUN_FREE_KEY, '1');
  } catch {
    /* storage blocked — the run still plays; the gate just won't engage next time */
  }
}

// Is THE RUN card locked for this player? Locked only when BOTH gated by level AND the
// free first run is spent. `unlockLevel` null/undefined → never gated.
export function isRunLocked(level, unlockLevel) {
  if (unlockLevel == null) return false;
  if (level >= unlockLevel) return false;
  return hasUsedFreeRun();
}
