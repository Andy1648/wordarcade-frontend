// effectSlot.test.js — ONE light effect per word, priority CLUTCH > LUCKY > RARE > TIER-UP > HYPE,
// and a losing effect degrades to a tag instead of vanishing (juice/effectSlot.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOT_PRIORITY, pickEffect, isOutranked, tagLabel, soloWordSlot } from './effectSlot.js';

test('solo: an UNCOMMON word stands in for the hype word but never outranks a tier-up', () => {
  const unc = { band: 'UNCOMMON', announce: true };
  assert.deepEqual(
    { main: soloWordSlot({ rarity: unc }).main, show: soloWordSlot({ rarity: unc }).showRarity },
    { main: 'hype', show: true }
  );
  const withTier = soloWordSlot({ rarity: unc, tierUp: 2 });
  assert.equal(withTier.main, 'tier');
  assert.equal(withTier.showRarity, false, 'the slam owns the word; the UNCOMMON pop steps aside');
});

test('solo: RARE outranks the tier slam; the tier says itself (not repeated in labels)', () => {
  const r = soloWordSlot({ rarity: { band: 'RARE', announce: true }, tierUp: 3 });
  assert.equal(r.main, 'rare');
  assert.equal(r.showRarity, true);
  assert.deepEqual(r.labels, []);
});

test('solo: clutch + lucky + obscure: clutch plays, LUCKY and OBSCURE are tags, no rarity pop', () => {
  const r = soloWordSlot({ clutch: true, luckyMult: 5, rarity: { band: 'OBSCURE', announce: true } });
  assert.equal(r.main, 'clutch');
  assert.equal(r.showRarity, false);
  assert.deepEqual(r.labels, ['LUCKY', 'OBSCURE']);
});

test('solo: a COMMON, unlucky, no-tier word is plain hype with nothing extra', () => {
  const r = soloWordSlot({ rarity: { band: 'COMMON', announce: false } });
  assert.deepEqual({ main: r.main, showRarity: r.showRarity, labels: r.labels }, { main: 'hype', showRarity: false, labels: [] });
});

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
  assert.equal(tagLabel('lucky', { luckyMult: 5 }), 'LUCKY'); // Rebirth Rush: no ×N — lucky pays no multiplier
  assert.equal(tagLabel('lucky'), 'LUCKY');
  // Word Bomb + Blitz pay the lucky ×N (a BOOST sub-factor), so their tag names it
  assert.equal(tagLabel('lucky', { luckyMult: 5, paysMult: true }), 'LUCKY ×5');
  assert.equal(tagLabel('lucky', { paysMult: true }), 'LUCKY ×5');
  assert.equal(tagLabel('rare', { band: 'obscure' }), 'OBSCURE');
  assert.equal(tagLabel('tier', { tierLabel: 'on fire' }), 'ON FIRE');
  assert.equal(tagLabel('hype'), '');
});
