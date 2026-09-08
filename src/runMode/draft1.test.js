// draft1.test.js (fix/run-deep-pockets) — the FIRST draft is the whole game for a casual player:
// the one card taken after round 1 is the only modifier through rounds 2 and 3. Pins, via the
// draft-1 audit in claude/run-skill.mjs (shipped engine, casual 8.6-attempt player, N=4000, seed 777):
//   - DEEP POCKETS is a real but bounded floor-raiser: Δ P(reach R4) vs the empty stack in [+8, +25]
//     (its flat +120 used to clear round 2's 120 wall by itself — an auto-clear, Δ far above this).
//   - no single card is an auto-clear (Δ ≤ +45) and none is a trap (Δ ≥ −10).
import test from 'node:test';
import assert from 'node:assert/strict';
import { draft1Audit } from '../../claude/run-skill.mjs';
import { MODIFIERS, wallAt } from './engine.js';

const audit = draft1Audit({ attempts: 8.6, accuracy: 0.93, N: 4000, seed: 777 });
const fmt = (r) => `${r.id} Δ(reach R4) ${r.dReachR4.toFixed(1)} pts (R2 ${r.clearR2.toFixed(1)}%, R4 ${r.reachR4.toFixed(1)}%; empty R4 ${audit.empty.reachR4.toFixed(1)}%)`;

test('audit covers the empty stack + every card, at the shipped wall', () => {
  assert.equal(audit.rows.length, MODIFIERS.length + 1);
  assert.equal(audit.wall[1], wallAt(2));
  assert.ok(audit.empty.clearR2 > 0 && audit.empty.clearR2 < 100, 'round 2 must be a real filter for the empty stack');
});

test('DEEP POCKETS alone: Δ P(reach R4) vs empty is between +8 and +25 pts', () => {
  const dp = audit.byId['deep-pockets'];
  assert.ok(dp.dReachR4 >= 8 && dp.dReachR4 <= 25, fmt(dp));
});

test('no card alone is an auto-clear (Δ ≤ +45) or a trap (Δ ≥ −10) through the first draft', () => {
  for (const r of audit.rows.slice(1)) {
    assert.ok(r.dReachR4 <= 45, `auto-clear: ${fmt(r)}`);
    assert.ok(r.dReachR4 >= -10, `trap: ${fmt(r)}`);
  }
});
