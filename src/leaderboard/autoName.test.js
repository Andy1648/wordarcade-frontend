import test from 'node:test';
import assert from 'node:assert/strict';
import { firstName } from './autoName.js';

test('autoName: the multiplayer name when the board would take it, else a generated 3–16 char handle', () => {
  const gen = () => 'NEONGOBLIN42';
  assert.equal(firstName('Andy_99', gen), 'Andy_99');
  assert.equal(firstName('', gen), 'NEONGOBLIN42');
  assert.equal(firstName('no spaces allowed', gen), 'NEONGOBLIN42');
  assert.equal(firstName('ab', gen), 'NEONGOBLIN42', 'too short for the board');
  assert.equal(firstName('x', () => 'COSMICGREMLIN99X').length <= 16, true);
});

import { syncBoardName } from './autoName.js';

test('syncBoardName: renames the board row only for a NEW board-shaped name', () => {
  const calls = [];
  const claim = (n) => { calls.push(n); return Promise.resolve({ username: n }); };
  const profile = () => ({ username: 'OldName' });
  assert.equal(syncBoardName('NewName', { claim, profile, enabled: true }), true);
  assert.equal(syncBoardName('oldname', { claim, profile, enabled: true }), false, 'same name, different case');
  assert.equal(syncBoardName('no spaces allowed', { claim, profile, enabled: true }), false, 'board shape');
  assert.equal(syncBoardName('Fine_1', { claim, profile: () => null, enabled: true }), false, 'no board row yet');
  assert.deepEqual(calls, ['NewName']);
});
