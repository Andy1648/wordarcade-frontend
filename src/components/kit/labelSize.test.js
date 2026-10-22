import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelClass } from './labelSize.js';

test('a drawn size maps to its own class', () => {
  for (const s of [24, 30, 34, 38]) assert.equal(labelClass(s), `kb-fs${s}`);
});

test('an in-between size rounds DOWN, never up to 38', () => {
  assert.equal(labelClass(32), 'kb-fs30');
  assert.equal(labelClass(28), 'kb-fs24');
  assert.equal(labelClass(36), 'kb-fs34');
  assert.equal(labelClass(44), 'kb-fs38');
  assert.equal(labelClass(12), 'kb-fs24');
});

test('no size given keeps the caller default', () => {
  assert.equal(labelClass(undefined), 'kb-fs38');
  assert.equal(labelClass(undefined, 30), 'kb-fs30');
});
