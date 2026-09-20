// node --test — the shared number formatter.
//
// UPDATED (feat/progression-clarity). v6 grouped with commas below 10,000 and abbreviated to a
// FIXED one decimal above it. Both were changed on purpose:
//   - a comma at four digits reads as a decimal point to half the world, and adds weight to a
//     number meant to be skimmed. RETIRED: on a game card "1 030" read as two numbers, which is
//     worse than the problem it was avoiding. The separator is a comma.
//   - one fixed decimal throws away the digit that distinguishes 1.28M from 1.25M ("1.3M" for
//     both), while a fixed two adds a digit that is not there ("3.10B"). THREE SIGNIFICANT
//     FIGURES with trailing zeros trimmed gives 10.4K / 1.28M / 3.1B from one rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNum, formatNumParts, plural, THIN, formatMult, formatMultExact } from './format.js';

test('below 10,000 reads in full, grouped with a COMMA', () => {
  assert.equal(formatNum(0), '0');
  assert.equal(formatNum(999), '999');
  assert.equal(formatNum(9999), `9${THIN}999`);
  assert.equal(formatNum(1234), `1${THIN}234`);
  assert.equal(THIN, ' ');
});

test('10,000 and up abbreviate to THREE SIGNIFICANT FIGURES, trailing zeros trimmed', () => {
  // The three figures from the brief, straight out of one rule.
  assert.equal(formatNum(10400), '10.4K');
  assert.equal(formatNum(1280000), '1.28M');
  assert.equal(formatNum(3100000000), '3.1B');
  // ...and the one that was a raw number on screen before this.
  assert.equal(formatNum(47110), '47.1K');
  assert.equal(formatNum(10000), '10K'); // "10.0K" trims to "10K": the .0 is noise
  assert.equal(formatNum(123456), '123K');
});

test('rounding carries to the next unit instead of printing a four-digit mantissa', () => {
  assert.equal(formatNum(999999), '1M'); // not "1000K"
  assert.equal(formatNum(1500000000), '1.5B');
  assert.equal(formatNum(2000000000000), '2T');
});

test('big tiers: rebirth multipliers and huge XP stay compact (up to 1e18)', () => {
  assert.equal(formatNum(3486784401), '3.49B'); // the v7 R20 multiplier, 3^20
  assert.equal(formatNum(1e11), '100B');
  assert.equal(formatNum(1e12), '1T');
  assert.equal(formatNum(1e15), '1Qa'); // quadrillion
  assert.equal(formatNum(1.03e16), '10.3Qa');
  assert.equal(formatNum(1e18), '1Qi'); // quintillion
  assert.ok(!/(NaN|Infinity)/.test(formatNum(1e21))); // never throws / never NaN past the ladder
});

test('formatNumParts splits the numeral from the unit so they can be typeset apart', () => {
  assert.deepEqual(formatNumParts(47110), { num: '47.1', suffix: 'K', exact: false });
  assert.deepEqual(formatNumParts(999), { num: '999', suffix: '', exact: true });
  assert.deepEqual(formatNumParts(1280000), { num: '1.28', suffix: 'M', exact: false });
  // ...and the split always re-joins to exactly what formatNum returns.
  for (const v of [0, 7, 999, 1234, 9999, 10000, 47110, 1280000, 3.1e9, 1e18]) {
    const p = formatNumParts(v);
    assert.equal(p.num + p.suffix, formatNum(v), `split/join mismatch at ${v}`);
  }
});

test('negatives keep their sign through both branches', () => {
  assert.equal(formatNum(-500), '-500');
  assert.equal(formatNum(-47110), '-47.1K');
});

test('non-finite input degrades to 0', () => {
  assert.equal(formatNum(NaN), '0');
  assert.equal(formatNum(undefined), '0');
  assert.deepEqual(formatNumParts(NaN), { num: '0', suffix: '', exact: true });
});

