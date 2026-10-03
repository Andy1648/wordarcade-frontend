// difficulty.test.js — the ONE difficulty mapping shared by lobby + in-game HUD. Pure, node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, difficultyLabel, difficultyDesc, difficultyReadout, difficultyPay } from './difficulty.js';
import { DIFFICULTY_MULT } from './progress/wins.js';

test('the lobby label and the in-game label come from the same map (no CRAZY→MEDIUM drift)', () => {
  // The exact contradiction the bug produced: the server key must render as the edgy tier
  // name on BOTH screens, never the raw key uppercased.
  assert.equal(difficultyLabel('chill'), 'CHILL');
  assert.equal(difficultyLabel('easy'), 'HARD');
  assert.equal(difficultyLabel('medium'), 'CRAZY'); // was showing MEDIUM in-game
  assert.equal(difficultyLabel('hard'), 'HELL'); // was showing HARD in-game
});

test('every tier the lobby renders resolves to a label + desc', () => {
  for (const d of DIFFICULTIES) {
    assert.equal(difficultyLabel(d.key), d.label);
    assert.equal(difficultyDesc(d.key), d.desc);
    assert.ok(/\d+s/.test(d.desc) && /lives$/.test(d.desc), `desc "${d.desc}" not "Ns · N lives"`);
  }
});

test('unknown / blank keys fall back to the uppercased key, never throw', () => {
  assert.equal(difficultyLabel('nightmare'), 'NIGHTMARE');
  assert.equal(difficultyLabel(''), '');
  assert.equal(difficultyLabel(undefined), '');
  assert.equal(difficultyDesc('nope'), '');
  assert.equal(difficultyReadout('nope'), 'NOPE');
});

test('the readout pairs the label with the desc', () => {
  assert.equal(difficultyReadout('medium'), 'CRAZY — 10s · 2 lives · ×1.5 WINS');
});

test('H6/M21: the picker says harder pays more, from the payout table', () => {
  assert.equal(difficultyPay('chill'), '×1 WINS');
  assert.equal(difficultyPay('easy'), '×1.25 WINS');
  assert.equal(difficultyPay('hard'), '×2 WINS');
  for (const d of DIFFICULTIES) assert.equal(difficultyPay(d.key), `×${DIFFICULTY_MULT[d.key]} WINS`);
  assert.equal(difficultyPay('nope'), '');
});
