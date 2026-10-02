import test from 'node:test';
import assert from 'node:assert/strict';
import { scenePositions } from './sceneLayout.js';

test('tier 0 keeps the hand-placed wall (null)', () => {
  assert.equal(scenePositions(22, 0), null);
});

test('deterministic per tier, different between tiers', () => {
  assert.deepEqual(scenePositions(22, 5), scenePositions(22, 5));
  for (let t = 1; t < 24; t += 1) {
    assert.notDeepEqual(scenePositions(22, t), scenePositions(22, t + 1), `tier ${t} vs ${t + 1}`);
  }
});

test('every piece stays on the wall and the pieces are spread (one per grid cell)', () => {
  for (let t = 1; t <= 24; t += 1) {
    const p = scenePositions(22, t);
    assert.equal(p.length, 22);
    for (const q of p) {
      assert.ok(q.top >= 4 && q.top <= 86, `top ${q.top}`);
      assert.ok(q.left >= 3 && q.left <= 89, `left ${q.left}`);
      assert.ok(q.rot >= -28 && q.rot <= 28);
    }
    const cells = new Set(p.map((q) => `${Math.floor(((q.top - 4) / 82) * 5)}:${Math.floor(((q.left - 3) / 86) * 5)}`));
    assert.equal(cells.size, 22, `tier ${t}: no two pieces share a cell`);
  }
});
