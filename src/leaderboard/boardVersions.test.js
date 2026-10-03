import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardVersion, nextTarget, targetLine } from './boardVersions.js';

test('?lbv= picks a version, defaulting to the podium', () => {
  assert.equal(boardVersion(''), 'a');
  assert.equal(boardVersion('?lbv=b'), 'b');
  assert.equal(boardVersion('?portal=1&lbv=C'), 'c');
  assert.equal(boardVersion('?lbv=z'), 'a');
  assert.equal(boardVersion(undefined), 'a');
});

const rows = [
  { rank: 1, level: 195 }, { rank: 2, level: 168 }, { rank: 3, level: 156 }, { rank: 4, level: 60 },
];

test('the next target is the row directly above you', () => {
  assert.deepEqual(nextTarget(rows, { rank: 4, level: 60 }), { rank: 3, levels: 96 });
  assert.equal(targetLine(rows, { rank: 4, level: 60 }), '96 LEVELS TO #3');
  assert.equal(targetLine(rows, { rank: 3, level: 167 }), '1 LEVEL TO #2');
});

test('#1 holds; a level tie says words decide', () => {
  assert.equal(nextTarget(rows, { rank: 1, level: 195 }), null);
  assert.equal(targetLine(rows, { rank: 1, level: 195 }), 'YOU’RE #1. HOLD IT.');
  assert.equal(targetLine(rows, { rank: 2, level: 195 }), 'LEVEL-TIED WITH #1 · MORE WORDS TAKE IT');
});

test('off the board, the target is the last loaded row', () => {
  assert.deepEqual(nextTarget(rows, { rank: 12, level: 20 }), { rank: 4, levels: 40 });
  assert.equal(nextTarget([], { rank: 12, level: 20 }), null);
  assert.equal(targetLine(rows, null), '');
});
