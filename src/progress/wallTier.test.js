import test from 'node:test';
import assert from 'node:assert/strict';
import { wallTierFor, getWallTier, noteWallLevel, WALL_SEEN_KEY } from './wallTier.js';
import { scenePositions } from './sceneLayout.js';

function withStorage(seed, fn) {
  const m = new Map(Object.entries(seed));
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try { return fn(m); } finally { globalThis.localStorage = prev; }
}

test('a new wall every 100 levels, from LV100 — no cap', () => {
  assert.equal(wallTierFor(1), 0);
  assert.equal(wallTierFor(99), 0);
  assert.equal(wallTierFor(100), 1);
  assert.equal(wallTierFor(199), 1);
  assert.equal(wallTierFor(200), 2);
  assert.equal(wallTierFor(123456), 1234);
  assert.equal(wallTierFor(1e12), 1e10);
});

test('the wall only climbs: a rebirth (level back to 1) never takes it back, and each tier fires once', () => {
  withStorage({}, () => {
    assert.equal(getWallTier(), 0);
    assert.equal(noteWallLevel(99), null);
    assert.equal(noteWallLevel(100), 1);
    assert.equal(noteWallLevel(150), null, 'same tier: no second moment');
    assert.equal(noteWallLevel(1), null, 'rebirth: no drop');
    assert.equal(getWallTier(), 1);
    assert.equal(noteWallLevel(320), 3, 'a jump lands on the reached tier');
    assert.equal(localStorage.getItem(WALL_SEEN_KEY), '3');
  });
});

test('every tier has its own deterministic layout, unlimited', () => {
  const a = scenePositions(22, 7);
  assert.deepEqual(scenePositions(22, 7), a, 'deterministic');
  assert.notDeepEqual(scenePositions(22, 8), a, 'the next tier moves the words');
  const far = scenePositions(22, 5000);
  assert.equal(far.length, 22);
  for (const p of far) assert.ok(Number.isFinite(p.top) && Number.isFinite(p.left) && p.top >= 0 && p.top <= 100 && p.left >= 0 && p.left <= 100);
});
