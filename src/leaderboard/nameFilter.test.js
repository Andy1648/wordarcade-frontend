import test from 'node:test';
import assert from 'node:assert/strict';
import { isNameBlocked, nameVerdict, nameLeet, nameSquash } from './nameFilter.js';
import { NAME_VECTORS } from './nameVectors.js';

test('the shared truth table', () => {
  const wrong = NAME_VECTORS.filter(([n, b]) => isNameBlocked(n) !== b).map(([n, b]) => `${n} expected ${b ? 'BLOCKED' : 'clean'}`);
  assert.deepEqual(wrong, []);
});

test('leet + squash normalisation', () => {
  assert.equal(nameLeet('$h1t_L0rd!'), 'shitlordi');
  assert.equal(nameSquash('fuuuuck'), 'fuck');
});

test('shape: 3-16 of letters, digits, underscore', () => {
  assert.equal(nameVerdict('ab'), 'shape');
  assert.equal(nameVerdict('a'.repeat(17)), 'shape');
  assert.equal(nameVerdict('has space'), 'shape');
  assert.equal(nameVerdict('émile'), 'shape');
  assert.equal(nameVerdict('Word_Wizard_99'), 'ok');
  assert.equal(nameVerdict('sh1t'), 'blocked');
});
