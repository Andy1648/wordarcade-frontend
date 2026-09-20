// payout.js — WHERE THE WINS CAME FROM.
//
// THE BUG THIS EXISTS TO FIX, in Andy's words: "I got 40k and couldn't tell where it came from."
// A word's payout is a product of up to nine factors — mode, difficulty, level, rebirth, momentum,
// the equipped mark, rarity (which carries a length bonus), combo and the lucky roll — and NONE of
// them were ever named on screen. The number arrived; the reasons did not. A multiplier the player
// cannot see is not a reward, it is a rumour: it cannot be aimed at, it cannot be compared against
// an upgrade's price, and a shop item that boosts it reads as a shot in the dark.
//
// This module is the single description of that product. It does NOT compute the payout — wins.js
// does, and it stays the authority — this builds the EXPLANATION of a payout that has already been
// computed, from the same factor values. `buildPayout` is given the factors and returns both the
// total and the rows to draw, so a breakdown can never quote a multiplier the payout did not use.
//
// Pure and DOM-free (one module-level round ledger, the same pattern wins.js uses for its pending
// stamp), so the whole thing is unit-testable under node.
import { round10 } from './xp.js';

// The display ORDER, and the only sanctioned labels. Fixed rather than derived from the object's
// key order so the breakdown reads the same way every time — a list that reorders itself between
// words is harder to read than no list at all.
//   PERMANENT   what you have built: mode, difficulty, rebirth, streak, bonus
//   THIS WORD   what you just did:   rarity, length, combo, lucky
export const PAYOUT_FACTORS = [
  { key: 'mode', label: 'MODE', kind: 'permanent' },
  { key: 'difficulty', label: 'DIFFICULTY', kind: 'permanent' },
  { key: 'rebirth', label: 'REBIRTH', kind: 'permanent' },
  // The daily STREAK multiplier. It always rode the XP stack; since Economy v8 folded the two
  // stacks into one it pays wins too, so it gets named here — a multiplier the player cannot see
  // is the defect this module exists to fix, and a newly-invisible one would be absurd.
  { key: 'streak', label: 'STREAK', kind: 'permanent' },
  // MOMENTUM × the equipped MARK × this mode's MASTERY, as one row. Three separate near-×1 lines
  // taught nothing and crowded out the rows that move; each is still individually earnable.
  { key: 'bonus', label: 'BONUS', kind: 'permanent' },
  { key: 'rarity', label: 'RARITY', kind: 'word' },
  { key: 'length', label: 'LENGTH', kind: 'word' },
  { key: 'combo', label: 'COMBO', kind: 'word' },
  { key: 'lucky', label: 'LUCKY', kind: 'word' },
  // The ×40 ceiling on the combined rarity×combo×lucky product (PER_WORD_MULT_CAP). It is a
  // factor BELOW 1 when it bites, and it is listed for exactly that reason: a player on a huge
  // combo who hits a rare word and sees less than the multipliers promised deserves to be told
  // why, rather than left to assume the numbers are lying.
  { key: 'cap', label: 'MULT CAP', kind: 'word' },
];
const FACTOR_BY_KEY = new Map(PAYOUT_FACTORS.map((f) => [f.key, f]));

const num = (v, dflt = 1) => (Number.isFinite(v) && v > 0 ? v : dflt);

/**
 * Explain one word's payout.
 *
 * @param {object} arg
 * @param {number} arg.base    the flat per-word base before any multiplier (wordWinsBase())
 * @param {number} [arg.letters]  the word's letter count, so the receipt can NAME the base
 * @param {number} [arg.perLetter] XP per letter at the player's key tier, ditto
 * @param {object} arg.factors { mode, difficulty, rebirth, streak, bonus, rarity,
 *                               length, combo, lucky } — each a multiplier, missing/1 = inactive
 * @param {number} [arg.total] the amount ACTUALLY banked this call, when the caller knows it.
 *                             NOTE: this is NOT what the receipt prints. See `paid` below.
 * @param {string} [arg.band]  the rarity band name (COMMON/UNCOMMON/RARE/OBSCURE), for the note
 * @returns {{ base, paid, total, computed, product, rows, band, held }}
 *
 * `paid` IS THE PRODUCT OF THE ROWS, always. This is the fix for a receipt that listed BASE 100,
 * MODE ×2, RARITY ×2.5, LENGTH ×1.16, COMBO ×1.1 and then printed PAID 0. Nothing was wrong with
 * the arithmetic: the first two words of a round bank NOTHING (the 3-word payout gate), the caller
 * passed that 0 through as the amount, and the panel dutifully printed a total that contradicted
 * every line above it. A receipt whose bottom line does not follow from its own rows is worse than
 * no receipt. So the bottom line is now what the rows say this word is WORTH, and `held` carries
 * the other fact — that the gate has not released it yet — as a caption instead of as a zero.
 */
