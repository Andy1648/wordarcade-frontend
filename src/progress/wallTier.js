// wallTier.js — N4 (Andy oct2): BACKGROUND PROGRESSION. "Keep the EXACT same floating-words background
// (no new art). At LV100 and every 100 levels after, rearrange the words into a new layout so the player
// SEES the world change. The level-up that crosses a 100 plays a big finite transition." No cap on tiers.
//
// The WALL TIER is floor(level / 100) of the BEST level this browser has reached — a high-water mark, so
// a rebirth (level back to 1) never takes the world back. Each tier's layout is deterministic
// (sceneLayout.scenePositions seeds by tier; tier 0 is the hand-placed wall). Crossing into a new tier
// fires WALL_EVENT once; WallScene plays the scatter-and-re-form. PURE + guarded store, no DOM.
export const WALL_LEVELS_PER_TIER = 100;
export const WALL_SEEN_KEY = 'taw.wallTierSeen';
export const WALL_EVENT = 'taw:wall-tier';
// H5: WallScene says the re-form (+ its stamp) has finished, so the menu can release the moments queue.
export const WALL_FX_DONE_EVENT = 'taw:wall-fx-done';

export function wallTierFor(level) {
  const lv = Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
  return Math.floor(lv / WALL_LEVELS_PER_TIER);
}

export function getWallTier() {
  try {
    const n = Number(localStorage.getItem(WALL_SEEN_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/**
 * Note the player's current level. If it reaches a wall tier above the best seen, store it and announce
 * the change ({ tier, from }) — once per new tier, never on a drop. Returns the new tier or null.
 */
export function noteWallLevel(level) {
  const next = wallTierFor(level);
  const prev = getWallTier();
  if (next <= prev) return null;
  try {
    localStorage.setItem(WALL_SEEN_KEY, String(next));
  } catch {
    /* storage blocked — the moment may replay, harmless */
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(WALL_EVENT, { detail: { tier: next, from: prev } }));
  }
  return next;
}
