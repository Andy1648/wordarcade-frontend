// gearsNov3.test.js — NEW GEARS batch 2 (nov3, "bombs, newgrounds energy"): 3 RAREs + a MYTHIC + a SECRET on the last
// free (main kind, tier) slots, each painted, printing its main + perk + flavour, no flat XP, the tier odds split only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ROLL_MARKS, TIER_ODDS } from './markRollsCore.js';
import { MARK_PERKS } from './markPerks.js';
import { flavourOf, FLAVOUR_MAX } from './markFlavour.js';

const NEW = { 'mk-cherrybomb': 'rare', 'mk-spraycan': 'rare', 'mk-popcorn': 'rare', 'mk-pinata': 'mythic', 'mk-megaton': 'secret' };

test('the 5 nov3 gears: in the pool at their tier, painted, a flavour line, no flat XP; MYTHIC+ carry FREE OVERDRIVE', () => {
  for (const [id, tier] of Object.entries(NEW)) {
    const m = ROLL_MARKS.find((x) => x.id === id);
    assert.ok(m, id);
    assert.equal(m.tier, tier, `${id} tier`);
    assert.ok(!['xpPct', 'baseXp'].includes(m.stat.kind), `${id} is not flat XP`);
    assert.ok(flavourOf(id) && flavourOf(id).length <= FLAVOUR_MAX, `${id} flavour`);
    assert.ok(existsSync(new URL(`../../public/gear/${id.slice(3)}.webp`, import.meta.url)), `${id} art`);
    if (tier !== 'rare') assert.ok((MARK_PERKS[id] || []).includes('freeOd'), `${id} FREE OVERDRIVE`);
  }
  // a MYTHIC game-XP gear would break the 35% games-share cap — never one
  assert.ok(!ROLL_MARKS.some((m) => m.tier === 'mythic' && m.stat.kind === 'gameXpPct'));
  for (const t of Object.keys(TIER_ODDS)) {
    const sum = ROLL_MARKS.filter((m) => m.tier === t).reduce((s, m) => s + 1 / m.x, 0);
    assert.ok(Math.abs(sum - 1 / TIER_ODDS[t]) < 1e-9, `${t} odds moved`);
  }
});
