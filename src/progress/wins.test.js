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
import { keyTierCostAt } from './xp.js';

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

test('perWordWins: 20 base × mode × rebirth, snapped to a round 10 (Economy v6)', () => {
  // R0 (rebirthCount 0) base rates.
  assert.equal(perWordWins({ mode: 'word-bomb', rebirthCount: 0 }), 20);
  assert.equal(perWordWins({ mode: 'satRush', rebirthCount: 0 }), 100); // ×5
  assert.equal(perWordWins({ mode: 'chain', rebirthCount: 0 }), 200); // ×10
  assert.equal(perWordWins({ mode: 'fuse', rebirthCount: 0 }), 300); // ×15
  // Difficulty scales the per-word rate, still snapped to 10.
  assert.equal(perWordWins({ difficulty: 'medium', rebirthCount: 0 }), 30); // 20×1.5 → 30
  assert.equal(perWordWins({ difficulty: 'hard', rebirthCount: 0 }), 40); // 20×2 → 40
});

test('perWordWins: REBIRTH multiplies wins on the same ladder as XP', () => {
  // Word Bomb base 20 × rebirthMult: R1 ×1.5 → 30, R2 ×2 → 40, R3 ×2.5 → 50, R10 ×10 → 200.
  assert.equal(perWordWins({ mode: 'word-bomb', rebirthCount: 1 }), 30);
  assert.equal(perWordWins({ mode: 'word-bomb', rebirthCount: 2 }), 40);
  assert.equal(perWordWins({ mode: 'word-bomb', rebirthCount: 3 }), 50);
  assert.equal(perWordWins({ mode: 'word-bomb', rebirthCount: 10 }), 200);
  // FUSE (×15) at R5 (×3.5): 20×15×3.5 = 1050.
  assert.equal(perWordWins({ mode: 'fuse', rebirthCount: 5 }), 1050);
});

test('awardWins: <3 words pays 0; else wordsAccepted × per-word (R0: 3 -> 60, 10 -> 200)', () => {
  assert.equal(awardWins({ wordsAccepted: 2, rebirthCount: 0 }), 0);
  assert.equal(awardWins({ wordsAccepted: 3, rebirthCount: 0 }), 60); // 3 × 20
  assert.equal(awardWins({ wordsAccepted: 10, rebirthCount: 0 }), 200); // 10 × 20
  assert.equal(awardWins({ wordsAccepted: 0, rebirthCount: 0 }), 0);
});

test('awardWins: SAT Rush pays 5×, CHAIN 10×, FUSE 15× per word (R0)', () => {
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'satRush', rebirthCount: 0 }), 300); // 3 × 100
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'chain', rebirthCount: 0 }), 600); // 3 × 200
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'fuse', rebirthCount: 0 }), 900); // 3 × 300
  assert.equal(awardWins({ wordsAccepted: 2, mode: 'fuse', rebirthCount: 0 }), 0); // still gated on <3
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'word-bomb', rebirthCount: 0 }), 60); // other modes ×1
});

test('awardWins: difficulty scales the per-word rate (chill/easy → 20, medium → 30, hard → 40)', () => {
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'chill', rebirthCount: 0 }), 200); // 10 × 20
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'easy', rebirthCount: 0 }), 200); // 20×1.25→20
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'medium', rebirthCount: 0 }), 300); // per-word 30
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'hard', rebirthCount: 0 }), 400); // per-word 40
  // Difficulty stacks with mode: chain hard per-word = 20×10×2 → 400.
  assert.equal(awardWins({ wordsAccepted: 10, mode: 'chain', difficulty: 'hard', rebirthCount: 0 }), 4000);
  // Unknown / missing difficulty falls through to ×1.
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'zzz', rebirthCount: 0 }), 200);
  assert.equal(awardWins({ wordsAccepted: 10, rebirthCount: 0 }), 200);
  assert.equal(awardWins({ wordsAccepted: 2, difficulty: 'hard', rebirthCount: 0 }), 0);
});

test('round/word estimates: card previews (per-word 20/100/200/300; per-round ×10 words)', () => {
  // wordWinsEstimate is the R0 BASE preview (never rebirth-scaled) shown on game cards.
  assert.equal(wordWinsEstimate({ mode: 'word-bomb' }), 20);
  assert.equal(wordWinsEstimate({ mode: 'category-blitz' }), 20);
  assert.equal(wordWinsEstimate({ mode: 'sat-rush' }), 100);
  assert.equal(wordWinsEstimate({ mode: 'chain' }), 200);
  assert.equal(wordWinsEstimate({ mode: 'fuse' }), 300);
  // roundWinsEstimate = a typical 10-word round (reads live rebirths → R0 here).
  assert.equal(roundWinsEstimate({ mode: 'word-bomb', rebirthCount: 0 }), 200);
  assert.equal(roundWinsEstimate({ mode: 'chain', rebirthCount: 0 }), 2000);
  assert.equal(roundWinsEstimate({ mode: 'fuse', rebirthCount: 0 }), 3000);
  assert.equal(roundWinsEstimate({ mode: 'word-bomb', difficulty: 'hard', rebirthCount: 0 }), 400);
});

test('EVERYTHING ENDS IN A ZERO: every catalog price, tier cost and payout is divisible by 10', () => {
  // Shop cosmetics.
  for (const item of [...POP_STYLES, ...SOUND_PACKS]) {
    assert.equal(item.price % 10, 0, `${item.id} price ${item.price}`);
  }
  // Key Power TIER costs across the exact-integer range.
  for (let t = 0; t <= 15; t++) assert.equal(keyTierCostAt(t) % 10, 0, `keyTierCostAt(${t})`);
  // Every wins payout across modes × difficulties × rebirths × word counts.
  const modes = [undefined, 'word-bomb', 'wordBomb', 'blitz', 'satRush', 'chain', 'fuse'];
  const diffs = [undefined, 'chill', 'easy', 'medium', 'hard', 'zzz'];
  const rebirths = [0, 1, 2, 3, 5, 10, 15];
  for (const mode of modes) {
    for (const difficulty of diffs) {
      for (const rebirthCount of rebirths) {
        assert.equal(perWordWins({ mode, difficulty, rebirthCount }) % 10, 0, `perWord ${mode}/${difficulty}/R${rebirthCount}`);
        for (let w = 0; w <= 20; w++) {
          assert.equal(awardWins({ wordsAccepted: w, mode, difficulty, rebirthCount }) % 10, 0, `award ${mode}/${difficulty}/R${rebirthCount}/${w}`);
        }
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
    // A payout raises BOTH (R0, base 20/word).
    recordRound({ mode: 'wordBomb', wordsAccepted: 5 }); // grants 5 × 20 = 100
    assert.equal(getWins(), 100);
    assert.equal(getWinsLifetime(), 100);
    // Spending lowers the balance but NEVER the lifetime total.
    saveWins(5); // spent 95
    assert.equal(getWins(), 5);
    assert.equal(getWinsLifetime(), 100);
    // Another payout adds to both from their current values.
    recordRound({ mode: 'blitz', wordsAccepted: 3 }); // grants 3 × 20 = 60
    assert.equal(getWins(), 5 + 60);
    assert.equal(getWinsLifetime(), 100 + 60);
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
