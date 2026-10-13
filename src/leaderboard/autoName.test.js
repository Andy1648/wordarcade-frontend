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
