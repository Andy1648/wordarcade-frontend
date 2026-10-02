import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hypotheticalRank, ranksAhead } from './client.js';

const me = (rebirths, level, lifetimeWords, lifetimeLetters = 0) => ({ rebirths, level, lifetimeWords, lifetimeLetters });
const row = (rebirths, level, lifetime_words, lifetime_letters = 0) => ({ rebirths, level, lifetime_words, lifetime_letters });

test('an empty board puts anyone at #1', () => {
  assert.equal(hypotheticalRank([], me(0, 1, 1)), 1);
});

test('Andy oct2: order is LIFETIME WORDS, then level, then rebirths; exact ties go to the existing row', () => {
  const rows = [row(2, 10, 50), row(0, 99, 9000), row(0, 40, 100)];
  assert.equal(hypotheticalRank(rows, me(9, 500, 10)), 4, 'rebirths + level do not beat words');
  assert.equal(hypotheticalRank(rows, me(0, 1, 9001)), 1);
  assert.equal(hypotheticalRank(rows, me(0, 40, 101)), 2);
  assert.equal(hypotheticalRank(rows, me(0, 41, 100)), 2, 'level breaks a words tie');
  assert.equal(hypotheticalRank(rows, me(0, 40, 100)), 3, 'tie loses');
  assert.equal(ranksAhead(row(0, 40, 100), me(0, 40, 100)), true);
});

test('letters never decide the order (they began counting at #79 with no backfill)', () => {
  assert.equal(ranksAhead(row(0, 3, 321, 2742), me(0, 173, 1061, 0)), false);
  assert.equal(ranksAhead(row(0, 173, 1061, 0), me(0, 3, 321, 999999)), true);
});

test('off the top-N returns null', () => {
  const rows = Array.from({ length: 100 }, () => row(5, 100, 100));
  assert.equal(hypotheticalRank(rows, me(0, 1, 1), 100), null);
  assert.equal(hypotheticalRank(rows.slice(0, 99), me(0, 1, 1), 100), 100);
});
