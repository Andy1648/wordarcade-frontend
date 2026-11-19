// crackPlan.test.js — the crack roll's climb is HONEST: it only presents the roll's result (never above it, always ending
// on it, never falling), with at most a two-tier skip per tap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crackPath, crackJumps, crackRank, CRACK_LADDER, CRACK_TAPS } from './crackPlan.js';

const seeded = (s) => { const next = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; for (let i = 0; i < 8; i += 1) next(); return next; }; // warmed: a Park-Miller first draw is tiny for small seeds

test('every path ends on the result, never falls, never shows a tier above it, skips at most two', () => {
  for (const result of CRACK_LADDER) {
    for (let seed = 1; seed < 400; seed += 1) {
      const p = crackPath(result, seeded(seed));
      assert.equal(p.length, CRACK_TAPS);
      assert.equal(p[p.length - 1], result, `${result} seed ${seed}`);
      const j = crackJumps(p);
      for (const d of j) assert.ok(d >= 0 && d <= 2, `jump ${d}`);
      for (const t of p) assert.ok(crackRank(t) <= crackRank(result));
    }
  }
});

test('a RARE roll never changes colour; a SECRET climbs on at least two taps', () => {
  assert.deepEqual(crackPath('rare', seeded(7)), ['rare', 'rare', 'rare']);
  for (let seed = 1; seed < 200; seed += 1) assert.ok(crackJumps(crackPath('secret', seeded(seed))).filter((d) => d > 0).length >= 2);
});

test('jumps lean late: across many legendary rolls the last tap jumps more often than the first', () => {
  let first = 0; let last = 0;
  for (let seed = 1; seed < 2000; seed += 1) { const j = crackJumps(crackPath('legendary', seeded(seed))); first += j[0] > 0; last += j[2] > 0; }
  assert.ok(last > first, `${last} vs ${first}`);
});
