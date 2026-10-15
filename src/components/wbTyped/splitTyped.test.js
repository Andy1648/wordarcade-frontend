import test from 'node:test';
import assert from 'node:assert/strict';
import { splitTyped } from './splitTyped.js';

test('Andy\'s example: FA — "f" lights F, "fg" moves both letters in front', () => {
  assert.deepEqual(splitTyped('f', 'fa'), { pre: '', lit: 1, post: '', hit: false });
  assert.deepEqual(splitTyped('fg', 'fa'), { pre: 'FG', lit: 0, post: '', hit: false });
  assert.deepEqual(splitTyped('fgf', 'fa'), { pre: 'FG', lit: 1, post: '', hit: false });
});
test('the fragment inside the word lights fully, with letters on both sides', () => {
  assert.deepEqual(splitTyped('strong', 'ro'), { pre: 'ST', lit: 2, post: 'NG', hit: true });
  assert.deepEqual(splitTyped('ing', 'ING'), { pre: '', lit: 3, post: '', hit: true });
  assert.deepEqual(splitTyped('rin', 'ing'), { pre: 'R', lit: 2, post: '', hit: false });
});
test('empty input / empty fragment', () => {
  assert.deepEqual(splitTyped('', 'ing'), { pre: '', lit: 0, post: '', hit: false });
  assert.deepEqual(splitTyped('abc', ''), { pre: 'ABC', lit: 0, post: '', hit: false });
});
