// forge.js — LETTER FORGE: the shop's repeatable, UNCAPPED boost (Andy oct2: "NO CAPS that turn
// into dead ends. Replace the shop 'marks' (Momentum, caps at 200, no gameplay) with an uncapped
// boost that has a visible effect.").
//
// Each buy FORGES one letter one level — always the lowest-level letter, most common first
// (E, T, A, O, …), so the first 26 buys light the whole alphabet and the next 26 take it to level 2,
// forever. A word pays +FORGE_PCT per forged level of EVERY letter it contains (a letter typed twice
// counts twice), so:
//   * it is GAMEPLAY, not a hidden number: words made of your forged letters pay more, and
//   * it says LONGER WORDS = MORE in a second way — more letters, more forge.
// The effect is VISIBLE: the receipt names it as its own row (FORGE ×1.35 on that word), the shop
// and the menu rail draw the 26 letters at their levels.
//
// PRICE is denominated in WORDS, like KEY POWER (xp.js keyTierCostAt): FORGE_PRICE_WORDS reference
// words at the player's current rate, growing linearly with the buys made — always "a few minutes of
// play" away, never a wall, never pocket change. No cap anywhere.
//
// MIGRATION: MOMENTUM's buys carry over one-for-one (forgeMigrateMomentum) — 26 forge buys on a
// 5-letter word ≈ +25%, MOMENTUM's 26 buys were +26%, so nobody's income drops; past that the forge
// keeps going where MOMENTUM stopped at 200.
//
// PURE + guarded store: blocked storage → no forge (×1), never throws.
import { keyTierXp, getKeyTier, rebirthMult, getRebirths, round10, priceRateBoost } from './xp.js';

export const FORGE_KEY = 'taw.forge';
export const FORGE_ORDER = 'etaoinshrdlcumwfgypbvkjxqz'; // English letter frequency, most common first
export const FORGE_PCT = 0.05; // +5% per forged level of each letter in the word
export const FORGE_PRICE_WORDS = 12; // the first forge costs ~12 reference words at your rate
export const FORGE_PRICE_SOFT = 40; // price in words grows linearly: ×2 at buy 40, ×6 at buy 200
const REF_LETTERS = 5; // = wins.js WORD_LEN_REF

function load() {
  try {
    const raw = localStorage.getItem(FORGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    const out = {};
    for (const ch of FORGE_ORDER) {
      const v = Number(o && o[ch]);
      if (Number.isFinite(v) && v > 0) out[ch] = Math.floor(v);
    }
    return out;
  } catch {
    return {};
  }
}
function save(levels) {
  try {
    localStorage.setItem(FORGE_KEY, JSON.stringify(levels));
    return true;
  } catch {
    return false;
  }
}

/** { letter: level } for every forged letter (unforged letters are absent = 0). */
export function forgeLevels() {
  return load();
}
/** Total forge buys made (= the sum of all letter levels). */
export function forgeBuys(levels = load()) {
  let n = 0;
  for (const ch of FORGE_ORDER) n += levels[ch] || 0;
  return n;
}
/** The letter the NEXT buy forges: the lowest level, most common first. */
export function nextForgeLetter(levels = load()) {
  let best = FORGE_ORDER[0];
  let bestLv = Infinity;
  for (const ch of FORGE_ORDER) {
    const lv = levels[ch] || 0;
    if (lv < bestLv) {
      best = ch;
      bestLv = lv;
    }
  }
  return best;
}

/** The wins multiplier a WORD gets from the forge: 1 + FORGE_PCT × Σ level(letter) over its letters. */
export function forgeMultForWord(word, levels) {
  if (!word || typeof word !== 'string') return 1;
  const lv = levels || load();
  let sum = 0;
  for (const raw of word.toLowerCase()) sum += lv[raw] || 0;
  return 1 + FORGE_PCT * sum;
}

/** The forge's boost on an AVERAGE reference word after `buys` buys (5 letters at the mean level). */
export function forgeAvgMult(buys) {
  const n = Number.isFinite(buys) && buys > 0 ? buys : 0;
  return 1 + FORGE_PCT * REF_LETTERS * (n / 26);
}

/**
 * Wins price of the next forge, standing at `buys` buys: FORGE_PRICE_WORDS × (1 + n/SOFT) reference
 * words at your rate — and that rate INCLUDES what the forge itself already pays (forgeAvgMult). A
 * price in un-forged words got relatively cheaper with every buy and the forge ran away (econ-sim:
 * 700k buys in 200 h). Priced in forged words, each buy is a fixed few minutes of play.
 */
export function forgeCost(buys = forgeBuys(), { keyTier, rebirthCount } = {}) {
  const n = Number.isFinite(buys) && buys > 0 ? Math.floor(buys) : 0;
  const kt = Number.isFinite(keyTier) ? keyTier : getKeyTier();
  const rc = Number.isFinite(rebirthCount) ? rebirthCount : getRebirths();
  const words = FORGE_PRICE_WORDS * (1 + n / FORGE_PRICE_SOFT);
  const refWins = (keyTierXp(kt) * REF_LETTERS) / 10;
  // priceRateBoost() already carries the CURRENT forge average; re-base it to the buy being priced.
  const boost = (priceRateBoost() / forgeAvgMult(forgeBuys())) * forgeAvgMult(n);
  return Math.max(10, round10(words * refWins * rebirthMult(rc) * boost));
}

/** Forge the next letter (no payment — shop.js charges). Returns { letter, level }. */
export function forgeOne() {
  const levels = load();
  const ch = nextForgeLetter(levels);
  levels[ch] = (levels[ch] || 0) + 1;
  save(levels);
  return { letter: ch, level: levels[ch] };
}

/** Apply `n` forge buys without charging (migration / tests). */
export function forgeMany(n) {
  const levels = load();
  for (let i = 0; i < n; i++) {
    const ch = nextForgeLetter(levels);
    levels[ch] = (levels[ch] || 0) + 1;
  }
  save(levels);
  return levels;
}

// MOMENTUM → FORGE, once. Every momentum buy becomes one forge buy; the old key is removed so the
// old global multiplier can never stack with the new one.
export const FORGE_MIGRATED_KEY = 'taw.forgeFromMomentum';
export function forgeMigrateMomentum() {
  try {
    if (localStorage.getItem(FORGE_MIGRATED_KEY)) return 0;
    const n = Math.max(0, Math.floor(Number(localStorage.getItem('taw.momentum')) || 0));
    if (n > 0) forgeMany(n);
    localStorage.removeItem('taw.momentum');
    localStorage.setItem(FORGE_MIGRATED_KEY, String(n));
    return n;
  } catch {
    return 0;
  }
}

// One-shot "a letter was just forged" flag for the menu rail's pop (same pattern as the old
// momentum pop): set by the shop on a buy, consumed once by the rail on the next menu mount.
let pendingPop = null;
export function markForgePop(letter) {
  pendingPop = letter;
}
export function consumeForgePop() {
  const p = pendingPop;
  pendingPop = null;
  return p;
}
