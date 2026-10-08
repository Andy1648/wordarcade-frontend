// gainPlan.test.js — NIGHT oct8 #3: the gain animation's numbers are the spec's numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { particleCount, countMs, planParticles, planShards, GAIN_POOL, BURST_MS, CONVERGE_MIN_MS, CONVERGE_MAX_MS, STAGGER_MIN_MS, STAGGER_MAX_MS, SHARD_COUNT } from './gainPlan.js';

test('N = 5 / 10 / 20 by the size of the gain, never past the pool', () => {
  assert.equal(particleCount(1), 5);
  assert.equal(particleCount(99), 5);
  assert.equal(particleCount(100), 10);
  assert.equal(particleCount(9999), 10);
  assert.equal(particleCount(10000), 20);
  assert.equal(particleCount(1e12), 20);
  assert.ok(particleCount(1e12) <= GAIN_POOL);
  assert.equal(particleCount(NaN), 5);
});

test('the counter runs 400 + 150·log10(amount) ms', () => {
  assert.equal(countMs(1), 400);
  assert.equal(countMs(10), 550);
  assert.equal(countMs(1000), 850);
  assert.equal(countMs(1e6), 1300);
  assert.equal(countMs(0), 400);
});

test('particles: burst 200 ms, converge 700–900 ms, 60–80 ms apart', () => {
  let k = 0;
  const seq = [0, 0.5, 0.999, 0.25, 0.75];
  const rng = () => seq[k++ % seq.length];
  const ps = planParticles(10, rng);
  assert.equal(ps.length, 10);
  assert.equal(ps[0].wait, BURST_MS);
  for (let i = 0; i < ps.length; i += 1) {
    const p = ps[i];
    assert.ok(p.flight >= CONVERGE_MIN_MS && p.flight <= CONVERGE_MAX_MS, `flight ${p.flight}`);
    assert.equal(p.land, p.wait + p.flight);
    if (i > 0) {
      const gap = p.wait - ps[i - 1].wait;
      assert.ok(gap >= STAGGER_MIN_MS && gap <= STAGGER_MAX_MS, `stagger ${gap}`);
    }
  }
});

test('the rebirth shards: one burst of SHARD_COUNT', () => {
  const s = planShards();
  assert.equal(s.length, SHARD_COUNT);
  for (const x of s) assert.ok(x.r > 0 && x.s > 0);
});
