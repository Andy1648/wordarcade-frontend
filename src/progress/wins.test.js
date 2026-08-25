// node --test — the WINS currency model: the payout formula, the independent balance vs
// lifetime totals, the per-mode round counters (gated on >=3 words), and storage safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  awardWins,
  perWordWins,
  recordRound,
  roundWinsEstimate,
  wordWinsEstimate,
  grantWins,
  getWins,
  saveWins,
  getWinsLifetime,
  saveWinsLifetime,
  getRounds,
} from './wins.js';
import { POP_STYLES, SOUND_PACKS } from './shop.js';
import { keyPowerCost } from './xp.js';

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

test('perWordWins: 10 base × mode, snapped to a round 10 (Economy v5)', () => {
  assert.equal(perWordWins({ mode: 'word-bomb' }), 10);
  assert.equal(perWordWins({ mode: 'satRush' }), 20); // ×2
  assert.equal(perWordWins({ mode: 'chain' }), 30); // ×3
  assert.equal(perWordWins({ mode: 'fuse' }), 50); // ×5
  // Difficulty scales the per-word rate, still snapped to 10.
  assert.equal(perWordWins({ difficulty: 'medium' }), 20); // 10×1.5 → 20
  assert.equal(perWordWins({ difficulty: 'hard' }), 20); // 10×2 → 20
});

test('awardWins: <3 words pays 0; else wordsAccepted × per-word (3 -> 30, 10 -> 100)', () => {
  assert.equal(awardWins({ wordsAccepted: 2 }), 0);
  assert.equal(awardWins({ wordsAccepted: 3 }), 30); // 3 × 10
  assert.equal(awardWins({ wordsAccepted: 10 }), 100); // 10 × 10
  assert.equal(awardWins({ wordsAccepted: 0 }), 0);
});

test('awardWins: SAT Rush pays 2×, CHAIN 3×, FUSE 5× per word', () => {
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'satRush' }), 60); // 3 × 20
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'chain' }), 90); // 3 × 30
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'fuse' }), 150); // 3 × 50
  assert.equal(awardWins({ wordsAccepted: 2, mode: 'fuse' }), 0); // still gated on <3
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'word-bomb' }), 30); // other modes ×1
});

test('awardWins: difficulty scales the per-word rate (chill/easy → 10, medium/hard → 20)', () => {
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'chill' }), 100); // 10 × 10
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'easy' }), 100); // 10×1.25 → per-word 10
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'medium' }), 200); // per-word 20
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'hard' }), 200); // per-word 20
  // Difficulty stacks with the mode multiplier: chain hard per-word = 10×3×2 → 60.
  assert.equal(awardWins({ wordsAccepted: 10, mode: 'chain', difficulty: 'hard' }), 600);
  // Unknown / missing difficulty falls through to ×1.
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'zzz' }), 100);
  assert.equal(awardWins({ wordsAccepted: 10 }), 100);
  assert.equal(awardWins({ wordsAccepted: 2, difficulty: 'hard' }), 0);
});

test('round/word estimates: card previews (per-word 10/20/30/50; per-round ×10 words)', () => {
  assert.equal(wordWinsEstimate({ mode: 'word-bomb' }), 10);
  assert.equal(wordWinsEstimate({ mode: 'category-blitz' }), 10);
  assert.equal(wordWinsEstimate({ mode: 'chain' }), 30);
  assert.equal(wordWinsEstimate({ mode: 'fuse' }), 50);
  assert.equal(roundWinsEstimate({ mode: 'word-bomb' }), 100);
  assert.equal(roundWinsEstimate({ mode: 'chain' }), 300);
  assert.equal(roundWinsEstimate({ mode: 'fuse' }), 500);
  assert.equal(roundWinsEstimate({ mode: 'word-bomb', difficulty: 'hard' }), 200);
});

test('EVERYTHING ENDS IN A ZERO: every catalog price and every payout is divisible by 10', () => {
  // Shop cosmetics.
  for (const item of [...POP_STYLES, ...SOUND_PACKS]) {
    assert.equal(item.price % 10, 0, `${item.id} price ${item.price}`);
  }
  // Key Power costs across a wide sweep.
  for (let lv = 0; lv <= 80; lv++) assert.equal(keyPowerCost(lv) % 10, 0, `keyPowerCost(${lv})`);
  // Every wins payout across modes × difficulties × word counts.
  const modes = [undefined, 'word-bomb', 'wordBomb', 'blitz', 'satRush', 'chain', 'fuse'];
  const diffs = [undefined, 'chill', 'easy', 'medium', 'hard', 'zzz'];
  for (const mode of modes) {
    for (const difficulty of diffs) {
      assert.equal(perWordWins({ mode, difficulty }) % 10, 0, `perWord ${mode}/${difficulty}`);
      for (let w = 0; w <= 40; w++) {
        assert.equal(awardWins({ wordsAccepted: w, mode, difficulty }) % 10, 0, `award ${mode}/${difficulty}/${w}`);
      }
    }
  }
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
    recordRound({ mode: 'wordBomb', wordsAccepted: 5 }); // grants 5 × 10 = 50
    assert.equal(getWins(), 50);
    assert.equal(getWinsLifetime(), 50);
    // Spending lowers the balance but NEVER the lifetime total.
    saveWins(5); // spent 45
    assert.equal(getWins(), 5);
    assert.equal(getWinsLifetime(), 50);
    // Another payout adds to both from their current values.
    recordRound({ mode: 'blitz', wordsAccepted: 3 }); // grants 3 × 10 = 30
    assert.equal(getWins(), 5 + 30);
    assert.equal(getWinsLifetime(), 50 + 30);
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
