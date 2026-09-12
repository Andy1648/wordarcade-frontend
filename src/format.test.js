// node --test — the shared number formatter.
//
// UPDATED (feat/progression-clarity). v6 grouped with commas below 10,000 and abbreviated to a
// FIXED one decimal above it. Both were changed on purpose:
//   - a comma at four digits reads as a decimal point to half the world, and adds weight to a
//     number meant to be skimmed. A thin space groups without shouting.
//   - one fixed decimal throws away the digit that distinguishes 1.28M from 1.25M ("1.3M" for
//     both), while a fixed two adds a digit that is not there ("3.10B"). THREE SIGNIFICANT
//     FIGURES with trailing zeros trimmed gives 10.4K / 1.28M / 3.1B from one rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNum, formatNumParts, plural, THIN } from './format.js';

test('below 10,000 reads in full, grouped with a THIN space (not a comma)', () => {
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
