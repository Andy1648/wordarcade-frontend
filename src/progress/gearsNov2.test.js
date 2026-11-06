// gearsNov2.test.js — the nov2 NEW GEARS batch (Andy "make hella sick gears"): 5 EPICS + 7 MYTHIC chase pieces on free
// (main kind, tier) slots, each painted, printing its main + perk + flavour, no new flat XP, the tier odds split only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLL_MARKS, TIER_ODDS } from './markRollsCore.js';
import { MARK_PERKS } from './markPerks.js';
import { flavourOf, FLAVOUR_MAX } from './markFlavour.js';

const NEW = ['mk-bullseye', 'mk-rocketskates', 'mk-snowball', 'mk-telescope', 'mk-drumsticks',
  'mk-anchor', 'mk-comet', 'mk-meltdown', 'mk-genie', 'mk-gauntlet', 'mk-grimoire', 'mk-supernova'];

test('the 12 nov2 gears are in the pool with a perk + flavour; EPIC / MYTHIC only, never a new flat XP main', () => {
  for (const id of NEW) {
    const m = ROLL_MARKS.find((x) => x.id === id);
    assert.ok(m, id);
    assert.ok(['epic', 'mythic'].includes(m.tier), `${id} tier`);
    assert.notEqual(m.stat.kind, 'xpPct', `${id} is not flat XP`);
    assert.notEqual(m.stat.kind, 'baseXp', `${id} is not flat XP`);
    if (m.tier === 'mythic') assert.ok((MARK_PERKS[id] || []).includes('freeOd'), `${id} MYTHIC carries FREE OVERDRIVE`);
    assert.ok(flavourOf(id) && flavourOf(id).length <= FLAVOUR_MAX, `${id} flavour`);
  }
  // the tier odds never move: each tier still sums to 1 IN TIER_ODDS
  for (const t of Object.keys(TIER_ODDS)) {
    const sum = ROLL_MARKS.filter((m) => m.tier === t).reduce((s, m) => s + 1 / m.x, 0);
    assert.ok(Math.abs(sum - 1 / TIER_ODDS[t]) < 1e-9, `${t} odds moved`);
  }
});
