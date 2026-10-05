// levelUpSignal.js — the MID-GAME level-up, as a signal the game screens can hear.
//
// XP is credited per accepted word inside awardWordXp (progress/wins.js) in EVERY mode — Word Bomb
// and Blitz from App's WS drain, CHAIN / FUSE / SAT RUSH from their own screens. A level crossed
// there used to be silent until the menu's useXpCapture celebrated it later. awardWordXp now emits
// this signal when a GAME word (never menu typing) crosses a level, and the in-game LV chip
// (components/FeelLadder LevelUpChip) answers with a small finite punch + chime. The full
// celebration still waits for the menu / receipt. Read-only: nothing here touches XP or wins.
export const MIDGAME_LEVEL_UP = 'taw:midgame-level-up';

/**
 * Fire the signal. `from` is the level BEFORE the credit, so the chip can tick through every level
 * a multi-level climb crossed (lib/barPlan). A no-op where there is no window (node unit tests).
 * Never throws.
 */
export function emitMidGameLevelUp(level, mode, from) {
  try {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent(MIDGAME_LEVEL_UP, { detail: { level, mode, from } }));
  } catch {
    /* a feel signal must never break crediting */
  }
}

/** Subscribe; returns the unsubscribe. `fn` receives { level, mode, from }. */
export function onMidGameLevelUp(fn) {
  if (typeof window === 'undefined') return () => {};
  const h = (e) => fn((e && e.detail) || {});
  window.addEventListener(MIDGAME_LEVEL_UP, h);
  return () => window.removeEventListener(MIDGAME_LEVEL_UP, h);
}
