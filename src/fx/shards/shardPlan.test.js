// shardPlan.test.js — a shard burst's limits and flight vectors: every shard clears the box it bursts from, stays on
// screen, and the moment stays one strong idea.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearVectors, fitInside, SHARD_MS, SHARD_MAX } from './shardPlan.js';

test('clear vectors leave the card: every shard ends outside the box, by reach', () => {
  const [w, h] = [252, 420];
  const vs = clearVectors(14, w, h, { reach: [50, 150] });
  assert.equal(vs.length, 14);
  for (const v of vs) {
    // how far past the card's edge the shard lands, measured along its own ray
    const a = Math.atan2(v.y, v.x);
    const exit = Math.min(w / 2 / Math.abs(Math.cos(a) || 1e-6), h / 2 / Math.abs(Math.sin(a) || 1e-6));
    assert.ok(Math.hypot(v.x, v.y) - exit >= 48, JSON.stringify(v));
    assert.ok(Math.hypot(v.x, v.y) < Math.hypot(w / 2, h / 2) + 160, JSON.stringify(v));
    assert.ok(v.s >= 0.8 && v.s <= 1.2);
  }
  // spread all the way round: some up, some down, some left, some right
  assert.ok(vs.some((v) => v.y < -h / 2) && vs.some((v) => v.y > h / 2));
  assert.ok(vs.some((v) => v.x < -w / 2) && vs.some((v) => v.x > w / 2));
});

test('one strong idea: at most 14 shards, every flight under 600 ms', () => {
  assert.ok(SHARD_MAX >= 8 && SHARD_MAX <= 14);
  assert.ok(SHARD_MS < 600);
});

test('fitInside keeps every shard on screen (direction kept, reach shortened)', () => {
  const from = { x: 40, y: 60 };
  const vs = fitInside([{ x: -200, y: 0, s: 1 }, { x: 300, y: 0, s: 1 }, { x: 0, y: -200, s: 1 }, { x: -150, y: -150, s: 1 }], from, 390, 844, { pad: 20, min: 10 });
  assert.deepEqual(vs[1], { x: 300, y: 0, s: 1 }); // room to the right: untouched
  for (const v of vs) {
    assert.ok(from.x + v.x >= 20 - 0.5 && from.x + v.x <= 370 + 0.5, JSON.stringify(v));
    assert.ok(from.y + v.y >= 20 - 0.5 && from.y + v.y <= 824 + 0.5, JSON.stringify(v));
  }
  assert.ok(vs[0].x < 0 && vs[0].y === 0); // still flies left
});
