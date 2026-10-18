import test from 'node:test';
import assert from 'node:assert/strict';
import { wordEm, advancesFor, BUNGEE_ADV } from './wordEm.js';

test('sums advance widths, case-insensitive', () => {
  assert.equal(wordEm('MW'), BUNGEE_ADV.M + BUNGEE_ADV.W);
  assert.equal(wordEm('mw'), wordEm('MW'));
});
test('uses the table it is given (the measured font, not always Bungee)', () => {
  const wide = { ...BUNGEE_ADV, W: 1.04 };
  assert.ok(wordEm('WWW', wide) > wordEm('WWW'));
});
test('a W/M-heavy word is wider than a word of narrow letters the same length', () => {
  assert.ok(wordEm('MMMM') > wordEm('IIII'));
});
test('empty, and off-table glyphs cost the widest letter', () => {
  assert.equal(wordEm(''), 0);
  assert.equal(wordEm(null), 0);
  assert.equal(wordEm('7'), Math.max(...Object.values(BUNGEE_ADV)));
});
test('no DOM (node / SSR): falls back to the Bungee table', () => {
  assert.equal(advancesFor('Bungee, cursive'), BUNGEE_ADV);
});
