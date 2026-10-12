// markFlavour.js — INDEX v2 (Andy oct5): ONE flavour line per mark, shown when you tap a mark in the INDEX.
// These are the ONLY new words the INDEX adds. Each line: ONE line, ≤ 32 characters, all caps, game voice.
// Every rollable and PERMANENT mark id has one (and any retired one — none since GEAR POOL v2 retired COMMON) (markFlavour.test.js keeps it that way). Pure data.

export const FLAVOUR_MAX = 32;

export const MARK_FLAVOUR = Object.freeze({
  // oct12: the RARE / EPIC lines now fit the everyday-object names (MATCHSTICK, PIGGY BANK …), not the old themes
  // ---- RARE ----
  'mk-detonator': 'ONE STRIKE. WHOLE BOARD LIT.',
  'mk-cyclone': 'EVERY WORD GOES IN THE SLOT.',
  'mk-scholar': 'SHARPEST THING IN THE ROOM.',
  'mk-ouroboros': 'REMEMBERS THE WORD FOR YOU.',
  'mk-tinder': 'TWO OF THEM. ENDLESS TYPING.',
  'mk-slipstream': 'NEVER WASHED. NEVER LOST.',
  'mk-smith': 'FIRST WORD AFTER FIRST SIP.',
  'mk-phoenix': 'PINS THE WIN DOWN.',
  'mk-metronome': 'TICK. TOCK. TYPE.',
  'mk-hotwire': 'FIRST OFF THE LINE.',
  'mk-grapple': 'HOLDS THE STREAK TOGETHER.',
  'mk-sparkplug': 'SMALL STICK. BIG FILE.',
  // ---- EPIC ----
  'mk-pyro': 'KA-CHING ON EVERY WORD.',
  'mk-nova': 'LOUDEST THING IN THE LOBBY.',
  'mk-golem': 'BLOW ON IT. IT WORKS.',
  'mk-brainstorm': 'BUZZ FIRST. ASK LATER.',
  'mk-flashpoint': 'THE SECOND IT ALL CATCHES.',
  'mk-voltage': 'EVERY CRIT HITS LIKE A SURGE.',
  'mk-talisman': 'SIGNS POINT TO YES.',
  // ---- LEGENDARY ----
  'mk-leviathan': 'SURFACES WHEN IT WANTS TO.',
  'mk-eclipse': 'BLOTS OUT EVERY OTHER SCORE.',
  'mk-headmaster': 'GRADES ON A CURVE. YOURS.',
  'mk-thunderclap': 'YOU HEAR THE CRIT FIRST.',
  'mk-jackpot': 'RIGGED. IN YOUR FAVOUR.',
  // ---- MYTHIC ----
  'mk-singularity': 'ALL WORDS FALL TOWARD IT.',
  'mk-kraken': 'PULLS THE ALPHABET UNDER.',
  'mk-hydra': 'CUT ONE FUSE. TWO MORE LIGHT.',
  // ---- SECRET ----
  'mk-origin': 'BEFORE THE FIRST WORD, THIS.',
  // ---- PERMANENT ----
  'mk-ironhand': 'NEVER DROPS A KEY.',
  'mk-marathon': 'STILL TYPING AT MILE FIFTY.',
  'mk-blaze': 'FINGERS FASTER THAN THOUGHT.',
  'mk-curator': 'FILES EVERY WORD BY HAND.',
  'mk-legend': 'THEY TELL STORIES ABOUT YOU.',
  'mk-ritual': 'SAME TIME. EVERY DAY.',
  'mk-linguist': 'SPEAKS FLUENT DICTIONARY.',
  'mk-eternal': 'NEVER LOGGED OFF. NOT ONCE.',
  'mk-grandmaster': 'THE BOARD BOWS FIRST.',
  'mk-omega': 'THE LAST MARK. THE WHOLE SET.',
});

/** The flavour line for a mark id ('' for an unknown id). */
export function flavourOf(id) {
  return Object.prototype.hasOwnProperty.call(MARK_FLAVOUR, id) ? MARK_FLAVOUR[id] : '';
}
