// markFlavour.js — INDEX v2 (Andy oct5): ONE flavour line per mark, shown when you tap a mark in the INDEX.
// These are the ONLY new words the INDEX adds. Each line: ONE line, ≤ 32 characters, all caps, game voice.
// Every rollable and PERMANENT mark id has one (and any retired one — none since GEAR POOL v2 retired COMMON) (markFlavour.test.js keeps it that way). Pure data.

export const FLAVOUR_MAX = 32;

export const MARK_FLAVOUR = Object.freeze({
  // ---- RARE ----
  'mk-detonator': 'THE BOMB WAITS FOR NOBODY.',
  'mk-cyclone': 'SPINS A CATEGORY INTO DUST.',
  'mk-scholar': 'KNEW THE WORD BEFORE THE CLUE.',
  'mk-ouroboros': 'THE LAST LETTER EATS THE FIRST.',
  'mk-tinder': 'ONE SPARK, WHOLE FOREST.',
  'mk-slipstream': 'RIDE THE DRAFT, STEAL THE WIN.',
  'mk-smith': 'HAMMERS WORDS INTO SHAPE.',
  'mk-phoenix': 'BURNED OUT. CAME BACK LOUDER.',
  'mk-metronome': 'TICK. TOCK. TYPE.',
  'mk-hotwire': 'STARTS ANY RACE WITHOUT A KEY.',
  'mk-grapple': 'HOOKS THE LAST LETTER. PULLS.',
  'mk-sparkplug': 'SMALL PART. BIG BANG.',
  // ---- EPIC ----
  'mk-pyro': 'SET THE BOARD ON FIRE.',
  'mk-nova': 'BRIGHTEST THING IN THE LOBBY.',
  'mk-golem': 'MADE OF EVERY WORD YOU TYPED.',
  'mk-brainstorm': 'TEN ANSWERS BEFORE THE BUZZER.',
  'mk-flashpoint': 'THE SECOND IT ALL CATCHES.',
  'mk-voltage': 'EVERY CRIT HITS LIKE A SURGE.',
  'mk-talisman': 'CARRIED FOR LUCK. IT WORKS.',
  // ---- LEGENDARY ----
  'mk-leviathan': 'SURFACES WHEN IT WANTS TO.',
  'mk-eclipse': 'BLOTS OUT EVERY OTHER SCORE.',
  'mk-headmaster': 'GRADES ON A CURVE. YOURS.',
  'mk-thunderclap': 'YOU HEAR THE CRIT FIRST.',
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
