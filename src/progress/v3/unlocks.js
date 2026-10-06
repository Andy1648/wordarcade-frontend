// v3/unlocks.js — REBIRTH UNLOCKS (progression-v3.md "Rebirth unlocks — the reason to rebirth besides ×2"), as DATA
// plus one pure predicate (imports store.js / season.js, and stock.js for the STOCK ×2 LUCK). The REBIRTH screen PR shows them (it reads UNLOCKS and says "SOON" until this lands);
// the systems below read unlocked() at their own door.
//
//   R1 ROLL screen · R2 AUTO ROLL · R3 2nd boost slot · R5 2nd MARK slot · R7 LUCK ×1.25 · R10 ASCEND
//
// An unlock is KEPT through ascension: once ★ ≥ 1 every unlock stays open (the player reached R10 to get there).
import { SEASON2 } from '../season.js';
import { s2Rebirths, getStarsV3 } from './store.js';
import { stockLuckMult } from './stock.js'; // the SHOP's STOCK ×2 LUCK · 15 MIN (P3)

export const UNLOCKS = [
  { id: 'rollScreen', at: 1, label: 'ROLL SCREEN' },
  { id: 'autoRoll', at: 2, label: 'AUTO ROLL' },
  { id: 'boost2', at: 3, label: '2ND BOOST SLOT' },
  { id: 'mark2', at: 5, label: '2ND MARK SLOT' },
  { id: 'luck', at: 7, label: 'LUCK ×1.25' },
  { id: 'ascend', at: 10, label: 'ASCEND' },
];
export const LUCK_UNLOCK_MULT = 1.25;

/** The rebirth an unlock opens at (null for an unknown id). */
export function unlockAt(feature) {
  const u = UNLOCKS.find((x) => x.id === feature);
  return u ? u.at : null;
}

/**
 * PURE: is `feature` open for `state` = { rebirths, stars }? Unknown features are closed. ASCEND is the one unlock
 * that is NOT kept by stars — it needs R10 in the current climb (an ascension resets rebirths).
 */
export function unlocked(feature, state = {}) {
  const at = unlockAt(feature);
  if (at == null) return false;
  const r = Number.isFinite(state.rebirths) && state.rebirths > 0 ? Math.floor(state.rebirths) : 0;
  const st = Number.isFinite(state.stars) && state.stars > 0 ? Math.floor(state.stars) : 0;
  if (feature === 'ascend') return r >= at;
  return r >= at || st >= 1;
}

/** The live save's state for unlocked() (season 2), or null with the flag OFF. */
export function liveUnlockState() {
  return SEASON2 ? { rebirths: s2Rebirths(), stars: getStarsV3() } : null;
}
/**
 * Live gate for a system's door: with the flag OFF every feature is as it is today (true — nothing is gated);
 * with it ON, unlocked(feature, the live save).
 */
export function featureOpen(feature) {
  const s = liveUnlockState();
  return s ? unlocked(feature, s) : true;
}
/** The roll-luck multiplier from the R7 unlock: ×1.25 once open (season 2), else ×1 — and × the STOCK's ×2 LUCK. */
export function unlockLuckMult() {
  const s = liveUnlockState();
  // × the STOCK's ×2 LUCK while one runs (season 2; stock.js is a no-op with the flag OFF)
  return (s && unlocked('luck', s) ? LUCK_UNLOCK_MULT : 1) * (s ? stockLuckMult() : 1);
}
