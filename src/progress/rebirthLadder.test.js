// node --test — the REBIRTH LADDER chips (pure): BASE / NOW / NEXT strings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rebirthLadder } from './rebirthLadder.js';

const opts = { multOf: (rc) => 1 + rc, gateOf: (rc) => [15, 25, 40, 60][rc] ?? 600 };
const text = (chips) => chips.map((c) => [c.name, c.mult, c.gate, c.gain].filter(Boolean).join(' '));

test('R0: BASE is NOW, then the R1 target', () => {
  const chips = rebirthLadder(0, opts);
  assert.deepEqual(chips.map((c) => c.state), ['now', 'next']);
  assert.deepEqual(text(chips), ['BASE ×1', 'R1 ×2 LV 15 +100%']);
});

test('R2: BASE (past), NOW, NEXT with gate and step gain', () => {
  const chips = rebirthLadder(2, opts);
  assert.deepEqual(chips.map((c) => c.state), ['past', 'now', 'next']);
  assert.deepEqual(text(chips), ['BASE ×1', 'R2 ×3', 'R3 ×4 LV 40 +33%']);
});

test('bad input reads as R0', () => {
  assert.deepEqual(rebirthLadder(NaN, opts), rebirthLadder(0, opts));
  assert.deepEqual(rebirthLadder(-3, opts), rebirthLadder(0, opts));
});

test('big fractional multipliers print whole (no ×27.98)', () => {
  const chips = rebirthLadder(5, { multOf: (rc) => 1 + rc * 5.396, gateOf: () => 75 });
  assert.equal(chips[1].mult, '×28');
  assert.ok(chips.every((c) => !/\d\.\d/.test(c.mult)));
});

test('defaults read the live xp.js functions (Rebirth Rush: 5^R, gate LV 15 + 18R)', () => {
  const chips = rebirthLadder(1);
  assert.deepEqual(text(chips), ['BASE ×1', 'R1 ×5', 'R2 ×25 LV 33 +400%']);
});
