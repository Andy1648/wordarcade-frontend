// pillFit.test.js — NIGHT oct8 #1a: the WINS / GEMS pill never lets its figure leave the box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatShort, setNumberStyle, formatNum } from '../../format.js';

test('formatShort always abbreviates, even in the FULL number style', () => {
  setNumberStyle('full');
  try {
    assert.equal(formatNum(999999999), '999,999,999'); // the setting still holds elsewhere
    assert.equal(formatShort(999999999), '1B');
    assert.equal(formatShort(1280000), '1.28M');
    assert.equal(formatShort(9999), '9,999');
    for (const n of [0, 9999, 10000, 999499, 999999999, 123456789012, 1e18, 1e30]) {
      assert.ok(formatShort(n).length <= 6, `${n} → ${formatShort(n)} fits a pill`);
    }
  } finally {
    setNumberStyle('short');
  }
});
