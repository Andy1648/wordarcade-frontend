// node --test — the shared number formatter: full grouping below 10,000, then 1-decimal
// K/M/B/T abbreviation, never more than 5 chars before the suffix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNum } from './format.js';

test('below 10,000 reads in full with grouping', () => {
  assert.equal(formatNum(0), '0');
  assert.equal(formatNum(999), '999');
  assert.equal(formatNum(9999), '9,999');
});

test('10,000 and up abbreviate to one decimal with a suffix', () => {
  assert.equal(formatNum(14300), '14.3K');
  assert.equal(formatNum(2200000), '2.2M');
  assert.equal(formatNum(10000), '10.0K');
});

test('rounding never overflows the 5-char budget (carries to the next unit)', () => {
  assert.equal(formatNum(999999), '1.0M'); // not "1000.0K"
  assert.equal(formatNum(1500000000), '1.5B');
  assert.equal(formatNum(2000000000000), '2.0T');
});

test('non-finite input degrades to 0', () => {
  assert.equal(formatNum(NaN), '0');
  assert.equal(formatNum(undefined), '0');
});
