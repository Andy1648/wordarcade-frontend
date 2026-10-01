import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hypotheticalRank, ranksAhead } from './client.js';

const me = (rebirths, level, lifetimeWords) => ({ rebirths, level, lifetimeWords });
const row = (rebirths, level, lifetime_words) => ({ rebirths, level, lifetime_words });

test('an empty board puts anyone at #1', () => {
  assert.equal(hypotheticalRank([], me(0, 1, 1)), 1);
});

test('order is rebirths, then level, then words; exact ties go to the existing row', () => {
  const rows = [row(2, 10, 50), row(0, 99, 9000), row(0, 40, 100)];
  assert.equal(hypotheticalRank(rows, me(3, 1, 0)), 1);
  assert.equal(hypotheticalRank(rows, me(0, 40, 101)), 3);
  assert.equal(hypotheticalRank(rows, me(0, 40, 100)), 4, 'tie loses');
  assert.equal(ranksAhead(row(0, 40, 100), me(0, 40, 100)), true);
});

test('off the top-N returns null', () => {
  const rows = Array.from({ length: 100 }, () => row(5, 100, 100));
  assert.equal(hypotheticalRank(rows, me(0, 1, 1)), null);
  assert.equal(hypotheticalRank(rows.slice(0, 99), me(0, 1, 1)), 100);
});
