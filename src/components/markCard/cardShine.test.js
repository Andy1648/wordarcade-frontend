// cardShine.test.js — the CARD SHINE LADDER (Andy oct11): every tier shines, rarer = more often; the scheduler starts
// only due, visible cards, oldest first, a few per tick (a grid staggers, never flashes in unison).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SHINE_EVERY_MS, SHINE_MS, SHINE_TIERS, dueHosts, shineSrc } from './cardShine.js';

test('every tier has a shine asset, and rarer tiers shine more often', () => {
  assert.deepEqual(SHINE_TIERS, ['rare', 'epic', 'legendary', 'mythic', 'secret']);
  for (let i = 1; i < SHINE_TIERS.length; i += 1) {
    assert.ok(SHINE_EVERY_MS[SHINE_TIERS[i]] < SHINE_EVERY_MS[SHINE_TIERS[i - 1]], `${SHINE_TIERS[i]} more often`);
  }
  for (const t of SHINE_TIERS) {
    assert.ok(SHINE_MS[t] >= 200 && SHINE_MS[t] <= 1000, `${t} sweep is a snappy one-shot`);
    const f = new URL(`../../../public${shineSrc(t)}`, import.meta.url);
    assert.ok(existsSync(f), `${shineSrc(t)} exists`);
    assert.doesNotMatch(readFileSync(f, 'utf8'), /<(linear|radial)Gradient|<filter|feGaussianBlur/, 'flat steps only');
  }
  assert.equal(shineSrc('permanent'), '/fx/shine-legendary.svg');
});

test('dueHosts: only due + visible, oldest first, capped', () => {
  const h = (id, due, vis = true) => ({ id, due, vis });
  const list = [h('a', 50), h('b', 10), h('c', 200), h('d', 5, false), h('e', 20)];
  assert.deepEqual(dueHosts(list, 100, (x) => x.vis).map((x) => x.id), ['b', 'e']);
  assert.deepEqual(dueHosts(list, 100, (x) => x.vis, 5).map((x) => x.id), ['b', 'e', 'a']);
  assert.deepEqual(dueHosts(list, 1, (x) => x.vis), []);
});
