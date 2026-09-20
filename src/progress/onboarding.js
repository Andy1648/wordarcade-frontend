// onboarding.js — one-time first-run spotlight flags (fix/logic-and-onboarding).
// Two flags, each shown ONCE ever: the menu XP-bar spotlight, and the first-game input
// spotlight (one step across ALL game surfaces, not per mode). localStorage-backed and
// guarded: if storage is blocked we treat the flag as ALREADY SEEN so a new-tab-per-visit
// or private-mode player is never nagged and the spotlight can never wedge.

const MENU_KEY = 'taw.seenMenuSpotlight';
// Has this browser ever RENDERED the menu? Distinct from MENU_KEY above, which only flips when
// the first-run spotlight is dismissed — a player can see the menu and never dismiss it. Written
// on Homepage mount, read by the solo run-over "there are more modes" offer so a stranger who
// arrived on a shared CHAIN/FUSE link is the only one pitched. Blocked storage reads as SEEN, so
// the offer fails closed (never shown) rather than shown to everyone.
const MENU_SEEN_KEY = 'taw.seenMenu';
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
export const hasSeenMenu = () => read(MENU_SEEN_KEY);
export const markMenuSeen = () => mark(MENU_SEEN_KEY);
export const hasSeenGameSpotlight = () => read(GAME_KEY);
export const markGameSpotlightSeen = () => mark(GAME_KEY);

// ---------------------------------------------------------------------------------------------
// PER-MODE TEACH (feat/teach-first-run)
//
// THE DEFECT THIS EXISTS TO FIX. `GAME_KEY` above is ONE flag "across ALL game surfaces, not per
// mode" — so whichever mode a player opened first is the only mode that ever taught them
// anything, and every mode after it dropped them into a live clock with a prompt and no rule.
// Andy: "People aren't getting the gist of randomly typing." That is not a copy problem; it is
// four modes that never got a turn to explain themselves.
//
// The teach is now keyed PER MODE, so each one gets exactly one chance to explain itself, once,
// the first time it is played. Same storage discipline as above: a blocked store reads as
// ALREADY SEEN, so a private-mode player is never nagged and the strip can never wedge a run.
const TEACH_PREFIX = 'taw.seenTeach.';

/** Has this mode already taught itself? `mode` is the gameData id ('word-bomb', 'chain', …). */
export function hasSeenTeach(mode) {
  if (!mode) return true;
  return read(`${TEACH_PREFIX}${mode}`);
}
export function markTeachSeen(mode) {
  if (!mode) return;
  mark(`${TEACH_PREFIX}${mode}`);
}
