// rankPlates.test.js — the 16 shaped rank plates (KitLevelUp.dc.html 03) are exactly the v3 ladder, in order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RANK_PLATES, plateFor } from './rankPlates.js';
import { RANKS_V3 } from '../../progress/v3/ranks.js';

test('one plate per v3 rank, same order, same names and codes', () => {
  assert.equal(RANK_PLATES.length, 16);
  assert.deepEqual(RANK_PLATES.map((p) => [p.req, p.name]), RANKS_V3.map((r) => [r.req, r.name]));
});

test('shape + trim escalate: every plate has a shape; the ★ tiers (and only they) shimmer + glow', () => {
  for (const p of RANK_PLATES) {
    assert.match(p.shape, /^M[\d .HVLZ-]+Z$/);
    assert.equal(p.g.length, 3);
    assert.equal(!!p.star, p.req.startsWith('★'), p.req);
    assert.equal(!!p.glow, !!p.star, p.req);
  }
  // trim only grows from R6 up: horns, arrow, bolts, crown, wings…
  assert.ok(RANK_PLATES.slice(6).every((p) => p.back || p.front), 'every rank from KEYFIEND up wears trim');
});

test('plateFor finds a plate by code, name or index; unknown → KEYMASH', () => {
  assert.equal(plateFor('R6').name, 'KEYFIEND');
  assert.equal(plateFor('★10').name, 'FINAL BOSS');
  assert.equal(plateFor('ENDGAME').req, '★20');
  assert.equal(plateFor(11).name, 'VOIDTYPER');
  assert.equal(plateFor(99).name, 'ENDGAME');
  assert.equal(plateFor('nope').name, 'KEYMASH');
});
