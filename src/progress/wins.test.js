// node --test — the WINS currency model: the payout formula, the independent balance vs
// lifetime totals, the per-mode round counters (gated on >=3 words), and storage safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  awardWins,
  perWordWins,
  recordRound,
  bankWordWins,
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
  // R0 (rebirthCount 0) base rates — post-rebalance mults (sim/rebalance-2), live round keys.
  assert.equal(perWordWins({ mode: 'wordBomb', rebirthCount: 0 }), 40); // ×2
  assert.equal(perWordWins({ mode: 'blitz', rebirthCount: 0 }), 20); // ×1
  assert.equal(perWordWins({ mode: 'satRush', rebirthCount: 0 }), 10); // ×0.5
  assert.equal(perWordWins({ mode: 'chain', rebirthCount: 0 }), 30); // ×1.5
  assert.equal(perWordWins({ mode: 'fuse', rebirthCount: 0 }), 20); // ×1
  // Difficulty scales the per-word rate (no mode → ×1 base 20), still snapped to 10.
  assert.equal(perWordWins({ difficulty: 'medium', rebirthCount: 0 }), 30); // 20×1.5 → 30
  assert.equal(perWordWins({ difficulty: 'hard', rebirthCount: 0 }), 40); // 20×2 → 40
});

test('perWordWins: REBIRTH multiplies wins on the same ladder as XP', () => {
  // Word Bomb base 40 (×2) × rebirthMult: R1 ×1.5 → 60, R2 ×2 → 80, R3 ×2.5 → 100, R10 ×10 → 400.
  assert.equal(perWordWins({ mode: 'wordBomb', rebirthCount: 1 }), 60);
  assert.equal(perWordWins({ mode: 'wordBomb', rebirthCount: 2 }), 80);
  assert.equal(perWordWins({ mode: 'wordBomb', rebirthCount: 3 }), 100);
  assert.equal(perWordWins({ mode: 'wordBomb', rebirthCount: 10 }), 400);
  // FUSE (×1) at R5 (×3.5): 20×1×3.5 = 70.
  assert.equal(perWordWins({ mode: 'fuse', rebirthCount: 5 }), 70);
});

test('awardWins: <3 words pays 0; else wordsAccepted × per-word (R0: 3 -> 60, 10 -> 200)', () => {
  assert.equal(awardWins({ wordsAccepted: 2, rebirthCount: 0 }), 0);
  assert.equal(awardWins({ wordsAccepted: 3, rebirthCount: 0 }), 60); // 3 × 20
  assert.equal(awardWins({ wordsAccepted: 10, rebirthCount: 0 }), 200); // 10 × 20
  assert.equal(awardWins({ wordsAccepted: 0, rebirthCount: 0 }), 0);
});

test('awardWins: SAT ×0.5, CHAIN ×1.5, FUSE ×1, Word Bomb ×2 per word (R0)', () => {
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'satRush', rebirthCount: 0 }), 30); // 3 × 10 (SAT ×0.5)
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'chain', rebirthCount: 0 }), 90); // 3 × 30 (×1.5)
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'fuse', rebirthCount: 0 }), 60); // 3 × 20 (×1)
  assert.equal(awardWins({ wordsAccepted: 2, mode: 'fuse', rebirthCount: 0 }), 0); // still gated on <3
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'wordBomb', rebirthCount: 0 }), 120); // 3 × 40 (WB ×2)
});

