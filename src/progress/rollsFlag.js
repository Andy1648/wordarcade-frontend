// rollsFlag.js — MARK ROLLS ship DORMANT. Rule P (Andy oct2 22:25: an economy change merges only if no window
// gets worse) HELD the rolls economy on PR #156 — 12 windows worse, e.g. casual 20 h KEY wait 24 → 64 min, and a
// 20% runaway-level rate from the legendary jackpot. The code merges with everything else in #156; the roll
// panel + its tutorial only appear when this flag is on. Andy flips ROLLS_ON (or tests with ?rolls=1 /
// localStorage taw.rollsOn='1' — taw.flag.rolls='1', the shared helper's key, works too).
import { flagOn } from '../lib/featureFlags.js';

export const ROLLS_ON = false;
export const ROLLS_KEY = 'taw.rollsOn';

export function rollsEnabled() {
  if (ROLLS_ON) return true;
  return flagOn('rolls', { legacyKey: ROLLS_KEY });
}
