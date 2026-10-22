// markPerks.js — the PERKS of the top rolled marks (Andy, PROGRESSION FINAL "MARKS via ROLLS": LEGENDARY ×3 + perk,
// MYTHIC ×10 + perk, SECRET ×25 + game-changing perk). A LEAF module: no imports, so frenzy.js, overdrive.js,
// payout.js, letterXp.js and wins.js can all ask "is this perk on?" without an import cycle (marks.js → claims.js
// → wins.js → markRollsCore.js is already a cycle; nothing here may join it).
//
// A perk is ON while the mark that carries it is WORN as the MAIN (Andy: one MAIN equipped, its perk with it) and
// the save still OWNS (≥1 copy of) it. Owning a perk mark in the collection is not enough — swapping MAINs swaps
// perks. Read straight from the roll store (taw.markRolls) + the worn id (taw.mark), cached on both raw strings,
// guarded: blocked/corrupt storage → every perk off.
export const MARK_ROLLS_STORE_KEY = 'taw.markRolls'; // = markRollsCore ROLL_STATE_KEY (kept in sync by a test)
export const MARK_WORN_KEY = 'taw.mark'; // = marks.js MARKS_EQUIPPED_KEY (a leaf: no import; kept in sync by a test)

export const PERKS = {
  letters2: { name: 'DOUBLE LETTERS', line: 'LETTERS COUNT ×2' },
  winner2: { name: 'CHAMPION', line: 'WINNER BONUS ×2' },
  doubleRoll: { name: 'DOUBLE ROLLS', line: 'EVERY ROLL ROLLS TWICE' },
  overdrive15: { name: 'OVERCLOCK', line: 'OVERDRIVE EVERY 15 MIN' },
  frenzyAll: { name: 'WILDFIRE', line: 'FRENZY IN EVERY MODE' },
  keyKeep3: { name: 'HEIRLOOM', line: 'REBIRTH KEEPS 3 POWER TIERS' },
  // GEAR POOL v2 (Andy oct9)
  freeOd: { name: 'FREE OVERDRIVE', line: 'FREE 60s OVERDRIVE EVERY 15 MIN' }, // every MYTHIC+ gear (agreed with Andy)
  odLong: { name: 'AFTERBURN', line: 'OVERDRIVE LASTS ×2' },
  critKey10: { name: 'DRUMROLL', line: 'EVERY 10TH KEY CRITS' },
  dropTwice: { name: 'LUCKY DROP', line: 'TWO CHANCES AT EVERY GEM DROP' }, // JACKPOT (gear card v4)
  // GEAR EXPANSION (Andy oct21 "more really cool gear"): perks that change WHEN or HOW a gear pays, never a bigger
  // flat number. EPIC gears carry one too now (a perk every ~10 rolls of pity).
  nightOwl: { name: 'NIGHT OWL', line: '×2 WINS FROM 10 PM TO 6 AM' }, // LAVA LAMP (EPIC)
  earlyBird: { name: 'EARLY BIRD', line: '×2 XP FROM 6 AM TO 10 AM' }, // ALARM CLOCK (EPIC)
  fortune: { name: 'FORTUNE', line: '1 IN 25 WORDS PAYS ×10' }, // FORTUNE COOKIE (EPIC)
  hoard: { name: 'HOARD', line: 'INDEX BONUS ×3' }, // MAGPIE (EPIC)
  combo: { name: 'COMBO', line: 'A CRIT KEY MAKES THE NEXT 2 CRIT' }, // DOMINO (EPIC)
  bigWords: { name: 'BIG WORDS', line: '10+ LETTER WORDS PAY ×3' }, // LONGSHOT (LEGENDARY)
  afterparty: { name: 'AFTERPARTY', line: 'EVERY REBIRTH STARTS A 5 MIN OVERDRIVE' }, // FIREBIRD (MYTHIC)
  tripleThreat: { name: 'TRIPLE THREAT', line: 'EVERY 3RD WORD OF A GAME PAYS ×3' }, // TRIDENT (MYTHIC)
  twinSouls: { name: 'TWIN SOULS', line: "YOUR 2ND GEAR'S PERKS ARE ON TOO" }, // PARADOX (SECRET)
};