test('awardWins: difficulty scales the per-word rate (chill/easy → 20, medium → 30, hard → 40)', () => {
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'chill', rebirthCount: 0 }), 200); // 10 × 20
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'easy', rebirthCount: 0 }), 200); // 20×1.25→20
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'medium', rebirthCount: 0 }), 300); // per-word 30
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'hard', rebirthCount: 0 }), 400); // per-word 40
  // Difficulty stacks with mode: chain hard per-word = round10(20×1.5×2)=60 → ×10 = 600.
  assert.equal(awardWins({ wordsAccepted: 10, mode: 'chain', difficulty: 'hard', rebirthCount: 0 }), 600);
  // Unknown / missing difficulty falls through to ×1.
  assert.equal(awardWins({ wordsAccepted: 10, difficulty: 'zzz', rebirthCount: 0 }), 200);
  assert.equal(awardWins({ wordsAccepted: 10, rebirthCount: 0 }), 200);
  assert.equal(awardWins({ wordsAccepted: 2, difficulty: 'hard', rebirthCount: 0 }), 0);
});

test('round/word estimates: card previews (per-word WB 40/blitz 20/SAT 10/chain 30/fuse 20)', () => {
  // wordWinsEstimate is the R0 BASE preview (never rebirth-scaled) shown on game cards, keyed by game.id.
  assert.equal(wordWinsEstimate({ mode: 'word-bomb' }), 40); // ×2
  assert.equal(wordWinsEstimate({ mode: 'category-blitz' }), 20); // ×1
  assert.equal(wordWinsEstimate({ mode: 'sat-rush' }), 10); // ×0.5
  assert.equal(wordWinsEstimate({ mode: 'chain' }), 30); // ×1.5
  assert.equal(wordWinsEstimate({ mode: 'fuse' }), 20); // ×1
  // roundWinsEstimate = a typical 10-word round (reads live rebirths → R0 here). NOTE 'word-bomb'
  // (hyphen) is NOT a WINS_MULT key (the live WB wins key is 'wordBomb'), so it falls to ×1 here;
  // this fn has no live caller and is exercised only as a pure unit.
  assert.equal(roundWinsEstimate({ mode: 'word-bomb', rebirthCount: 0 }), 200); // ×1 base
  assert.equal(roundWinsEstimate({ mode: 'chain', rebirthCount: 0 }), 300); // ×1.5
  assert.equal(roundWinsEstimate({ mode: 'fuse', rebirthCount: 0 }), 200); // ×1
  assert.equal(roundWinsEstimate({ mode: 'word-bomb', difficulty: 'hard', rebirthCount: 0 }), 400); // ×1 × hard 2
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
    // A payout raises BOTH (R0; Word Bomb ×2 → 40/word).
    recordRound({ mode: 'wordBomb', wordsAccepted: 5 }); // grants 5 × 40 = 200
    assert.equal(getWins(), 200);
    assert.equal(getWinsLifetime(), 200);
    // Spending lowers the balance but NEVER the lifetime total.
    saveWins(5); // spent 195
    assert.equal(getWins(), 5);
    assert.equal(getWinsLifetime(), 200);
    // Another payout adds to both from their current values.
    recordRound({ mode: 'blitz', wordsAccepted: 3 }); // grants 3 × 20 = 60 (blitz ×1)
    assert.equal(getWins(), 5 + 60);
    assert.equal(getWinsLifetime(), 200 + 60);
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

// ---- bankWordWins: per-word incremental banking (§2 — leaving mid-round keeps earned wins) ----
test('bankWordWins: words 1-2 bank nothing, word 3 banks 3× retroactively, words 4+ bank 1× each', () => {
  withStorage(() => {
    // Word 1 and 2: under the gate, nothing banks.
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 0, nowWords: 1 }), 0);
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 1, nowWords: 2 }), 0);
    assert.equal(getWins(), 0);
    // Word 3 crosses the gate → banks 3 × 40 = 120 retroactively (the first 3 words at once).
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 2, nowWords: 3 }), 120);
    assert.equal(getWins(), 120);
    assert.equal(getWinsLifetime(), 120);
    // Word 4, 5: each banks one more per-word (40, WB ×2).
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 3, nowWords: 4 }), 40);
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 4, nowWords: 5 }), 40);
    assert.equal(getWins(), 200); // == a full 5-word round: matches recordRound(5) exactly
  });
});

