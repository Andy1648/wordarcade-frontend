// effectSlot.test.js — ONE light effect per word, priority CLUTCH > LUCKY > RARE > TIER-UP > HYPE,
// and a losing effect degrades to a tag instead of vanishing (juice/effectSlot.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOT_PRIORITY, pickEffect, isOutranked, tagLabel } from './effectSlot.js';

test('priority order is clutch > lucky > rare > tier > hype', () => {
  assert.deepEqual([...SLOT_PRIORITY], ['clutch', 'lucky', 'rare', 'tier', 'hype']);
});

test('nothing special -> the hype word, no tags', () => {
  assert.deepEqual(pickEffect({}), { main: 'hype', tags: [] });
  assert.deepEqual(pickEffect(), { main: 'hype', tags: [] });
});

test('each effect alone wins the slot', () => {
  assert.equal(pickEffect({ clutch: true }).main, 'clutch');
  assert.equal(pickEffect({ lucky: true }).main, 'lucky');
  assert.equal(pickEffect({ rare: true }).main, 'rare');
  assert.equal(pickEffect({ tierUp: 3 }).main, 'tier');
});

test('every combination: exactly ONE main, the rest become tags in priority order', () => {
  const keys = ['clutch', 'lucky', 'rare', 'tierUp'];
  for (let mask = 0; mask < 16; mask++) {
    const flags = {};
    keys.forEach((k, i) => { flags[k] = !!(mask & (1 << i)); });
    const { main, tags } = pickEffect(flags);
    const live = ['clutch', 'lucky', 'rare', 'tier'].filter((k, i) => flags[keys[i]]);
    assert.equal(main, live[0] || 'hype', `mask ${mask}`);
    assert.deepEqual(tags, live.slice(1), `mask ${mask}: losers are tags, never dropped`);
    // never silent: every live effect is either the main or a tag
    assert.equal(tags.length + (live.length ? 1 : 0), live.length);
    assert.ok(!tags.includes('hype'), 'the hype word never becomes a tag');
  }
});

test('clutch + lucky + rare: clutch plays, LUCKY and RARE are said small', () => {
  const r = pickEffect({ clutch: true, lucky: true, rare: true, tierUp: 2 });
  assert.equal(r.main, 'clutch');
  assert.deepEqual(r.tags, ['lucky', 'rare', 'tier']);
});

test('isOutranked: the tier slam steps aside for clutch / lucky / rare only', () => {
  assert.equal(isOutranked('tier', {}), false);
  assert.equal(isOutranked('tier', { rare: true }), true);
  assert.equal(isOutranked('tier', { lucky: true }), true);
  assert.equal(isOutranked('tier', { clutch: true }), true);
  assert.equal(isOutranked('rare', { lucky: true }), true);
  assert.equal(isOutranked('lucky', { rare: true }), false);
  assert.equal(isOutranked('clutch', { lucky: true, rare: true }), false);
});

test('tag labels are short caps and name the real factor', () => {
  assert.equal(tagLabel('clutch'), 'CLUTCH');
  assert.equal(tagLabel('lucky', { luckyMult: 5 }), 'LUCKY ×5');
  assert.equal(tagLabel('lucky'), 'LUCKY ×5');
  assert.equal(tagLabel('rare', { band: 'obscure' }), 'OBSCURE');
  assert.equal(tagLabel('tier', { tierLabel: 'on fire' }), 'ON FIRE');
  assert.equal(tagLabel('hype'), '');
});
