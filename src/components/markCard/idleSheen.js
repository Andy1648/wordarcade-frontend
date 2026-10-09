// idleSheen.js — THE IDLE SHEEN's numbers (ROLL REVEAL v2): LEGENDARY+ only, ONE sweep at a time, ONE shared timer.
// The INDEX (MarksIndex useIdleSheen) and the menu's YOUR GEAR slot (MenuNav) both read these. Split out of
// rollScreen/revealPlan.js (which re-exports them) so the menu's eager chunk does not carry the whole reveal plan
// (payload ratchet).
export const IDLE_SHEEN_TIERS = new Set(['legendary', 'mythic', 'secret']);
export const IDLE_SHEEN_EVERY_MS = 6000;
export const IDLE_SHEEN_MS = 900;
/** The next card to sweep: round-robin over the visible candidates, after `prev` (an index into `ids`). -1 = none. */
export function nextIdleSheen(ids, visible, prev = -1) {
  const n = ids.length;
  for (let k = 1; k <= n; k += 1) {
    const i = (prev + k + n) % n;
    if (visible.has(ids[i])) return i;
  }
  return -1;
}
