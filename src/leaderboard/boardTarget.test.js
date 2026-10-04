import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTarget, targetLine, standingText } from './boardTarget.js';

const rows = [
  { rank: 1, level: 195 }, { rank: 2, level: 168 }, { rank: 3, level: 156 }, { rank: 4, level: 60 },
];

test('the next target is the row directly above you', () => {
  assert.deepEqual(nextTarget(rows, { rank: 4, level: 60 }), { rank: 3, rebirths: 0, levels: 96 });
  assert.equal(targetLine(rows, { rank: 4, level: 60 }), '96 LEVELS TO #3');
  assert.equal(targetLine(rows, { rank: 4, level: 60 }, { short: true }), '96 LV TO #3');
  assert.equal(targetLine(rows, { rank: 3, level: 167 }), '1 LEVEL TO #2');
});

test('#1 holds; a level tie says words decide', () => {
  assert.equal(nextTarget(rows, { rank: 1, level: 195 }), null);
  assert.equal(targetLine(rows, { rank: 1, level: 195 }), 'YOU’RE #1. HOLD IT.');
  assert.equal(targetLine(rows, { rank: 1, level: 195 }, { short: true }), 'HOLD #1');
  assert.equal(targetLine(rows, { rank: 2, level: 195 }), 'LEVEL-TIED WITH #1 · MORE WORDS TAKE IT');
  assert.equal(targetLine(rows, { rank: 2, level: 195 }, { short: true }), 'TIED WITH #1');
});

test('off the board, the target is the last loaded row', () => {
  assert.deepEqual(nextTarget(rows, { rank: 12, level: 20 }), { rank: 4, rebirths: 0, levels: 40 });
  assert.equal(nextTarget([], { rank: 12, level: 20 }), null);
  assert.equal(targetLine(rows, null), '');
});

test('rebirths come first: a row with more rebirths is a REBIRTH gap, not a level gap', () => {
  const rb = [{ rank: 1, rebirths: 8, level: 16 }, { rank: 2, rebirths: 2, level: 900 }, { rank: 3, rebirths: 2, level: 40 }];
  assert.deepEqual(nextTarget(rb, { rank: 2, rebirths: 2, level: 900 }), { rank: 1, rebirths: 6, levels: 0 });
  assert.equal(targetLine(rb, { rank: 2, rebirths: 2, level: 900 }), '6 REBIRTHS TO #1');
  assert.equal(targetLine(rb, { rank: 2, rebirths: 2, level: 900 }, { short: true }), '6 RB TO #1');
  assert.equal(targetLine(rb, { rank: 2, rebirths: 7, level: 999 }), '1 REBIRTH TO #1');
  assert.equal(targetLine(rb, { rank: 3, rebirths: 2, level: 40 }), '860 LEVELS TO #2');
});

test('standingText: "R8 · LV16"; R0 shows just the level; numbers go through formatNum', () => {
  assert.equal(standingText(8, 16), 'R8 · LV16');
  assert.equal(standingText(0, 16), 'LV16');
  assert.equal(standingText(undefined, undefined), 'LV1');
  assert.equal(standingText(1, 12345), 'R1 · LV12.3K');
});
