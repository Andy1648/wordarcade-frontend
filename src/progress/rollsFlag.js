// rollsFlag.js — MARK ROLLS on/off. They shipped DORMANT with PR #156 (Rule P held the old economy); Andy's
// PROGRESSION FINAL ("MARKS via ROLLS — turn on with this economy") turns them ON with Rebirth Rush. The roll
// panel + its tutorial appear when this is true (?rolls=1 / localStorage taw.rollsOn='1' still force it on).
export const ROLLS_ON = true;
export const ROLLS_KEY = 'taw.rollsOn';

export function rollsEnabled() {
  if (ROLLS_ON) return true;
  try {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('rolls') === '1') return true;
  } catch { /* no window */ }
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(ROLLS_KEY) === '1';
  } catch {
    return false;
  }
}
