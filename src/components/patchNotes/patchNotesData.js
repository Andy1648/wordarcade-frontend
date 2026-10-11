// patchNotesData.js — THE PATCH NOTES (Andy oct11): what the popup says, as data. One release at a time: bump
// PATCH_ID and the popup shows once more to every returning player. Every number here is what actually pays
// (DUPE_GEMS, SUBSTATS_BY_TIER, JACKPOT's gemsPct — markRollsCore.js); the gift (PATCH_GIFT_ROLLS × the live roll price) is credited by grantGems on COLLECT.
export { PATCH_ID } from './patchSeen.js';
export const PATCH_LABEL = 'GEAR V4';
/** The gift, in ROLLS: the gems are rolls × the live roll price (ROLL_PRICE_GEMS is swapped to 75 in season 2), so
 *  the "= N FREE ROLLS" line is always exactly what the gems buy. */
export const PATCH_GIFT_ROLLS = 2;
/** The showcase cards (the new card art at its best). */
export const PATCH_CARDS = [
  { id: 'mk-hydra', tier: 'mythic', name: 'HYDRA' },
  { id: 'mk-origin', tier: 'secret', name: 'ORIGIN' },
];
/** tag: NEW | BUFF | GIFT. `num` renders big (numbers ≥ 18px), the rest is the line. */
export const PATCH_ITEMS = [
  { tag: 'NEW', pre: 'ALL-NEW GEAR CARDS — EVERY STAT ON THE CARD' },
  { tag: 'NEW', pre: 'JACKPOT GEAR:', num: '+200%', post: 'GEMS' },
  { tag: 'BUFF', pre: 'DUPES PAY GEMS — UP TO', num: '2,500' },
  { tag: 'BUFF', pre: 'SECRET GEAR:', num: '+80', post: 'BASE WINS SUBSTAT' },
  { tag: 'NEW', pre: 'PAINTED GEAR ART + CARDS THAT SHINE BY RARITY' },
];