// GEAR POOL v2 (Andy oct9): the 12 rolled COMMON gears that were removed, and the three marks.js-only COMMONS (the
// retired ALL-MODE marks) that went with them — owned copies are refunded (markRollsCore.migrateRollSave) and they no
// longer count anywhere (v3/achievements FILL INDEX). Here because this module is a LEAF.
export const REMOVED_COMMON_IDS = Object.freeze([
  'mk-bomber', 'mk-sparky', 'mk-sprinter', 'mk-dasher', 'mk-crammer', 'mk-inkwell', 'mk-linker', 'mk-shackle', 'mk-wick',
  'mk-matchstick', 'mk-pacer', 'mk-nitro',
]);
export const RETIRED_COMMON_IDS = Object.freeze(['mk-student', 'mk-magpie', 'mk-veteran']);

/** Which rolled mark carries which perk(s). markRollsCore attaches these to the pool. */
export const MARK_PERKS = {
  'mk-leviathan': ['letters2'], // LEGENDARY
  'mk-eclipse': ['winner2'], // LEGENDARY
  'mk-headmaster': ['odLong'], // LEGENDARY (GEAR POOL v2)
  'mk-thunderclap': ['critKey10'], // LEGENDARY (GEAR POOL v2)
  'mk-jackpot': ['dropTwice'], // LEGENDARY (gear card v4)
  // oct18: the four new LEGENDARIES and CHRONOS reuse the existing perks that fit their theme (a perk is on/off, so
  // wearing two gears with the same perk never stacks it)
  'mk-monsoon': ['winner2'], // LEGENDARY — CHAMPION (Blitz is won on the winner bonus)
  'mk-inferno': ['odLong'], // LEGENDARY — AFTERBURN
  'mk-mainframe': ['critKey10'], // LEGENDARY — DRUMROLL
  'mk-shamrock': ['dropTwice'], // LEGENDARY — LUCKY DROP
  'mk-singularity': ['doubleRoll', 'freeOd'], // MYTHIC
  'mk-kraken': ['overdrive15', 'freeOd'], // MYTHIC
  'mk-hydra': ['freeOd'], // MYTHIC (GEAR POOL v2)
  'mk-chronos': ['overdrive15', 'freeOd'], // MYTHIC (oct18) — OVERCLOCK + FREE OVERDRIVE
  'mk-origin': ['frenzyAll', 'keyKeep3', 'freeOd'], // SECRET — the game-changers
  // GEAR EXPANSION (oct21): the five EPIC perks, the three new LEGENDARIES (each on a NEW main stat — longWinsPct /
  // streakWinsPct / gameXpPct — so two reuse the perk that fits), two MYTHICS and the second SECRET
  'mk-lavalamp': ['nightOwl'],
  'mk-alarmclock': ['earlyBird'],
  'mk-fortune': ['fortune'],
  'mk-hoarder': ['hoard'],
  'mk-domino': ['combo'],
  'mk-longshot': ['bigWords'],
  'mk-hothand': ['winner2'], // CHAMPION — the win-streak gear wins bigger
  'mk-arcadestick': ['critKey10'], // DRUMROLL — button-mash rhythm
  'mk-firebird': ['afterparty', 'freeOd'],
  'mk-trident': ['tripleThreat', 'freeOd'],
  'mk-paradox': ['twinSouls', 'freeOd'],
};

