// node --test — solo / Daily results headline invariant.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloHeadlineScore, sumRoundScores } from './soloScore.js';

// The exact reproduced bug: breakdown +5/+0/+0 (sum 5) but headline showed 0.
test('headline equals the breakdown sum for a Daily run', () => {
  const rounds = [{ roundScore: 5 }, { roundScore: 0 }, { roundScore: 0 }];
  const sum = sumRoundScores(rounds);
  assert.equal(sum, 5);
  // App threads the authoritative daily score in; it must equal the breakdown.
  assert.equal(soloHeadlineScore(sum, { score: sum }), sum);
});

test('a stale/zero score prop never overrides the Daily score (the headline-0 bug)', () => {
  // scoreTotal arrives as a mount-time stale 0, but daily.score is the real 5.
  assert.equal(soloHeadlineScore(0, { score: 5 }), 5);
  assert.equal(soloHeadlineScore(undefined, { score: 5 }), 5);
});

test('headline equals the breakdown sum for a non-Daily solo run', () => {
  const rounds = [{ roundScore: 4 }, { roundScore: 2 }, { roundScore: 1 }];
  const sum = sumRoundScores(rounds); // 7
  // No daily -> headline is the total, which the caller sets to the round-sum.
  assert.equal(soloHeadlineScore(sum, null), sum);
  assert.equal(soloHeadlineScore(sum, undefined), sum);
});

test('non-finite / negative inputs never produce NaN or a negative headline', () => {
  assert.equal(soloHeadlineScore(NaN, null), 0);
  assert.equal(soloHeadlineScore(-3, null), 0);
  assert.equal(soloHeadlineScore(5, { score: NaN }), 5); // bad daily.score -> fall back to total
  assert.equal(sumRoundScores(null), 0);
  assert.equal(sumRoundScores([{}, { roundScore: 'x' }, { roundScore: 3 }]), 3);
});
