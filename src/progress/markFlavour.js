// markFlavour.js — INDEX v2 (Andy oct5): ONE flavour line per mark, shown when you tap a mark in the INDEX.
// These are the ONLY new words the INDEX adds. Each line: ONE line, ≤ 32 characters, all caps, game voice.
// Every rollable, PERMANENT and retired mark id has one (markFlavour.test.js keeps it that way). Pure data.

export const FLAVOUR_MAX = 32;

export const MARK_FLAVOUR = Object.freeze({
  // ---- COMMON ----
  'mk-bomber': 'LIT FUSE, STEADY HANDS.',
  'mk-sparky': 'EVERY KEY THROWS A SPARK.',
  'mk-sprinter': 'FIRST OFF THE LINE. ALWAYS.',
  'mk-dasher': 'BLINK AND THE WORD IS GONE.',
  'mk-crammer': 'SLEEPS ON A DICTIONARY.',
  'mk-inkwell': 'DIP DEEP. WRITE LUCKY.',
  'mk-linker': 'ONE WORD HANDS OFF TO THE NEXT.',
  'mk-shackle': 'NO CHAIN BREAKS ON ITS WATCH.',
  'mk-wick': 'SHORT WICK. LONG GAME.',
  'mk-matchstick': 'STRIKE ONCE. HOPE TWICE.',
  'mk-pacer': 'KEEPS TIME WITH THE KEYS.',
  'mk-nitro': 'HOLD ON TO SOMETHING.',
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
  // ---- EPIC ----
  'mk-pyro': 'SET THE BOARD ON FIRE.',
  'mk-nova': 'BRIGHTEST THING IN THE LOBBY.',
  'mk-golem': 'MADE OF EVERY WORD YOU TYPED.',
  // ---- LEGENDARY ----
  'mk-leviathan': 'SURFACES WHEN IT WANTS TO.',
  'mk-eclipse': 'BLOTS OUT EVERY OTHER SCORE.',
  // ---- MYTHIC ----
  'mk-singularity': 'ALL WORDS FALL TOWARD IT.',
  'mk-kraken': 'PULLS THE ALPHABET UNDER.',
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
  // ---- RETIRED (still owned by early players) ----
  'mk-student': 'TOOK NOTES ON DAY ONE.',
  'mk-magpie': 'COLLECTS SHINY WORDS.',
  'mk-veteran': 'WAS HERE BEFORE THE ROLLS.',
});

/** The flavour line for a mark id ('' for an unknown id). */
export function flavourOf(id) {
  return Object.prototype.hasOwnProperty.call(MARK_FLAVOUR, id) ? MARK_FLAVOUR[id] : '';
}
