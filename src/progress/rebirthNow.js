// rebirthNow.js — REBIRTH READY → ×5 FOREVER (Andy oct3: "never let a player miss that they can rebirth").
//
// One tap from ANY round-end screen or the menu goes straight into the rebirth moment. The tap only
// raises a one-shot INTENT here and leaves through the screen's EXISTING exit (solo onExit / the room's
// leave path) — no App view/room lifecycle is touched. The menu sees the intent on mount and opens the
// REBIRTH view; ShopScreen takes the intent on mount and runs its own confirmRebirth (rebirthWithStars +
// the RebirthCeremony) with no confirm step. CONTINUE lands on the menu, which plays the REBIRTH N card.
//
// Module-scoped like xp.js's pendingRebirth: a page reload drops it, which is the safe failure (the
// player is simply on the menu with the CTA still showing).
import { loadProgress, getRebirths, rebirthThreshold, REBIRTH_POWER } from './xp.js';
import { formatNum } from '../format.js';

let intent = false;

/** True when the player's CURRENT level is at or past the next rebirth gate. Never throws. */
export function isRebirthReadyNow() {
  try {
    return loadProgress().level >= rebirthThreshold(getRebirths());
  } catch {
    return false;
  }
}

/** The tap: arm the one-shot intent (the caller then leaves through its own exit). */
export function requestRebirthNow() {
  intent = true;
}

/** Is an intent armed? (Read-only — the menu and ShopScreen's first render peek before taking.) */
export function peekRebirthNow() {
  return intent;
}

/** Consume the intent: returns whether one was armed, and clears it. */
export function takeRebirthNow() {
  const v = intent;
  intent = false;
  return v;
}

// The button copy — exactly "REBIRTH READY → ×5 FOREVER"; the 5 is REBIRTH_POWER through formatNum.
export const REBIRTH_READY_COPY = `REBIRTH READY → ×${formatNum(REBIRTH_POWER)} FOREVER`;
