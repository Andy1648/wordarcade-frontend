// topPercent.test.js — YOUR row's "TOP n%" (Andy oct17): rounded up, floor 1%, nothing when unknown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { topPercent } from './client.js';

test('TOP n%: rounded up, never below 1%, null when the count is unknown or the rank is off the board', () => {
  assert.equal(topPercent(1, 4000), 1);
  assert.equal(topPercent(41, 4000), 2);
  assert.equal(topPercent(400, 4000), 10);
  assert.equal(topPercent(401, 4000), 11);
  assert.equal(topPercent(4000, 4000), 100);
  assert.equal(topPercent(12, null), null);
  assert.equal(topPercent(12, 0), null);
  assert.equal(topPercent(50, 10), null);
});
