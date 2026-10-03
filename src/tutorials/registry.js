// registry.js — T (Andy oct2): SHORT TUTORIALS FOR EVERY UNLOCK. "A one-time, skippable, big-type, 1–3 step
// tutorial the first time a player reaches each feature … One shared component, shown once (stored
// flag), never blocking a game in progress, readable with motion off."
//
// PURE: which tutorial (if any) the menu should show now, from a snapshot of the player's state. The UI
// (UnlockTutorial.jsx) and the "seen" flags live elsewhere. One at a time, in this order.
//
// EXISTING PLAYERS: the first time this system runs on a save (no TUT_INIT_KEY), every tutorial the player
// has ALREADY reached is marked seen — a LV300 player must not sit through five cards on their next visit —
// except the ones for things that are new to everyone (the LV100 wall change), which they have never seen.
import { FRENZY_MULT, frenzyMinutes } from '../progress/frenzy.js';

export const TUT_KEY_PREFIX = 'taw.tut.';
export const TUT_INIT_KEY = 'taw.tut.init';

/** Every tutorial: id, when(snapshot) → boolean, isNew (still shown to players who passed it before
 *  tutorials existed), and 1–3 steps of { title, line, target? } (target = a CSS selector to point at). */
export const TUTORIALS = [
  {
    id: 'marks',
    when: (s) => s.marksRevealed,
    steps: [
      { title: 'MARKS', line: 'EARN THEM FROM HARD ACHIEVEMENTS.' },
      { title: 'WEAR ONE AS YOUR MAIN', line: 'YOUR MAIN MULTIPLIES EVERY WORD.', target: '.menu-mark, .hp-m-navbtn.is-marks' },
    ],
  },
  {
    // MARK ROLLS (Andy M): unlocks with MARKS. It points at the ROLL button, which lives INSIDE the MARKS
    // panel — so it is hosted there (`host: 'marks'`, MarksIndex.jsx shows it the first time the panel
    // opens), never by the menu's TutorialHost (dueTutorial skips hosted entries). New to everyone.
    id: 'markRolls',
    host: 'marks',
    isNew: true,
    when: (s) => s.marksRevealed,
    steps: [
      { title: 'ROLL FOR MARKS', line: 'YOUR FIRST ROLL IS FREE.', target: '.mr-roll' },
      { title: 'HOLD TO KEEP ROLLING', line: 'RARER MARKS PAY MORE. 10 DUPES MAKE A GOLD.', target: '.mr-roll' },
    ],
  },
  {
    id: 'frenzy',
    when: (s) => s.frenzyActive,
    steps: [{ title: `FRENZY ×${FRENZY_MULT}`, line: `EVERY FUSE WORD PAYS ×${FRENZY_MULT} FOR ${frenzyMinutes()} MIN.` }],
  },
  {
    id: 'boost',
    when: (s) => s.boostActive,
    steps: [{ title: 'BOOST', line: 'EVERY WORD IN EVERY MODE PAYS MORE UNTIL THE CLOCK RUNS OUT.', target: '.boost-pill' }],
  },
  {
    id: 'weekly',
    when: (s) => s.hasProfile,
    steps: [
      { title: 'THIS WEEK', line: 'A FRESH BOARD EVERY MONDAY. EVERY WORD YOU TYPE COUNTS.' },
      { title: 'YOUR RANK', line: 'TAP THE TROPHY TO SEE IT.', target: '.homepage-board-hero, .hp-m-board-hero' },
    ],
  },
  {
    id: 'rebirth',
    when: (s) => s.rebirthReady && s.rebirths === 0,
    steps: [
      { title: 'REBIRTH READY', line: 'YOUR LEVEL GOES BACK TO 1 — FOR A PERMANENT BONUS.' },
      { title: 'YOU KEEP', line: 'KEY POWER, MARKS AND YOUR WINS.', target: '.homepage-nav-btn.is-rebirth, .hp-m-navbtn.is-rebirth' },
    ],
  },
  {
    id: 'chain',
    when: (s) => s.level >= s.chainLevel,
    steps: [{ title: 'CHAIN UNLOCKED', line: 'EACH WORD STARTS WITH THE LAST WORD\'S LAST LETTER.', target: '[data-game="chain"], .hp-m-solo-btn--chain' }],
  },
  {
    id: 'fuse',
    when: (s) => s.level >= s.fuseLevel,
    steps: [{ title: 'FUSE UNLOCKED', line: 'SNEAK THE LETTERS INTO A WORD BEFORE THE FUSE BURNS.', target: '[data-game="fuse"], .hp-m-solo-btn--fuse' }],
  },
  {
    id: 'wall',
    isNew: true,
    when: (s) => s.wallTier >= 1,
    steps: [{ title: 'NEW WALL', line: 'EVERY 100 LEVELS THE WALL MOVES.', sub: (s) => `NEXT AT LV ${(s.wallTier + 1) * 100}` }],
  },
];

/** The first tutorial that is due and not yet seen, or null. `seen(id)` reads the stored flag. */
export function dueTutorial(snapshot, seen) {
  for (const t of TUTORIALS) {
    if (t.host) continue; // shown by its own screen (e.g. markRolls inside the MARKS panel), not the menu
    if (seen(t.id)) continue;
    let due = false;
    try { due = !!t.when(snapshot); } catch { due = false; }
    if (due) return t;
  }
  return null;
}

/** First run on a save: the ids to mark seen right away (already reached, and not new to everyone). */
export function alreadyReached(snapshot) {
  return TUTORIALS.filter((t) => !t.isNew && !t.host && (() => { try { return !!t.when(snapshot); } catch { return false; } })()).map((t) => t.id);
}

// ---- the stored flags (guarded, like every other store) ----------------------------------------------
export function hasSeenTutorial(id) {
  try { return localStorage.getItem(TUT_KEY_PREFIX + id) === '1'; } catch { return true; } // blocked → never nag
}
export function markTutorialSeen(id) {
  try { localStorage.setItem(TUT_KEY_PREFIX + id, '1'); } catch { /* blocked */ }
}
/** Run once per save before the first dueTutorial: marks already-reached tutorials seen. */
export function initTutorials(snapshot) {
  try {
    if (localStorage.getItem(TUT_INIT_KEY) === '1') return [];
    const ids = alreadyReached(snapshot);
    for (const id of ids) markTutorialSeen(id);
    localStorage.setItem(TUT_INIT_KEY, '1');
    return ids;
  } catch {
    return [];
  }
}
