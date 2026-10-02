// wordSenseRefund.test.js — deleting a paid feature must not delete the player's money.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  refundWordSense, wordSenseRefundAmount, WORDSENSE_KEY, WORDSENSE_REFUND_KEY, WORDSENSE_MAX_TIER,
} from './wordSenseRefund.js';

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

// The FROZEN v8 KEY POWER ladder WORD SENSE was sold on. KEY POWER is re-priced in v9 (STEP 19), so
// the refund must NOT follow keyTierCostAt any more — it returns what was actually paid.
const PAID_V8 = [10, 60, 360, 2160, 12960]; // tiers 1..5

test('the refund is the sum of the frozen v8 prices actually paid', () => {
  assert.equal(wordSenseRefundAmount(0), 0);
  assert.equal(wordSenseRefundAmount(1), 10);
  assert.equal(wordSenseRefundAmount(2), 10 + 60);
  assert.equal(wordSenseRefundAmount(3), 10 + 60 + 360); // 430
  for (let t = 1; t <= WORDSENSE_MAX_TIER; t++) {
    const paid = PAID_V8.slice(0, t).reduce((a, b) => a + b, 0);
    assert.equal(wordSenseRefundAmount(t), paid, `tier ${t}`);
  }
  assert.equal(wordSenseRefundAmount(5), 15550); // the whole ladder
  // Clamped to the ladder's real length: a hand-edited tier cannot mint wins.
  assert.equal(wordSenseRefundAmount(99), wordSenseRefundAmount(WORDSENSE_MAX_TIER));
  assert.equal(wordSenseRefundAmount(-4), 0);
  assert.equal(wordSenseRefundAmount(undefined), 0);
});

test('the refund is the v8 prices actually PAID — its own table, whatever the live KEY POWER price is', () => {
  // KEY POWER is back on v8 prices (Andy oct2 KP2), so live and paid coincide again; the refund still
  // reads its own fixed table (10 / 60 / 360 …), so a future price change can never move it.
  assert.equal(wordSenseRefundAmount(1), 10);
  assert.equal(wordSenseRefundAmount(3), 430);
});

test('a player who bought tiers gets every win back, and the tier key is cleared', () => {
  withStorage({ 'taw.wordsense': '3', 'taw.wins': '1000', 'taw.winsLifetime': '50000' }, (map) => {
    const paid = refundWordSense();
    assert.equal(paid, 430); // 10 + 60 + 360, the v8 prices paid for T1..T3
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
