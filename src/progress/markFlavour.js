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
  'mk-monsoon': "IT DOESN'T RAIN. IT SPELLS.",
  'mk-inferno': 'LIGHTS EVERY FUSE IT SEES.',
  'mk-mainframe': 'RUNNING HOT. RUNNING FASTER.',
  'mk-shamrock': 'THREE LEAVES. ALL THE LUCK.',
  // ---- MYTHIC ----
  'mk-singularity': 'ALL WORDS FALL TOWARD IT.',
  'mk-kraken': 'PULLS THE ALPHABET UNDER.',
  'mk-hydra': 'CUT ONE FUSE. TWO MORE LIGHT.',
  'mk-chronos': 'TIME BENDS. WORDS DRIP.',
  // ---- GEAR EXPANSION (oct21) ----
  'mk-highlighter': 'MARKS THE ANSWER BEFORE YOU DO.',
  'mk-flashcards': 'FRONT: WORD. BACK: WINS.',
  'mk-firecracker': 'SHORT FUSE. LOUD FINISH.',
  'mk-gumball': 'ONE COIN. ALL GEMS.',
  'mk-lavalamp': 'GLOWS BRIGHTER AFTER DARK.',
  'mk-alarmclock': 'THE EARLY WORD GETS THE XP.',
  'mk-fortune': 'YOUR NEXT WORD IS A BIG ONE.',
  'mk-hoarder': 'STEALS ONE OF EVERYTHING.',
  'mk-domino': 'ONE FALLS. THEY ALL FALL.',
  'mk-longshot': 'SEES THE LONG WORD COMING.',
  'mk-hothand': 'NEVER MISSES. NEVER COOLS.',
  'mk-arcadestick': 'INSERT WORD. CONTINUE.',
  'mk-firebird': 'EVERY END IS A HEAD START.',
  'mk-trident': 'THREE PRONGS. THREE TIMES.',
  'mk-paradox': 'TWO GEARS. ONE SOUL.',
  // ---- SECRET ----
  'mk-origin': 'BEFORE THE FIRST WORD, THIS.',
  // ---- PERMANENT ----
  'mk-ironhand': 'NEVER DROPS A KEY.',
  'mk-marathon': 'STILL TYPING AT MILE FIFTY.',
  'mk-blaze': 'FINGERS FASTER THAN THOUGHT.',
  'mk-curator': 'FILES EVERY WORD BY HAND.',
  'mk-legend': 'THEY TELL STORIES ABOUT YOU.',
  'mk-ritual': 'SAME TIME. EVERY DAY.',
  'mk-linguist': 'THE HOUSE ALWAYS LOSES.',
  'mk-eternal': 'NEVER LOGGED OFF. NOT ONCE.',
  'mk-grandmaster': 'THE BOARD BOWS FIRST.',
  'mk-omega': 'THE LAST MARK. THE WHOLE SET.',
});

/** The flavour line for a mark id ('' for an unknown id). */
export function flavourOf(id) {
  return Object.prototype.hasOwnProperty.call(MARK_FLAVOUR, id) ? MARK_FLAVOUR[id] : '';
}
