// patchNotesData.js — THE PATCH NOTES (Andy oct11): what the popup says, as data. One release at a time: bump
// PATCH_ID and the popup shows once more to every returning player. Every number here is what actually pays
// (DUPE_GEMS, the per-gear substats, JACKPOT's gemsPct — markRollsCore.js); the gift (PATCH_GIFT_ROLLS × the live roll price) is credited by grantGems on COLLECT.
export { PATCH_ID } from './patchSeen.js';
export const PATCH_LABEL = 'GEAR STORM';
/** The gift, in ROLLS: the gems are rolls × the live roll price (ROLL_PRICE_GEMS is swapped to 75 in season 2), so
 *  the "= N FREE ROLLS" line is always exactly what the gems buy. */
export const PATCH_GIFT_ROLLS = 2;
/** The showcase cards: the two rarest of the GEAR EXPANSION (#478) — FIREBIRD (MYTHIC) and PARADOX (SECRET). */
export const PATCH_CARDS = [
  { id: 'mk-firebird', tier: 'mythic', name: 'FIREBIRD' },
  { id: 'mk-paradox', tier: 'secret', name: 'PARADOX' },
];
/** The rest of the expansion as a strip of their painted art (public/gear/*.webp), rarest first. Only gears on main. */
export const PATCH_STRIP = [
  ['mk-trident', 'trident'], ['mk-longshot', 'longshot'], ['mk-hothand', 'hothand'], ['mk-arcadestick', 'arcadestick'],
  ['mk-lavalamp', 'lavalamp'], ['mk-alarmclock', 'alarmclock'], ['mk-fortune', 'fortunecookie'], ['mk-hoarder', 'magpie'],
  ['mk-domino', 'domino'], ['mk-highlighter', 'highlighter'], ['mk-flashcards', 'flashcards'], ['mk-firecracker', 'firecracker'],
  ['mk-gumball', 'gumball'],
].map(([id, art]) => ({ id, src: `/gear/${art}.webp` }));
/** tag: NEW | BUFF | TWEAK | GIFT. `num` renders big (numbers ≥ 18px), the rest is the line. Every number is what pays:
 *  LEVEL CHESTS every 5th level (v3 levelChest), LEGENDARY 1 in 130 + hard pity 60 (markRollsCore, 063). */
export const PATCH_ITEMS = [
  { tag: 'NEW', pre: '15 NEW GEARS · EPICS GET PERKS' },
  { tag: 'NEW', pre: 'DAILY CONTRACTS · A CHEST EVERY 5TH LEVEL' },
  { tag: 'NEW', pre: 'HEROES IN EVERY SEAT · HOLLOW: OCTOBER ONLY' },
  { tag: 'BUFF', pre: 'GUARANTEED ROLLS · ROLL TWICE, SEE BOTH' },
  { tag: 'TWEAK', pre: 'LEGENDARY 1 IN 130 — SURE BY ROLL', num: '60' },
  { tag: 'TWEAK', pre: 'TYPEWRITER: INK CAN’T BE ERASED' },
];