export function buildPayout({ base = 0, factors = {}, total, band, letters, perLetter } = {}) {
  const b = Number.isFinite(base) && base > 0 ? base : 0;
  let product = 1;
  const rows = [];
  for (const f of PAYOUT_FACTORS) {
    const m = num(factors[f.key]);
    product *= m;
    // ×1 is not a contribution; listing it pads the panel with rows that mean "nothing happened".
    // The ONE exception is a factor the player has BOUGHT and is currently getting nothing from —
    // see inactivePayoutFactors(), which is what the shop card needs, not this.
    if (Math.abs(m - 1) > 1e-9) rows.push({ ...f, mult: m });
  }
  // SNAPPED ON THE XP GRID, NOT THE WINS ONE. Wins are the word's XP ÷ 10 and the XP is what
  // round10 applies to, so a receipt that snapped the WINS total to a multiple of ten would print
  // 20 for a word that paid 15. Multiply up, snap, divide back: the same arithmetic the payout
  // itself does, which is the only way the bottom line can match the ledger.
  const computed = round10(b * product * 10) / 10;
  const banked = Number.isFinite(total) ? total : computed;
  return {
    base: b,
    product,
    computed,
    paid: computed, // what the rows add up to — the number the panel prints
    // THE SAME AWARD IN XP. Wins are the word's XP ÷ 10 (Economy v8), so the receipt can print
    // both readings off one product instead of the panel multiplying by ten on its own.
    xp: Math.round(computed * 10),
    // The BASE, named rather than asserted: "5 letters × 10" instead of a bare "BASE 5". Absent
    // when the caller does not know them, and the panel falls back to the bare base.
    letters: Number.isFinite(letters) && letters > 0 ? Math.floor(letters) : null,
    perLetter: Number.isFinite(perLetter) && perLetter > 0 ? perLetter : null,
    total: banked, // what was actually banked this call (0 before the 3-word gate)
    held: banked <= 0 && computed > 0,
    rows,
    band: band || null,
  };
}

/**
 * The factors that are switched OFF for this word, with the reason — the other half of legibility.
 * "COMBO ×1" is noise; "COMBO — streak under 2" is the answer to a question the player is
 * actually asking when the number looks small.
 */
export function inactivePayoutFactors(factors = {}, { band } = {}) {
  const out = [];
  const off = (key, why) => {
    const f = FACTOR_BY_KEY.get(key);
    if (f) out.push({ ...f, why });
  };
  if (num(factors.combo) === 1) off('combo', 'streak under 2');
  if (num(factors.rarity) === 1) off('rarity', 'COMMON word');
  if (num(factors.lucky) === 1) off('lucky', 'no lucky roll');
  if (num(factors.rebirth) === 1) off('rebirth', 'no rebirths yet');
  if (num(factors.streak) === 1) off('streak', 'streak under 3 days');
  if (num(factors.bonus) === 1) off('bonus', 'no momentum, mark or mastery yet');
  return out;
}

// ---- THE ROUND LEDGER ------------------------------------------------------------------------
// The accept toast can only show one word. The question "where did 40,000 come from" is about a
// whole ROUND, so the end screen needs the same breakdown accumulated across it.
//
// ATTRIBUTION. The payout is a PRODUCT, so there is no unique "wins from combo" — every factor
// multiplies every other. Splitting the winnings above base in proportion to ln(mult) is the
// standard resolution and the only one that (a) sums to exactly the amount earned, (b) gives two
// equal multipliers equal credit, and (c) is order-independent. Stated on screen as "share", not
// as "COMBO earned you N", because the honest claim is a share of a product.
let ledger = null;

export function beginPayoutLedger(mode) {
  ledger = { mode: mode || null, words: 0, base: 0, total: 0, logs: {}, logSum: 0 };
}

/** Fold one word's payout into the round ledger. Silently ignored if no round is open. */
export function notePayout({ base = 0, factors = {}, total = 0 } = {}) {
  if (!ledger) return;
  ledger.words += 1;
  ledger.base += Number.isFinite(base) && base > 0 ? base : 0;
  ledger.total += Number.isFinite(total) && total > 0 ? total : 0;
  for (const f of PAYOUT_FACTORS) {
    const m = num(factors[f.key]);
    if (Math.abs(m - 1) <= 1e-9) continue;
    const l = Math.log(m);
    ledger.logs[f.key] = (ledger.logs[f.key] || 0) + l;
    ledger.logSum += l;
  }
}

/**
 * The round's breakdown: total, the flat base it would have paid with no multipliers at all, and
 * one row per factor with its share of everything above that base.
 * Returns null when no round has been opened.
 */
export function readPayoutLedger() {
  if (!ledger) return null;
  const above = Math.max(0, ledger.total - ledger.base);
  const rows = [];
  for (const f of PAYOUT_FACTORS) {
    const l = ledger.logs[f.key];
    if (!l || l <= 0) continue;
    rows.push({
      ...f,
      share: ledger.logSum > 0 ? l / ledger.logSum : 0,
      wins: ledger.logSum > 0 ? Math.round((l / ledger.logSum) * above) : 0,
      // The round's AVERAGE multiplier for this factor, i.e. the geometric mean over the words
      // it actually applied to — the number a player can compare against a shop card.
      mult: Math.exp(l / Math.max(1, ledger.words)),
    });
  }
  rows.sort((a, b) => b.share - a.share);
  return { mode: ledger.mode, words: ledger.words, base: ledger.base, total: ledger.total, above, rows };
}

export function clearPayoutLedger() {
  ledger = null;
}
