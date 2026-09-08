// runClock.test.js (fix/run-short-height) — two live-round guarantees that used to lean on
// Math.random() and a decremented counter:
//   1. the GLASS CANNON fumble roll is seeded from the run → same seed, same fumble outcomes,
//      and the roll is an honest 8%/round (no lucky-oracle gate).
//   2. the round clock is a wall-clock deadline → backgrounding can't pause it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fumbleRng, rollFumble, roundSeed, makeRoundClock } from './useRunMode.js';
import { MODIFIER_BY_ID, RUN_ROUNDS } from './engine.js';

const GC = [MODIFIER_BY_ID['glass-cannon']];

// The sequence of fumble outcomes a whole run would see under GLASS CANNON, for one seed.
const runOutcomes = (seed) => Array.from({ length: RUN_ROUNDS }, (_, i) => rollFumble(GC, fumbleRng(seed, i + 1)));

test('same seed → same fumble outcomes, every round', () => {
  for (const seed of [1, 7, 12345, 0xdeadbeef]) {
    assert.deepEqual(runOutcomes(seed), runOutcomes(seed));
  }
});

test('different seeds → different fates (the roll is not a constant)', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++) seen.add(runOutcomes(seed).join(''));
  assert.ok(seen.size > 1);
});

test('no sudden-death modifier → never fumbles, and the RNG is not consumed', () => {
  let calls = 0;
  const rnd = () => { calls++; return 0; };
  for (let r = 1; r <= RUN_ROUNDS; r++) assert.equal(rollFumble([], rnd), false);
  assert.equal(calls, 0);
});

test('the roll is the honest card rate (~8%/round), not gated behind the lucky oracle', () => {
  let fumbles = 0;
  const N = 20000;
  for (let seed = 1; seed <= N; seed++) if (rollFumble(GC, fumbleRng(seed, 1))) fumbles++;
  const rate = fumbles / N;
  assert.ok(rate > 0.065 && rate < 0.095, `rate ${rate}`);
});

test('the fumble stream is decorrelated from the fragment/lucky round seed', () => {
  // Same run seed, same round: the fumble RNG must not be the plain round-seed stream.
  const seed = 99;
  assert.notEqual(fumbleRng(seed, 3)(), (function () {
    // mulberry32 over the raw roundSeed — what the lucky oracle / fragments derive from
    let a = roundSeed(seed, 3) >>> 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  })());
});

test('round clock: seconds left derive from a fixed deadline, so elapsed background time counts', () => {
  const t0 = 1_000_000;
  const c = makeRoundClock(25, t0);
  assert.equal(c.endsAt, t0 + 25_000);
  assert.equal(c.secondsLeft(t0), 25);
  assert.equal(c.secondsLeft(t0 + 999), 25);
  assert.equal(c.secondsLeft(t0 + 1000), 24);
  assert.equal(c.secondsLeft(t0 + 24_500), 1);
  // App-switched for a minute: the clock is simply over — nothing paused.
  assert.equal(c.secondsLeft(t0 + 85_000), 0);
});
