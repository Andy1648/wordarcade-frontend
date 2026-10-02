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

// ---- STEP 51: Chinese names ----------------------------------------------------------------------
import { nameVerdict as _nv, CJK_TERMS as _cjk } from './nameFilter.js';
test('CJK names are allowed only when the DB supports them, and the Chinese blocklist bites', () => {
  assert.equal(_nv('小明'), 'shape', 'old DB: ASCII only');
  assert.equal(_nv('小明', { cjk: true }), 'ok');
  assert.equal(_nv('小明abc', { cjk: true }), 'ok');
  assert.equal(_nv('明', { cjk: true }), 'shape', 'too short');
  assert.equal(_nv('一二三四五六七八九十一二三', { cjk: true }), 'shape', 'too long');
  assert.equal(_nv('傻逼王', { cjk: true }), 'blocked');
  assert.equal(_nv('xx草泥马', { cjk: true }), 'blocked');
  assert.ok(_cjk.length >= 40);
  assert.equal(_nv('abc', { cjk: true }), 'ok', 'ASCII still works');
});
