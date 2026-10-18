// ladderGears.test.js — SEASON 2 EARNED gears (Andy oct17): one gear per achievement ladder, owned at 100% (the ladder's
// LAST tier claimed); the gear sheet links to its ladder; the UNLISTED gears sit in the INDEX grid as their own rarity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LADDER_GEARS, ladderOfGear, gearOfLadder, ladderOwnedGears, ownsLadderGear, ACH_CLAIMED_KEY } from './ladderGears.js';
import { ACHIEVEMENTS_V3 } from './v3/achievements.js';

function mem(init = {}) {
  const map = new Map(Object.entries(init));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

test('one gear per ladder, every ladder has one, tier counts match the ladders', () => {
  assert.equal(LADDER_GEARS.length, ACHIEVEMENTS_V3.length);
  for (const a of ACHIEVEMENTS_V3) {
    const r = LADDER_GEARS.find((x) => x.ladder === a.id);
    assert.ok(r, `${a.id} pays a gear`);
    assert.equal(r.tiers, a.T.length, `${a.id} tier count`);
  }
  assert.equal(new Set(LADDER_GEARS.map((r) => r.gear)).size, LADDER_GEARS.length, 'no gear twice');
  assert.equal(gearOfLadder('type'), 'mk-ironhand');
  assert.equal(ladderOfGear('mk-linguist').ladder, 'roll');
  assert.equal(ladderOfGear('mk-ritual'), null, 'RITUALIST has no ladder (retired)');
});

test('owned only at 100%: the LAST tier claimed', () => {
  const s = mem({ [ACH_CLAIMED_KEY]: JSON.stringify({ type: 4, index: 3, power: 5 }) });
  assert.equal(ownsLadderGear('mk-ironhand', s), false, 'TYPE WORDS at IV of V is not 100%');
  assert.equal(ownsLadderGear('mk-curator', s), true, 'FIND GEARS has 3 tiers');
  assert.equal(ownsLadderGear('mk-omega', s), true);
  assert.deepEqual(ladderOwnedGears(s).sort(), ['mk-curator', 'mk-omega']);
  assert.deepEqual(ladderOwnedGears(mem()), []);
  assert.deepEqual(ladderOwnedGears(mem({ [ACH_CLAIMED_KEY]: 'junk' })), [], 'bad storage never throws');
});

test('the achievement names are 1–2 words (Andy oct17)', () => {
  for (const a of ACHIEVEMENTS_V3) assert.ok(a.name.split(/\s+/).length <= 2, a.name);
});

test('the catalog: EARNED gears know their ladder; RITUALIST + BLAZE retired; LINGUIST is HIGH ROLLER', async () => {
  const { PERMANENT_MARKS } = await import('./markRollsCore.js');
  const live = PERMANENT_MARKS.filter((m) => !m.retired);
  assert.equal(live.length, LADDER_GEARS.length);
  for (const m of live) assert.ok(m.ach, `${m.id} has a ladder`);
  assert.ok(PERMANENT_MARKS.find((m) => m.id === 'mk-ritual').retired);
  assert.equal(PERMANENT_MARKS.find((m) => m.id === 'mk-linguist').name, 'HIGH ROLLER');
});

// (the INDEX grid order itself — UNLISTED after SECRET, no strip — is covered by e2e/unlisted.spec.js: gearEntries.js
// uses Vite's extensionless imports, which node's test runner cannot resolve)
test('an UNLISTED card: its own black rarity, never odds, a locked one says FIND IT', async () => {
  const { cardModel } = await import('../components/markCard/cardModel.js');
  const c = cardModel({ id: 'mk-ul-og', kind: 'unlisted', tier: 'unlisted', name: 'O.G.', locked: true });
  assert.equal(c.unlisted, true);
  assert.equal(c.odds, '', 'UNLISTED never prints odds');
  assert.equal(c.tier, 'unlisted');
  const { CARD_RAR } = await import('../components/markCard/palette.js');
  assert.equal(CARD_RAR.unlisted.fill, '#000000', 'just black (Andy oct17)');
});