test('bankWordWins: the incremental sum equals recordRound for the same final count (no drift)', () => {
  // Walk 0→8 one word at a time; the running total must equal the single-shot recordRound(8).
  for (const mode of ['wordBomb', 'blitz', 'satRush', 'chain', 'fuse']) {
    let incremental = 0;
    withStorage(() => {
      for (let n = 1; n <= 8; n += 1) incremental += bankWordWins({ mode, prevWords: n - 1, nowWords: n });
      assert.equal(getWins(), incremental);
    });
    const oneShot = withStorage(() => recordRound({ mode, wordsAccepted: 8 }));
    assert.equal(incremental, oneShot, `mode ${mode}: per-word sum must equal recordRound(8)`);
  }
});

test('bankWordWins: mode multipliers + difficulty apply per word (SAT ×0.5, CHAIN ×1.5, FUSE ×1, hard 2×)', () => {
  withStorage(() => assert.equal(bankWordWins({ mode: 'satRush', prevWords: 2, nowWords: 3 }), 3 * 10));
  withStorage(() => assert.equal(bankWordWins({ mode: 'chain', prevWords: 2, nowWords: 3 }), 3 * 30));
  withStorage(() => assert.equal(bankWordWins({ mode: 'fuse', prevWords: 2, nowWords: 3 }), 3 * 20));
  // Word Bomb (×2) on HELL (hard ×2) → per-word round10(20×2×2)=80.
  withStorage(() => assert.equal(bankWordWins({ mode: 'wordBomb', difficulty: 'hard', prevWords: 3, nowWords: 4 }), 80));
});

test('bankWordWins: bumps the mode round counter ONCE (at the gate crossing), only for counter modes', () => {
  withStorage(() => {
    bankWordWins({ mode: 'wordBomb', prevWords: 1, nowWords: 2 }); // pre-gate: no count
    assert.equal(getRounds().wordBomb, 0);
    bankWordWins({ mode: 'wordBomb', prevWords: 2, nowWords: 3 }); // crosses → count once
    assert.equal(getRounds().wordBomb, 1);
    bankWordWins({ mode: 'wordBomb', prevWords: 3, nowWords: 4 }); // already counted → still 1
    bankWordWins({ mode: 'wordBomb', prevWords: 4, nowWords: 5 });
    assert.equal(getRounds().wordBomb, 1);
  });
  // CHAIN / FUSE have no round counter — banking never touches getRounds.
  withStorage(() => {
    bankWordWins({ mode: 'chain', prevWords: 2, nowWords: 5 });
    assert.deepEqual(getRounds(), { wordBomb: 0, blitz: 0, satRush: 0 });
  });
});

test('bankWordWins: a run that never reaches 3 words banks NOTHING and counts no round', () => {
  withStorage(() => {
    bankWordWins({ mode: 'blitz', prevWords: 0, nowWords: 1 });
    bankWordWins({ mode: 'blitz', prevWords: 1, nowWords: 2 });
    assert.equal(getWins(), 0);
    assert.equal(getWinsLifetime(), 0);
    assert.deepEqual(getRounds(), { wordBomb: 0, blitz: 0, satRush: 0 });
  });
});

// ---- CHAIN / FUSE run payouts (fix/ui-pass-5 item 1: the modes were never wired) ----
// A completed run grants words × 20 × modeMult × rebirthMult; a <3-word run grants 0. This is
// the payout the ChainGame/FuseGame run-over handlers now call via recordRound.
test('a completed CHAIN run grants links × 30 × rebirthMult; <3 grants 0', () => {
  withStorage(() => {
    // 7 links at R0: chain per-word = round10(20×1.5)=30 → 7 × 30 = 210.
    assert.equal(recordRound({ mode: 'chain', wordsAccepted: 7 }), 7 * 30);
    assert.equal(getWins(), 210);
  });
  withStorage(() => {
    localStorage.setItem('taw.rebirths', '3'); // R3 → ×2.5
    // chain per-word at R3 = round10(20×1.5×2.5)=round10(75)=80 → 5 × 80 = 400.
    assert.equal(recordRound({ mode: 'chain', wordsAccepted: 5 }), 400);
  });
  withStorage(() => {
    assert.equal(recordRound({ mode: 'chain', wordsAccepted: 2 }), 0); // <3 → nothing
    assert.equal(getWins(), 0);
  });
});

