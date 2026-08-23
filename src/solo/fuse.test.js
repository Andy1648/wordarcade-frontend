// fuse.test.js — pins FUSE's fitted numbers, the tier crossfade, the length dock, the
// fragment pools, and the without-replacement bag.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  fuseBase,
  lenFactor,
  selectTier,
  FUSE_TIER_MULT,
  FUSE_TIERS,
  createFragmentBag,
} from './fuse.js';
import { mulberry32 } from './shared.js';

// ---- the base curve ----
test('fuseBase(0) === 12500', () => {
  assert.equal(fuseBase(0), 12500);
});

test('fuseBase is monotonically decreasing', () => {
  let prev = Infinity;
  for (let w = 0; w <= 200; w++) {
    const v = fuseBase(w);
    assert.ok(v < prev);
    prev = v;
  }
});

// ---- tier multipliers (exact) ----
test('tier multipliers are exactly {e:1.00, m:1.05, h:1.14, b:1.30}', () => {
  assert.deepEqual(FUSE_TIER_MULT, { e: 1.0, m: 1.05, h: 1.14, b: 1.3 });
  assert.deepEqual(FUSE_TIERS, ['e', 'm', 'h', 'b']);
});

// ---- length factor ----
test('lenFactor: 3→0.80, 4→0.92, 5→1.00, 9→1.00', () => {
  assert.equal(lenFactor(3), 0.8);
  assert.equal(lenFactor(4), 0.92);
  assert.equal(lenFactor(5), 1.0);
  assert.equal(lenFactor(9), 1.0);
});

// ---- tier crossfade ----
test('selectTier: e at w=0; only the top tier by w=33; fraction drives the bump', () => {
  assert.equal(selectTier(0, () => 0.5), 'e'); // x=0, i=0, frac 0
  assert.equal(selectTier(33, () => 0.99), 'b'); // x=3, always top
  // At w=11, x=1, i=1, frac 0 ⇒ always 'm' regardless of rng
  assert.equal(selectTier(11, () => 0.0), 'm');
  assert.equal(selectTier(11, () => 0.999), 'm');
  // At w≈5.5, x=0.5, i=0: rng<0.5 bumps to 'm', else 'e'
  assert.equal(selectTier(5, () => 0.0), 'm'); // x=0.4545, rng 0 < frac ⇒ bump
  assert.equal(selectTier(5, () => 0.9), 'e'); // rng 0.9 ≥ frac ⇒ stay
});

// ---- without-replacement bag ----
test('fragment bag: first pool.length draws never repeat', () => {
  const pool = Array.from({ length: 30 }, (_, i) => 'f' + i);
  const bag = createFragmentBag(pool, mulberry32(7));
  const draws = [];
  for (let i = 0; i < pool.length + 1; i++) draws.push(bag.draw());
  const firstCycle = draws.slice(0, pool.length);
  assert.equal(new Set(firstCycle).size, pool.length, 'the first full cycle is a permutation');
  assert.equal(new Set(firstCycle).size, new Set(pool).size);
});

// ---- the fragment pools (require src/solo/fragmentPools.json) ----
const POOLS_URL = new URL('./fragmentPools.json', import.meta.url);
const POOLS_PATH = fileURLToPath(POOLS_URL);
const EXPECT_SIZES = { e: 113, m: 190, h: 318, b: 405 };

test('fragmentPools.json exists (data asset committed)', () => {
  assert.ok(existsSync(POOLS_PATH), `missing ${POOLS_PATH} — the fitted fragment pools`);
});

test('fragment pools are exactly 113/190/318/405, 2-3 lowercase a-z, no dupes', () => {
  const pools = JSON.parse(readFileSync(POOLS_URL, 'utf8'));
  for (const tier of FUSE_TIERS) {
    const frags = pools[tier].trim().split(/\s+/);
    assert.equal(frags.length, EXPECT_SIZES[tier], `${tier} size`);
    assert.equal(new Set(frags).size, frags.length, `${tier} has duplicates`);
    for (const f of frags) {
      assert.ok(/^[a-z]{2,3}$/.test(f), `${tier} fragment "${f}" is not 2-3 lowercase a-z`);
    }
  }
});