export const LETTERS_PERK_MULT = 2;
export const WINNER_PERK_MULT = 2;
export const OVERDRIVE_PERK_MIN = 15;
export const KEY_KEEP_TIERS = 3;
// FREE OVERDRIVE (every MYTHIC+ gear, Andy-agreed): ×10 for FREE_OD_SEC seconds after every FREE_OD_EVERY_MIN minutes
// of PLAY while worn (overdrive.js — the same play clock and the same ×10 OVERDRIVE as the random one).
export const FREE_OD_SEC = 60;
export const FREE_OD_EVERY_MIN = 15;
export const OD_LONG_MULT = 2; // AFTERBURN (HEADMASTER): an OVERDRIVE runs twice as long
export const CRIT_PERK_EVERY = 10; // DRUMROLL (THUNDERCLAP): every 10th MENU key is a guaranteed crit
// GEAR EXPANSION (oct21)
export const NIGHT_OWL_HOURS = [22, 6]; // local clock, [from, to) — wraps midnight
export const EARLY_BIRD_HOURS = [6, 10];
export const CLOCK_PERK_MULT = 2;
export const FORTUNE_ONE_IN = 25;
export const FORTUNE_MULT = 10;
export const HOARD_MULT = 3;
export const COMBO_KEYS = 2;
export const BIG_WORDS_LETTERS = 10;
export const BIG_WORDS_MULT = 3;
export const AFTERPARTY_MIN = 5;
export const TRIPLE_EVERY = 3;
export const TRIPLE_MULT = 3;
export const MARK2_STORE_KEY = 'taw.s2.mark2'; // = v3/store.js MARK2_KEY (the R5 2nd slot; a test keeps them equal)

let cacheRaw;
let cacheWorn;
let cacheWorn2;
let cacheOn = new Set();
/** The set of perk ids this save has on right now: the WORN MAIN's perks, if the save owns that mark. */
export function activePerks() {
  let raw = null;
  let worn = null;
  let worn2 = null;
  try {
    raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MARK_ROLLS_STORE_KEY) : null;
    worn = typeof localStorage !== 'undefined' ? localStorage.getItem(MARK_WORN_KEY) : null;
    worn2 = typeof localStorage !== 'undefined' ? localStorage.getItem(MARK2_STORE_KEY) : null;
  } catch {
    raw = null;
    worn = null;
    worn2 = null;
  }
  if (raw === cacheRaw && worn === cacheWorn && worn2 === cacheWorn2) return cacheOn;
  const on = new Set();
  try {
    const s = raw ? JSON.parse(raw) : null;
    const marks = s && typeof s === 'object' && s.marks && typeof s.marks === 'object' ? s.marks : {};
    const owned = (id) => {
      const v = marks[id];
      const n = Number(v && typeof v === 'object' ? v.n : v);
      return Number.isFinite(n) && n >= 1;
    };
    const perksOf = (id) => (id && Object.prototype.hasOwnProperty.call(MARK_PERKS, id) && owned(id) ? MARK_PERKS[id] : []);
    for (const p of perksOf(worn)) on.add(p);
    // TWIN SOULS (PARADOX): the 2nd slot's perks run too (its stats already pay through the 2nd slot)
    if (on.has('twinSouls') && worn2 && worn2 !== worn) for (const p of perksOf(worn2)) on.add(p);
  } catch {
    /* corrupt store — no perks */
  }
  cacheRaw = raw;
  cacheWorn = worn;
  cacheWorn2 = worn2;
  cacheOn = on;
  return on;
}
export function hasMarkPerk(perk) {
  return activePerks().has(perk);
}

/** ×2 XP per letter (LEVIATHAN) × EARLY BIRD (ALARM CLOCK: ×2 from 6 to 10 AM). */
export function letterPerkMult() {
  return (hasMarkPerk('letters2') ? LETTERS_PERK_MULT : 1) * earlyBirdMult();
}
/** ×2 on the winner's bonus part (ECLIPSE). */
export function winnerPerkMult() {
  return hasMarkPerk('winner2') ? WINNER_PERK_MULT : 1;
}
/** Results per paid roll (SINGULARITY: 2). */
export function rollsPerRoll() {
  return hasMarkPerk('doubleRoll') ? 2 : 1;
}
/** FRENZY pays in every mode, not only FUSE (ORIGIN). */
export function frenzyEveryMode() {
  return hasMarkPerk('frenzyAll');
}
/** KEY tiers a rebirth keeps (ORIGIN: 3; otherwise 0 — the Rebirth Rush reset). */
export function rebirthKeyKeep() {
  return hasMarkPerk('keyKeep3') ? KEY_KEEP_TIERS : 0;
}
/** FREE OVERDRIVE (MYTHIC+): true while the worn MAIN carries it. */
export function freeOverdriveOn() {
  return hasMarkPerk('freeOd');
}
/** How much longer an OVERDRIVE runs (AFTERBURN ×2, else ×1). */
export function overdriveLengthMult() {
  return hasMarkPerk('odLong') ? OD_LONG_MULT : 1;
}
/** OVERDRIVE every 15 minutes of play (KRAKEN), or null for the default window. */
export function overdrivePerkMinutes() {
  return hasMarkPerk('overdrive15') ? OVERDRIVE_PERK_MIN : null;
}