test('a completed FUSE run grants words × 20 × rebirthMult; <3 grants 0', () => {
  withStorage(() => {
    // 6 words at R0: fuse per-word = round10(20×1)=20 → 6 × 20 = 120.
    assert.equal(recordRound({ mode: 'fuse', wordsAccepted: 6 }), 6 * 20);
    assert.equal(getWins(), 120);
  });
  withStorage(() => {
    localStorage.setItem('taw.rebirths', '1'); // R1 → ×1.5
    // fuse per-word at R1 = round10(20×1.5)=30 → 4 × 30 = 120.
    assert.equal(recordRound({ mode: 'fuse', wordsAccepted: 4 }), 4 * 30);
  });
  withStorage(() => {
    assert.equal(recordRound({ mode: 'fuse', wordsAccepted: 2 }), 0); // <3 → nothing
    assert.equal(getWins(), 0);
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

// ---- bankWordWins: RARITY WEIGHT (word-value) — payout rides a cumulative rarity weight ----
// The gate stays on the COUNT; the payout is base per-word × the weight delta past the gate.
// Callers pass prevWeight/nowWeight (cumulative sum of each word's rarity multiplier).
test('bankWordWins: weight defaults to count → identical to pre-rarity payout when no weight passed', () => {
  withStorage(() => {
    // No weight args: word 3 banks 3×40=120, word 4 banks 40 — exactly the count-based behaviour.
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 2, nowWords: 3 }), 120);
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 3, nowWords: 4 }), 40);
  });
});

test('bankWordWins: the gate crossing releases the first three words RARITY RETROACTIVELY', () => {
  withStorage(() => {
    // Words 1,2,3 have mults 1.0, 2.5, 4.0 → cumulative weights 0→1, 1→3.5, 3.5→7.5.
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 0, nowWords: 1, prevWeight: 0, nowWeight: 1.0 }), 0); // pre-gate
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 1, nowWords: 2, prevWeight: 1.0, nowWeight: 3.5 }), 0); // pre-gate
    // Word 3 crosses the gate: releases the WHOLE cumulative weight 7.5 → round10(40×7.5)=300 (WB ×2).
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 2, nowWords: 3, prevWeight: 3.5, nowWeight: 7.5 }), 300);
    assert.equal(getWins(), 300);
  });
});

test('bankWordWins: words 4+ each release exactly their own rarity weight', () => {
  withStorage(() => {
    // Already past the gate (prev count 3). Word 4 is OBSCURE ×4 → round10(40×4)=160 (WB ×2).
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 7 }), 160);
    // Word 5 is UNCOMMON ×1.5 → round10(40×1.5)=60.
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 4, nowWords: 5, prevWeight: 7, nowWeight: 8.5 }), 60);
  });
});

test('bankWordWins: rarity STACKS with the mode multiplier (FUSE ×15 × OBSCURE ×4 per word)', () => {
  withStorage(() => {
    // FUSE per-word base = 20 (×1); an OBSCURE word (weight 4) past the gate → round10(20×4)=80.
    assert.equal(bankWordWins({ mode: 'fuse', prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 7 }), 80);
  });
});

test('bankWordWins: rarity STACKS with rebirth (CHAIN ×10 × R3 ×2.5 × RARE ×2.5 per word)', () => {
  withStorage(() => {
    // CHAIN base at R3 = round10(20×1.5×2.5)=round10(75)=80; a RARE word (weight 2.5) → round10(80×2.5)=200.
    assert.equal(
      bankWordWins({ mode: 'chain', prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 5.5, rebirthCount: 3 }),
      200
    );
  });
});
