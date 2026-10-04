// markPerks.js — the PERKS of the top rolled marks (Andy, PROGRESSION FINAL "MARKS via ROLLS": LEGENDARY ×3 + perk,
// MYTHIC ×10 + perk, SECRET ×25 + game-changing perk). A LEAF module: no imports, so frenzy.js, overdrive.js,
// payout.js, letterXp.js and wins.js can all ask "is this perk on?" without an import cycle (marks.js → claims.js
// → wins.js → markRollsCore.js is already a cycle; nothing here may join it).
//
// A perk is ON while the save OWNS (≥1 copy of) a mark that carries it — the MAIN slot is for the multiplier; the
// perk is the collection's permanent unlock (Blox Fruits' "awakening" is yours once earned). Read straight from the
// roll store (taw.markRolls), cached on the raw string, guarded: blocked/corrupt storage → every perk off.
export const MARK_ROLLS_STORE_KEY = 'taw.markRolls'; // = markRollsCore ROLL_STATE_KEY (kept in sync by a test)

export const PERKS = {
  letters2: { name: 'DOUBLE LETTERS', line: 'LETTERS COUNT ×2' },
  winner2: { name: 'CHAMPION', line: 'WINNER BONUS ×2' },
  doubleRoll: { name: 'DOUBLE ROLLS', line: 'EVERY ROLL ROLLS TWICE' },
  overdrive15: { name: 'OVERCLOCK', line: 'OVERDRIVE EVERY 15 MIN' },
  frenzyAll: { name: 'WILDFIRE', line: 'FRENZY IN EVERY MODE' },
  keyKeep3: { name: 'HEIRLOOM', line: 'REBIRTH KEEPS 3 KEY TIERS' },
};

/** Which rolled mark carries which perk(s). markRollsCore attaches these to the pool. */
export const MARK_PERKS = {
  'mk-leviathan': ['letters2'], // LEGENDARY
  'mk-eclipse': ['winner2'], // LEGENDARY
  'mk-singularity': ['doubleRoll'], // MYTHIC
  'mk-kraken': ['overdrive15'], // MYTHIC
  'mk-origin': ['frenzyAll', 'keyKeep3'], // SECRET — the game-changers
};

export const LETTERS_PERK_MULT = 2;
export const WINNER_PERK_MULT = 2;
export const OVERDRIVE_PERK_MIN = 15;
export const KEY_KEEP_TIERS = 3;

let cacheRaw;
let cacheOn = new Set();
/** The set of perk ids this save has on right now. */
export function activePerks() {
  let raw = null;
  try {
    raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MARK_ROLLS_STORE_KEY) : null;
  } catch {
    raw = null;
  }
  if (raw === cacheRaw) return cacheOn;
  const on = new Set();
  try {
    const s = raw ? JSON.parse(raw) : null;
    const marks = s && typeof s === 'object' && s.marks && typeof s.marks === 'object' ? s.marks : {};
    for (const [id, perks] of Object.entries(MARK_PERKS)) {
      const v = marks[id];
      const n = Number(v && typeof v === 'object' ? v.n : v);
      if (Number.isFinite(n) && n >= 1) for (const p of perks) on.add(p);
    }
  } catch {
    /* corrupt store — no perks */
  }
  cacheRaw = raw;
  cacheOn = on;
  return on;
}
export function hasMarkPerk(perk) {
  return activePerks().has(perk);
}

/** ×2 XP per letter (LEVIATHAN). */
export function letterPerkMult() {
  return hasMarkPerk('letters2') ? LETTERS_PERK_MULT : 1;
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
/** OVERDRIVE every 15 minutes of play (KRAKEN), or null for the default window. */
export function overdrivePerkMinutes() {
  return hasMarkPerk('overdrive15') ? OVERDRIVE_PERK_MIN : null;
}
