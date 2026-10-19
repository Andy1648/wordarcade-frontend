// patchNotesData.js — THE PATCH NOTES (Andy oct11): what the popup says, as data. One release at a time: bump
// PATCH_ID and the popup shows once more to every returning player. Every number here is what actually pays
// (DUPE_GEMS, the per-gear substats, JACKPOT's gemsPct — markRollsCore.js); the gift (PATCH_GIFT_ROLLS × the live roll price) is credited by grantGems on COLLECT.
export { PATCH_ID } from './patchSeen.js';
export const PATCH_LABEL = 'REBIRTH ROAD';
/** The gift, in ROLLS: the gems are rolls × the live roll price (ROLL_PRICE_GEMS is swapped to 75 in season 2), so
 *  the "= N FREE ROLLS" line is always exactly what the gems buy. */
export const PATCH_GIFT_ROLLS = 2;
/** The showcase cards: the two tiers the GEAR OP 2 buff moved most (LEGENDARY ×3 → ×5, MYTHIC ×10 → ×15). */
export const PATCH_CARDS = [
  { id: 'mk-eclipse', tier: 'legendary', name: 'ECLIPSE' },
  { id: 'mk-kraken', tier: 'mythic', name: 'KRAKEN' },
];
/** tag: NEW | BUFF | GIFT. `num` renders big (numbers ≥ 18px), the rest is the line. Every number is what pays
 *  (v3/econ.js REBIRTH_JACKPOT / JACKPOT_GEMS / MODE_MULT / MARK_MULT, v3/unlocks.js). */
export const PATCH_ITEMS = [
  { tag: 'NEW', pre: 'JACKPOT REBIRTH EVERY 5TH:', num: '×15', post: '+150 GEMS' },
  { tag: 'NEW', pre: 'R10 · R15 · R20 UNLOCKS — OVERDRIVE ×2 · POWER −25% · DROP ×2' },
  { tag: 'BUFF', pre: 'LOCKED MODES PAY MORE — FUSE', num: '×6', post: 'CHAIN ×4' },
  { tag: 'BUFF', pre: 'GEAR: LEGENDARY ×5 · MYTHIC ×15 · SECRET', num: '×40' },
  { tag: 'NEW', pre: 'CHAINED-SHUT LOCKS + FRESH ICONS' },
];
