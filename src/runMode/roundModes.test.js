// roundModes.test.js (fix/run-round-modes) — the run's three round flavours: the SAT label is gone
// (replaced by LONG, an ENFORCED 6+-letter rule), and the flavours are comparably hard: with an
// empty stack at round 2 (8.6 attempts, N=6000) the per-flavour clear rates sit within 12 pts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUND_MODES } from './config.js';
import { roundModeSpread } from '../../claude/run-skill.mjs';

test('ROUND_MODES: chain / fuse / long — no SAT flavour, LONG states its rule', () => {
  assert.deepEqual(ROUND_MODES.map((m) => m.key), ['chain', 'fuse', 'long']);
  const long = ROUND_MODES.find((m) => m.key === 'long');
  assert.equal(long.label, 'LONG');
  assert.equal(long.rule, 'Only words of 6+ letters count.');
  assert.equal(long.accent, '#9A1AFF');
  for (const m of ROUND_MODES) assert.ok(m.label && m.rule && m.accent, `${m.key} needs label/rule/accent`);
});

test('round-2 clear rate (empty stack, 8.6 attempts, N=6000): max−min across flavours ≤ 12 pts', () => {
  const s = roundModeSpread({ attempts: 8.6, accuracy: 0.93, N: 6000, seed: 20260906 });
  assert.deepEqual(s.rows.map((r) => r.key), ['chain', 'fuse', 'long'], 'the sim models the shipped flavours');
  const detail = s.rows.map((r) => `${r.key} ${r.clearPct.toFixed(1)}%`).join(', ');
  assert.ok(s.spread <= 12, `flavour spread ${s.spread.toFixed(1)} pts > 12 (${detail})`);
});
