// luck.test.js — lucky words (Job 4). Pure, node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeLuckyOracle,
  luckyReward,
  LUCKY_ODDS,
  LUCKY_WINS_MULT,
} from './luck.js';
import { awardWins, perWordWins } from './wins.js';

test('lucky rate holds at 1/40 within tolerance over 10,000 samples', () => {
  const N = 10000;
  const oracle = makeLuckyOracle(12345);
  let hits = 0;
  for (let i = 0; i < N; i++) if (oracle.next()) hits += 1;
  const expected = N / LUCKY_ODDS; // 250
  // A statistical bound, not an exact count — ±40% is comfortably outside noise but catches
  // a broken rate (e.g. 1/20 → 500, 1/80 → 125 both fail).
  assert.ok(Math.abs(hits - expected) < expected * 0.4, `hits=${hits}, expected≈${expected}`);
});

test('averaged across many seeds the rate is very close to 1/40', () => {
  let hits = 0;
  let total = 0;
  for (let s = 1; s <= 200; s++) {
    const o = makeLuckyOracle(s * 2654435761);
    for (let i = 0; i < 500; i++, total++) if (o.next()) hits += 1;
  }
  const rate = hits / total;
  assert.ok(Math.abs(rate - 1 / LUCKY_ODDS) < 0.004, `rate=${rate.toFixed(4)}`);
});

test('same seed reproduces the exact sequence; different seeds diverge', () => {
  const seq = (seed) => {
    const o = makeLuckyOracle(seed);
    return Array.from({ length: 200 }, () => o.next());
  };
  assert.deepEqual(seq(777), seq(777)); // reproducible per run
  assert.notDeepEqual(seq(777), seq(778)); // seed matters
});

test('lucky is not predictable from prior state — hits are not periodic', () => {
  const oracle = makeLuckyOracle(2024);
  const positions = [];
  for (let i = 0; i < 5000; i++) if (oracle.next()) positions.push(i);
  assert.ok(positions.length > 20);
  const gaps = positions.slice(1).map((p, i) => p - positions[i]);
  // A fixed-period generator would produce ~1 distinct gap; a real PRNG produces many.
  assert.ok(new Set(gaps).size > 10, `too regular: ${new Set(gaps).size} distinct gaps`);
});

test('luckyReward: 5x wins + 5x xp on lucky, 1x otherwise', () => {
  assert.deepEqual(luckyReward(true), { winsWeight: 5, xpMult: 5, lucky: true });
  assert.deepEqual(luckyReward(false), { winsWeight: 1, xpMult: 1, lucky: false });
});

test('a lucky word pays 5x WINS for that word via weightedWords', () => {
  const rate = perWordWins({ mode: 'fuse', rebirthCount: 0 });
  // 4 normal + 1 lucky -> weighted 4 + 5 = 9 (the lucky word counts as five).
  const weighted = 4 * 1 + 1 * LUCKY_WINS_MULT;
  const plain = awardWins({ mode: 'fuse', wordsAccepted: 5, rebirthCount: 0 });
  const withLucky = awardWins({ mode: 'fuse', wordsAccepted: 5, weightedWords: weighted, rebirthCount: 0 });
  assert.equal(plain, 5 * rate);
  assert.equal(withLucky, 9 * rate); // the lucky word paid 5× instead of 1×
});
