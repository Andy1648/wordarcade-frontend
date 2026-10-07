// registry.js — the tutorials. SPOTLIGHT STYLE (Andy oct5): "screen dims, the one target glows, tap anywhere
// to continue. No OK-button popups. Keep only the few that matter (roll, gems, rebirth, KEY TIER); cut minor
// ones like the wall moving." Every tutorial is ONE spotlight: a target selector + one short line.
// (Cut: pv10 notice, marks reveal, frenzy, boost, weekly, chain/fuse unlock, the new wall. The features still
// happen exactly as before — only their tutorial is gone.)
//
// PURE: which tutorial (if any) a surface should show now, from a snapshot of the player's state. The UI
// (SpotlightTutorial.jsx) and the "seen" flags live elsewhere. One at a time, in this order.
//
// HOSTS: a tutorial whose target lives inside a panel is shown BY that panel (`host`), never by the menu's
// TutorialHost: the ROLL button is inside MARKS (`host: 'marks'`), the KEY TIER item inside the SHOP
// (`host: 'shop'`). Both panels hold the moment queue, so the menu host could never show them anyway.
//
// EXISTING PLAYERS: the first time this system runs on a save (no TUT_INIT_KEY), every menu tutorial the player
// has ALREADY reached is marked seen, except the ones for things that are new to everyone (`isNew`).
import { rollsEnabled } from '../progress/rollsFlag.js';
import { SEASON2 } from '../progress/season.js'; // leaf: the rebirth line's step (FINAL ×2, live ×5)

export const TUT_KEY_PREFIX = 'taw.tut.';
export const TUT_INIT_KEY = 'taw.tut.init';

/** Every tutorial: id, when(snapshot) → boolean, target (CSS selector of the ONE thing it lights), line (the
 *  one short line), isNew (still shown to players who passed it before tutorials existed), host (shown by that
 *  panel, not the menu), needsTarget (not due until its target is on screen — no target, no tutorial). */
export const TUTORIALS = [
  {
    // MARK ROLLS: hosted by the ROLL screen (rollScreen/RollScreen.jsx shows it the first time it opens).
    id: 'markRolls',
    host: 'marks',
    isNew: true,
    when: (s) => s.marksRevealed && rollsEnabled(),
    target: '.rs-roll',
    line: 'ROLL FOR MARKS. YOUR FIRST ROLL IS FREE.',
  },
  {
    // GEMS: the roll currency's count on the menu. No-ops until the count is actually on screen (the gems
    // chip may not be on this build yet; when it is, this lights it the first time it shows).
    id: 'gems',
    isNew: true,
    needsTarget: true,
    when: (s) => !!s.marksRevealed,
    target: '.gems-count, .menu-gems-chip',
    line: 'GEMS PAY FOR ROLLS.',
  },
  {
    id: 'rebirth',
    when: (s) => s.rebirthReady && s.rebirths === 0,
    target: '.hp-nav.is-rebirth',
    // NUMBERS AUDIT: season 2 says this as an edge toast, and a FINAL rebirth is ×2 (the live Rebirth Rush ×5)
    line: `REBIRTH READY: ×${SEASON2 ? 2 : 5} XP & WINS, FOR GOOD.`,
  },
  {
    // KEY TIER: the first time a KEY tier is affordable (T0, before any rebirth). Hosted by the SHOP.
    id: 'keyTier',
    host: 'shop',
    isNew: true,
    when: (s) => !!s.keyAffordable && s.keyTier === 0 && s.rebirths === 0,
    target: '.shop-keypower',
    line: 'POWER: MORE XP / LETTER. HOLD TO BUY.',
  },
];

const isDue = (t, snapshot) => { try { return !!t.when(snapshot); } catch { return false; } };

/** The first MENU tutorial that is due and not yet seen, or null. `seen(id)` reads the stored flag;
 *  `hasTarget(selector)` says whether a target is on screen (only asked of `needsTarget` tutorials). */
export function dueTutorial(snapshot, seen, hasTarget = () => true) {
  for (const t of TUTORIALS) {
    if (t.host) continue; // shown by its own panel (MARKS / SHOP), not the menu
    if (seen(t.id)) continue;
    if (!isDue(t, snapshot)) continue;
    if (t.needsTarget && !hasTarget(t.target)) continue;
    return t;
  }
  return null;
}

/** The tutorial a panel hosts, if it is due and not yet seen, or null. */
export function dueHosted(host, snapshot, seen) {
  for (const t of TUTORIALS) {
    if (t.host !== host || seen(t.id)) continue;
    if (isDue(t, snapshot)) return t;
  }
  return null;
}

/** First run on a save: the ids to mark seen right away (already reached, and not new to everyone). */
export function alreadyReached(snapshot) {
  return TUTORIALS.filter((t) => !t.isNew && !t.host && isDue(t, snapshot)).map((t) => t.id);
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