test('plural: singular at exactly 1, plural otherwise (Blitz opponent rail said "1 answers")', () => {
  assert.equal(plural(1, 'answer'), '1 answer');
  assert.equal(plural(0, 'answer'), '0 answers');
  assert.equal(plural(2, 'answer'), '2 answers');
  assert.equal(plural(1, 'life', 'lives'), '1 life');
  assert.equal(plural(3, 'life', 'lives'), '3 lives');
  assert.equal(plural(NaN, 'answer'), '0 answers'); // guarded
});

// ---- formatMult — a MULTIPLIER is not a count -------------------------------------------------
// formatNum rounds to a whole number below 10,000, which is right for wins and wrong for every
// "×" on the screen: a ×1.6 payout printed as "×2" and a ×1.4 printed as "×1". The second is the
// worse one — "×1" reads as "this upgrade does nothing".
test('formatMult: ONE decimal, trailing .0 stripped', () => {
  assert.equal(formatMult(1.6), '1.6'); // formatNum said "2"
  assert.equal(formatMult(1.4), '1.4'); // formatNum said "1"
  assert.equal(formatMult(2.0), '2');
  assert.equal(formatMult(1), '1');
  assert.equal(formatMult(1.45), '1.5'); // rounds UP, despite 1.45*10 being 14.4999... in float64
  assert.equal(formatMult(3), '3');
  assert.equal(formatMult(12.25), '12.3');
});

test('formatMult: a real bonus never renders as "×1"', () => {
  // MOMENTUM is +1% a buy, so one buy in is ×1.01 — at one decimal that is "1" again, which is
  // the exact defect this function exists to fix, just further down the scale.
  assert.equal(formatMult(1.01), '1.01');
  assert.equal(formatMult(1.03), '1.03');
  assert.equal(formatMult(1.96), '1.96');
  // ...but an exact whole number is still written plainly.
  assert.equal(formatMult(1), '1');
  assert.equal(formatMult(9), '9');
});

test('formatMult: big multipliers stay compact, and garbage is guarded', () => {
  // The rebirth ladder is 3^rc, so it reaches 3.49B — a ten-digit number with ".0" on it is not
  // a readable multiplier. Above 10,000 it hands off to formatNum.
  assert.equal(formatMult(3486784401), formatNum(3486784401));
  assert.equal(formatMult(3486784401), '3.49B');
  assert.equal(formatMult(59049), '59K');
  assert.equal(formatMult(NaN), '0');
  assert.equal(formatMult(undefined), '0');
});

// ---- formatMultExact — a NAMED factor, printed exactly ---------------------------------------
// formatMult rounds to one decimal, which is right for a card's combined product and wrong for a
// receipt's individual terms: the daily-streak ladder is 1.05 / 1.10 / 1.20 / 1.25.
test('formatMultExact: two decimals, trailing zeros trimmed', () => {
  assert.equal(formatMultExact(1.05), '1.05'); // formatMult says "1.1" — a bonus that is not paid
  assert.equal(formatMultExact(1.25), '1.25'); // formatMult says "1.3"
  assert.equal(formatMultExact(1.1), '1.1');
  assert.equal(formatMultExact(2), '2');
  assert.equal(formatMultExact(2.5), '2.5');
  assert.equal(formatMultExact(1.155), '1.16');
});

test('formatMultExact: big multipliers stay compact, garbage is guarded', () => {
  assert.equal(formatMultExact(3486784401), '3.49B'); // the R20 rebirth multiplier, 3^20
  assert.equal(formatMultExact(NaN), '0');
  assert.equal(formatMultExact(undefined), '0');
});

test('the streak ladder survives formatMultExact and does NOT survive formatMult', () => {
  // The reason there are two formatters, pinned so a future tidy-up cannot merge them.
  for (const m of [1.05, 1.25]) {
    assert.equal(formatMultExact(m), String(m));
    assert.notEqual(formatMult(m), String(m));
  }
});
