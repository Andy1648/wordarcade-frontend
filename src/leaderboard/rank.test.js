import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hypotheticalRank, ranksAhead, rankAheadFilter } from './client.js';

const me = (rebirths, level, lifetimeWords, lifetimeLetters = 0) => ({ rebirths, level, lifetimeWords, lifetimeLetters });
const row = (rebirths, level, lifetime_words, lifetime_letters = 0) => ({ rebirths, level, lifetime_words, lifetime_letters });

test('an empty board puts anyone at #1', () => {
  assert.equal(hypotheticalRank([], me(0, 1, 1)), 1);
});

test('Andy oct3 19:55: order is REBIRTHS, then LEVEL, then lifetime words; exact ties go to the existing row', () => {
  const rows = [row(2, 10, 50), row(0, 99, 9000), row(0, 40, 100)];
  assert.equal(hypotheticalRank(rows, me(13, 6, 400)), 1, 'more rebirths beat any level');
  assert.equal(hypotheticalRank(rows, me(2, 9, 99999)), 2, 'same rebirths: level decides, words do not jump it');
  assert.equal(hypotheticalRank(rows, me(2, 11, 0)), 1, 'same rebirths, higher level wins');
  assert.equal(hypotheticalRank(rows, me(0, 100, 0)), 2, 'R0 at LV100 stays under an R2 row');
  assert.equal(hypotheticalRank(rows, me(0, 41, 0)), 3, 'level beats words');
  assert.equal(hypotheticalRank(rows, me(0, 40, 101)), 3, 'words break a level tie');
  assert.equal(hypotheticalRank(rows, me(0, 40, 100)), 4, 'tie loses');
  assert.equal(ranksAhead(row(9, 40, 100), me(9, 40, 100)), true, 'exact tie goes to the existing row');
  assert.equal(ranksAhead(row(9, 39, 0), me(0, 40, 99999)), true, 'rebirths put a lower level ahead');
  assert.equal(ranksAhead(row(1, 999, 99999), me(2, 1, 0)), false, 'one more rebirth beats any level and words');
});

test('rankAheadFilter is ranksAhead as a PostgREST or=', () => {
  assert.equal(rankAheadFilter(3, 16, 200),
    '(rebirths.gt.3,and(rebirths.eq.3,level.gt.16),and(rebirths.eq.3,level.eq.16,lifetime_words.gte.200))');
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
