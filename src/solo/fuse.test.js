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
  createFuseEngine,
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

// ============================================================================
// SIMULATION GUARD — a headless median FUSE player, 500 seeded runs.
// The player model (vocabulary, recall speed, tier think-time) represents player
// skill and is ours to choose; the FITTED CONSTANTS it runs against are fixed. If a
// future edit breaks the base curve / tier mults / length dock, this band moves.
// ============================================================================
const _recall = readFileSync(new URL('./words.recall.txt', import.meta.url), 'utf8').split(' ');
const _accept = new Set(_recall);
for (const w of readFileSync(new URL('./words.accept.txt', import.meta.url), 'utf8').split(' ')) _accept.add(w);
const _poolsRaw = JSON.parse(readFileSync(new URL('./fragmentPools.json', import.meta.url), 'utf8'));
const _pools = {
  e: _poolsRaw.e.split(' '),
  m: _poolsRaw.m.split(' '),
  h: _poolsRaw.h.split(' '),
  b: _poolsRaw.b.split(' '),
};
const _fragSet = new Set([..._pools.e, ..._pools.m, ..._pools.h, ..._pools.b]);

// fragment → vocab words containing it (frequency order). Built via each word's own
// 2-3 char substrings (fast) rather than scanning every fragment against every word.
function containIndex(vocab) {
  const idx = new Map();
  for (const f of _fragSet) idx.set(f, []);
  for (const w of vocab) {
    const seen = new Set();
    for (let i = 0; i < w.length; i++) {
      for (const len of [2, 3]) {
        const sub = w.slice(i, i + len);
        if (sub.length === len && _fragSet.has(sub) && !seen.has(sub)) {
          seen.add(sub);
          idx.get(sub).push(w);
        }
      }
    }
  }
  return idx;
}
const _fuseIdx = containIndex(_recall.slice(0, 9000)); // median player knows ~9k words

const _fuseMedian = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

// Harder fragments take longer to spot a word for (the tier mult already grants a
// little more time; this is the offsetting recall cost).
const _TIER_THINK = { e: 0, m: 500, h: 1300, b: 2000 };

function runFuseHuman(rng) {
  const eng = createFuseEngine({ accept: _accept, pools: _pools, rng });
  eng.start();
  let solved = 0;
  for (let g = 0; g < 3000; g++) {
    if (!eng.state.alive) break;
    const cands = _fuseIdx.get(eng.state.fragment) || [];
    let word = null;
    for (const w of cands) {
      if (eng.state.used.has(w)) continue;
      if (rng() < 0.75) {
        word = w; // the player doesn't recall every possible word
        break;
      }
    }
    if (!word) {
      if (eng.expire().ended) break;
      continue;
    }
    const produce = 1400 + rng() * 2800 + 260 * word.length + _TIER_THINK[eng.state.tier];
    if (produce > eng.state.fuseMs) {
      if (eng.expire().ended) break; // too slow → lose a life
      continue;
    }
    if (!eng.submit(word).ok) {
      if (eng.expire().ended) break;
      continue;
    }
    solved += 1;
  }
  return solved;
}

test('SIM: median FUSE player lands 21-28 words (target 24)', () => {
  const rng = mulberry32(4242);
  const res = [];
  for (let i = 0; i < 500; i++) res.push(runFuseHuman(rng));
  const med = _fuseMedian(res);
  assert.ok(med >= 21 && med <= 28, `median words ${med} outside 21-28`);
});
