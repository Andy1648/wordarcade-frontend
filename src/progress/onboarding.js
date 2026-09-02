// onboarding.js — one-time first-run spotlight flags (fix/logic-and-onboarding).
// Two flags, each shown ONCE ever: the menu XP-bar spotlight, and the first-game input
// spotlight (one step across ALL game surfaces, not per mode). localStorage-backed and
// guarded: if storage is blocked we treat the flag as ALREADY SEEN so a new-tab-per-visit
// or private-mode player is never nagged and the spotlight can never wedge.

const MENU_KEY = 'taw.seenMenuSpotlight';
const GAME_KEY = 'taw.seenGameSpotlight';

function read(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return true; // storage blocked → behave as "already seen" (never show, never block)
  }
}
function mark(key) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* storage blocked — nothing to persist */
  }
}

export const hasSeenMenuSpotlight = () => read(MENU_KEY);
export const markMenuSpotlightSeen = () => mark(MENU_KEY);
export const hasSeenGameSpotlight = () => read(GAME_KEY);
export const markGameSpotlightSeen = () => mark(GAME_KEY);
