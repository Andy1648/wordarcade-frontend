// menuMoments.js — H5 wiring (Andy oct3 02:24 "important = announced: one shared popup component with a
// queue, never stacking"; H3 "never two heavy at once (queue them)"). The MENU's big moments, as data: who
// they are, how they rank, how long each really plays, and the safety release (maxMs) the queue uses if a
// moment's done() is ever lost. Pure (no DOM, no React) so the ORDER is unit-tested.
//
// The queue (moments.js) owns order only. Every moment keeps its own art and its own clock; only its START
// is queued, and it calls done() when it has finished. This replaces the hand-tuned timers that kept the
// menu's moments apart (RANKUP_DELAY_MS 1600, the tier-up's wallWait()+1850, TutorialHost's 1 s BUSY poll,
// the mark/automation cards' 800/1600 ms guesses).
import { PRIORITY } from './moments.js';

// ---- the moments' REAL lengths (single source; the components import these) ----------------------------
/** The level-up element's card (MenuXp: tier-up, rebirth, mark upgraded, automation). */
export const CARD_MS = 1500;
/** The wall re-form + its level stamp (WallScene / wallFx). */
export const WALL_FX_MS = 1650;
/** The wall waits this long after the menu mounts (the arrival wipe) before it re-forms — the wall's own
 *  timing, unchanged. */
export const WALL_SETTLE_MS = 1800;
/** The rank-up card (RankUpMoment). */
export const RANKUP_MS = 2200;
/** The claim popup tucks itself away after this (the REWARDS badge keeps the reminder). */
export const CLAIM_TUCK_MS = 8000;
/** Head-room for a lazy chunk (wallFx, RankUpMoment) to arrive before the moment's own clock starts. */
export const CHUNK_SLACK_MS = 3000;
/** A tutorial is player-paced (NEXT … GOT IT): the safety release is long, never a guess at reading time. */
export const TUTORIAL_MAX_MS = 120000;

/** Every menu moment: id → { priority, ms (real length), maxMs (safety), interruptible }. */
export const MENU_MOMENTS = {
  wall: { priority: PRIORITY.LEVEL, ms: WALL_SETTLE_MS + WALL_FX_MS, maxMs: WALL_SETTLE_MS + WALL_FX_MS + CHUNK_SLACK_MS },
  'tier-up': { priority: PRIORITY.LEVEL, ms: CARD_MS, maxMs: CARD_MS + 1000 },
  rebirth: { priority: PRIORITY.LEVEL, ms: CARD_MS, maxMs: CARD_MS + 1000 },
  'rank-up': { priority: PRIORITY.LEVEL, ms: RANKUP_MS, maxMs: RANKUP_MS + CHUNK_SLACK_MS + 800 },
  'claim-pop': { priority: PRIORITY.REWARD, ms: CLAIM_TUCK_MS, maxMs: CLAIM_TUCK_MS + 1000, interruptible: true },
  // extensions-spec a (dormant, flagOn('rival')): "XAVI PASSED YOU" — the rank-up card's passed variant.
  // INFO: it never plays over a rank-up, wall or tier-up.
  rival: { priority: PRIORITY.INFO, ms: RANKUP_MS, maxMs: RANKUP_MS + CHUNK_SLACK_MS + 800 },
  'mark-up': { priority: PRIORITY.INFO, ms: CARD_MS, maxMs: CARD_MS + 1000 },
  automation: { priority: PRIORITY.INFO, ms: CARD_MS, maxMs: CARD_MS + 1000 },
  tutorial: { priority: PRIORITY.TUTORIAL, ms: TUTORIAL_MAX_MS, maxMs: TUTORIAL_MAX_MS },
};

/** The announce() options for one menu moment (id may carry a suffix, e.g. `tutorial:fuse`). */
export function momentOpts(kind, id = kind) {
  const m = MENU_MOMENTS[kind];
  if (!m) throw new Error(`unknown menu moment: ${kind}`);
  return { id, priority: m.priority, maxMs: m.maxMs, interruptible: !!m.interruptible };
}

/**
 * The order the queue plays a set of moment kinds announced in this order: priority first, then FIFO. The
 * menu announces the wall BEFORE the tier-up (Homepage effect order), so on LV100 (both due) the wall
 * re-forms first and the new frame is named after it — what the old `wallWait()+1850` guessed at.
 * @param {string[]} kinds in announce order
 * @returns {string[]}
 */
export function playOrder(kinds) {
  return kinds
    .map((k, n) => ({ k, n, p: MENU_MOMENTS[k].priority }))
    .sort((a, b) => b.p - a.p || a.n - b.n)
    .map((x) => x.k);
}