// ---- GEAR EXPANSION (oct21) -------------------------------------------------------------------------------------------
const hourOf = (now) => new Date(Number.isFinite(now) ? now : Date.now()).getHours();
const inHours = (h, [a, b]) => (a <= b ? h >= a && h < b : h >= a || h < b);
/** ×2 XP while the EARLY BIRD window runs (ALARM CLOCK), else 1. */
export function earlyBirdMult(now) {
  return hasMarkPerk('earlyBird') && inHours(hourOf(now), EARLY_BIRD_HOURS) ? CLOCK_PERK_MULT : 1;
}
/** ×2 WINS while the NIGHT OWL window runs (LAVA LAMP), else 1. */
export function nightOwlMult(now) {
  return hasMarkPerk('nightOwl') && inHours(hourOf(now), NIGHT_OWL_HOURS) ? CLOCK_PERK_MULT : 1;
}
/** The INDEX bonus multiplier (MAGPIE's HOARD ×3, else 1). */
export function hoardMult() {
  return hasMarkPerk('hoard') ? HOARD_MULT : 1;
}
/** Keys a crit drags along (DOMINO's COMBO: 2, else 0). */
export function comboKeys() {
  return hasMarkPerk('combo') ? COMBO_KEYS : 0;
}
/**
 * The per-word perk multiplier on ONE banking call that releases `released` words, the last of which is the game's
 * `nowWords`-th (the gate-crossing call releases words 1…nowWords at once, so "every 3rd word" / "1 in 25 words" count
 * each released word, never the batch as one). BIG WORDS reads this word's length (the batch is valued at it, like
 * every per-word factor). PURE given `perks` + `rng` + `now`. ≥ 1.
 */
export function wordPerkMult({ released = 1, nowWords = 1, wordLength = 0, now, rng = Math.random, perks } = {}) {
  const on = perks || activePerks();
  if (!on.size) return 1;
  const r = Number.isFinite(released) && released >= 1 ? Math.floor(released) : 1;
  const last = Number.isFinite(nowWords) && nowWords >= r ? Math.floor(nowWords) : r;
  let m = 1;
  if (on.has('tripleThreat')) {
    let hits = 0;
    for (let i = last - r + 1; i <= last; i++) if (i % TRIPLE_EVERY === 0) hits += 1;
    m *= (r + (TRIPLE_MULT - 1) * hits) / r;
  }
  if (on.has('fortune')) {
    let hits = 0;
    for (let i = 0; i < r; i++) if (rng() < 1 / FORTUNE_ONE_IN) hits += 1;
    m *= (r + (FORTUNE_MULT - 1) * hits) / r;
  }
  if (on.has('bigWords') && Number.isFinite(wordLength) && wordLength >= BIG_WORDS_LETTERS) m *= BIG_WORDS_MULT;
  if (on.has('nightOwl') && inHours(hourOf(now), NIGHT_OWL_HOURS)) m *= CLOCK_PERK_MULT;
  return m;
}
// AFTERPARTY (FIREBIRD): every rebirth starts an OVERDRIVE. overdrive.js registers the starter (this LEAF imports
// nothing); both rebirth doors (stars.rebirthWithStars and its season-2 swap) call noteRebirthPerks.
let odStarter = null;
export function setAfterpartyStarter(fn) {
  odStarter = typeof fn === 'function' ? fn : null;
}
/** A rebirth just happened: fire the rebirth perks. true when an OVERDRIVE started. Never throws. */
export function noteRebirthPerks() {
  try {
    if (!hasMarkPerk('afterparty') || !odStarter) return false;
    return !!odStarter(AFTERPARTY_MIN * 60000);
  } catch {
    return false;
  }
}
