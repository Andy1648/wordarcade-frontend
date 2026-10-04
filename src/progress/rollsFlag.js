// rollsFlag.js — MARK ROLLS on/off. They shipped DORMANT with PR #156 (Rule P held the old economy); Andy's
// PROGRESSION FINAL ("MARKS via ROLLS — turn on with this economy") turns them ON with Rebirth Rush. The roll
// panel + its tutorial appear when this is true (?rolls=1 / localStorage taw.rollsOn='1' — or taw.flag.rolls='1',
// the shared helper's key — still force it on if ROLLS_ON is ever flipped back off).
import { flagOn } from '../lib/featureFlags.js';

export const ROLLS_ON = true;
export const ROLLS_KEY = 'taw.rollsOn';

export function rollsEnabled() {
  if (ROLLS_ON) return true;
  return flagOn('rolls', { legacyKey: ROLLS_KEY });
}
