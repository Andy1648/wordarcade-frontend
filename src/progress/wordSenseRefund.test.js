// wordSenseRefund.test.js — deleting a paid feature must not delete the player's money.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  refundWordSense, wordSenseRefundAmount, WORDSENSE_KEY, WORDSENSE_REFUND_KEY,
} from './wordSenseRefund.js';
import { keyTierCostAt } from './xp.js';

function withStorage(seed, fn, { throwOnSet = false } = {}) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (throwOnSet) throw new Error('blocked');
      map.set(k, String(v));
    },
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn(map);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}

test('the refund is the sum of the prices actually paid, off the real ladder', () => {
  assert.equal(wordSenseRefundAmount(0), 0);
  assert.equal(wordSenseRefundAmount(1), keyTierCostAt(1));
  assert.equal(wordSenseRefundAmount(3), keyTierCostAt(1) + keyTierCostAt(2) + keyTierCostAt(3));
  // Clamped to the ladder's real length: a hand-edited tier cannot mint wins.
  assert.equal(wordSenseRefundAmount(99), wordSenseRefundAmount(5));
  assert.equal(wordSenseRefundAmount(-4), 0);
  assert.equal(wordSenseRefundAmount(undefined), 0);
});

test('a player who bought tiers gets every win back, and the tier key is cleared', () => {
  withStorage({ 'taw.wordsense': '3', 'taw.wins': '1000', 'taw.winsLifetime': '50000' }, (map) => {
    const paid = refundWordSense();
    assert.equal(paid, wordSenseRefundAmount(3));
    assert.equal(Number(map.get('taw.wins')), 1000 + paid);
    assert.equal(map.get(WORDSENSE_KEY), undefined, 'the dead tier key is removed');
    assert.equal(map.get(WORDSENSE_REFUND_KEY), '1');
    // LIFETIME IS UNTOUCHED. It records what was EARNED; a refund is not earnings, and inflating
    // it would corrupt every achievement gated on lifetime wins.
    assert.equal(map.get('taw.winsLifetime'), '50000');
  });
});

test('IT ONLY EVER RUNS ONCE — this is called on every boot', () => {
  withStorage({ 'taw.wordsense': '2', 'taw.wins': '0' }, (map) => {
    const first = refundWordSense();
    assert.ok(first > 0);
    const after = Number(map.get('taw.wins'));
    // Re-seed the tier by hand: even then, the marker stops a second credit.
    map.set('taw.wordsense', '2');
    assert.equal(refundWordSense(), 0);
    assert.equal(Number(map.get('taw.wins')), after);
  });
});

test('a player who never bought it is credited nothing and is marked done', () => {
  withStorage({ 'taw.wins': '500' }, (map) => {
    assert.equal(refundWordSense(), 0);
    assert.equal(Number(map.get('taw.wins')), 500);
    assert.equal(map.get(WORDSENSE_REFUND_KEY), '1', 'marked so it stops looking every boot');
  });
  // Tier 0 explicitly stored is the same case.
  withStorage({ 'taw.wordsense': '0', 'taw.wins': '500' }, (map) => {
    assert.equal(refundWordSense(), 0);
    assert.equal(Number(map.get('taw.wins')), 500);
  });
});

test('a blocked store never throws and never half-credits', () => {
  // setItem throws: the credit cannot land and neither can the marker, so the refund is simply
  // retried on the next boot from the same tier value — the failure mode is a retry, not a loss
  // and not a double credit.
  assert.doesNotThrow(() => {
    withStorage({ 'taw.wordsense': '3', 'taw.wins': '10' }, () => refundWordSense(), { throwOnSet: true });
  });
  const saved = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  try {
    assert.equal(refundWordSense(), 0);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
});
