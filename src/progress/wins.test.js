// node --test — the WINS currency model: the payout formula, the independent balance vs
// lifetime totals, the per-mode round counters (gated on >=3 words), and storage safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  awardWins,
  recordRound,
  getWins,
  saveWins,
  getWinsLifetime,
  saveWinsLifetime,
  getRounds,
} from './wins.js';

// A fresh in-memory localStorage per test, installed as the global.
function withStorage(fn, opts = {}) {
  const saved = globalThis.localStorage;
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => {
      if (opts.throwOnGet) throw new Error('blocked');
      return map.has(k) ? map.get(k) : null;
    },
    setItem: (k, v) => {
      if (opts.throwOnSet) throw new Error('blocked');
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

test('awardWins: <3 words pays 0; 3 -> 16; 10 -> 30', () => {
  assert.equal(awardWins({ wordsAccepted: 2 }), 0);
  assert.equal(awardWins({ wordsAccepted: 3 }), 16);
  assert.equal(awardWins({ wordsAccepted: 10 }), 30);
  assert.equal(awardWins({ wordsAccepted: 0 }), 0);
});

test('wins balance and winsLifetime move independently', () => {
  withStorage(() => {
    // A payout raises BOTH.
    recordRound({ mode: 'wordBomb', wordsAccepted: 5 }); // grants 20
    assert.equal(getWins(), 20);
    assert.equal(getWinsLifetime(), 20);
    // Spending lowers the balance but NEVER the lifetime total.
    saveWins(5); // spent 15
    assert.equal(getWins(), 5);
    assert.equal(getWinsLifetime(), 20);
    // Another payout adds to both from their current values.
    recordRound({ mode: 'blitz', wordsAccepted: 3 }); // grants 16
    assert.equal(getWins(), 5 + 16);
    assert.equal(getWinsLifetime(), 20 + 16);
  });
});

test('a round that ends with <3 words does not increment the mode round counter (or pay)', () => {
  withStorage(() => {
    const granted = recordRound({ mode: 'wordBomb', wordsAccepted: 2 });
    assert.equal(granted, 0);
    assert.deepEqual(getRounds(), { wordBomb: 0, blitz: 0, satRush: 0 });
    // A >=3 round DOES count.
    recordRound({ mode: 'wordBomb', wordsAccepted: 4 });
    assert.equal(getRounds().wordBomb, 1);
    assert.equal(getRounds().blitz, 0);
  });
});

test('localStorage failure defaults to 0 and does not throw', () => {
  withStorage(
    () => {
      assert.equal(getWins(), 0);
      assert.equal(getWinsLifetime(), 0);
      assert.deepEqual(getRounds(), { wordBomb: 0, blitz: 0, satRush: 0 });
      assert.doesNotThrow(() => saveWins(9));
      assert.doesNotThrow(() => saveWinsLifetime(9));
      assert.doesNotThrow(() => recordRound({ mode: 'satRush', wordsAccepted: 8 }));
    },
    { throwOnGet: true, throwOnSet: true }
  );
});
