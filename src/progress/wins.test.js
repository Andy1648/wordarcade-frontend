// node --test — the WINS currency model: the payout formula, the independent balance vs
// lifetime totals, the per-mode round counters (gated on >=3 words), and storage safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  awardWins,
  recordRound,
  roundWinsEstimate,
  grantWins,
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

test('awardWins: CHAIN pays 3× and FUSE 5× the base payout', () => {
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'chain' }), 48); // 16 × 3
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'fuse' }), 80); // 16 × 5
  assert.equal(awardWins({ wordsAccepted: 2, mode: 'fuse' }), 0); // still gated on <3
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'word-bomb' }), 16); // other modes ×1
});

test('awardWins: difficulty scales the payout (chill 1.0 / easy 1.25 / medium 1.5 / hard 2.0)', () => {
  // A 10-word round is 30 at the base; the difficulty tier scales it, rounded.
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'chill' }), 30); // ×1.0
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'easy' }), 38); // ×1.25 → 37.5
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'medium' }), 45); // ×1.5
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'hard' }), 60); // ×2.0
  // Difficulty stacks with the mode multiplier.
  assert.equal(awardWins({ wordsAccepted: 10, mode: 'chain', difficulty: 'hard' }), 180); // 30×2×3
  // Unknown / missing difficulty falls through to ×1, so base payouts are unchanged.
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'zzz' }), 30);
  assert.equal(awardWins({ wordsAccepted: 10 }), 30);
  // Still gated on <3 words regardless of difficulty.
  assert.equal(awardWins({ wordsAccepted: 2, difficulty: 'hard' }), 0);
});

test('roundWinsEstimate: the card preview — ~30 base, CHAIN ~90, FUSE ~150, scaled by difficulty', () => {
  assert.equal(roundWinsEstimate({ mode: 'word-bomb' }), 30);
  assert.equal(roundWinsEstimate({ mode: 'category-blitz' }), 30);
  assert.equal(roundWinsEstimate({ mode: 'chain' }), 90);
  assert.equal(roundWinsEstimate({ mode: 'fuse' }), 150);
  // Reflects a selected difficulty when one is passed.
  assert.equal(roundWinsEstimate({ mode: 'word-bomb', difficulty: 'hard' }), 60);
});

test('grantWins: adds to BOTH balance and lifetime; non-positive is a no-op', () => {
  withStorage(() => {
    assert.equal(grantWins(125), 125);
    assert.equal(getWins(), 125);
    assert.equal(getWinsLifetime(), 125);
    // Spending lowers the balance but not lifetime; a further grant adds to both.
    saveWins(20);
    assert.equal(grantWins(50), 70);
    assert.equal(getWins(), 70);
    assert.equal(getWinsLifetime(), 175);
    // Non-positive / non-finite grants change nothing and return the current balance.
    assert.equal(grantWins(0), 70);
    assert.equal(grantWins(-5), 70);
    assert.equal(getWinsLifetime(), 175);
  });
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
