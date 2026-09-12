// node --test — the WINS currency model: the payout formula, the independent balance vs
// lifetime totals, the per-mode round counters (gated on >=3 words), and storage safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORD_WINS_BASE,
  WIN_LEVEL_STEP,
  winLevelMult,
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
import { keyTierCostAt, rebirthMult, round10 } from './xp.js';

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

// UPDATED FOR ECONOMY v7. Every figure below was the v6 base of 20; the base is 100 now
// (Andy: "the wins base is too low"), so the R0/LV1 rates are exactly 5× what they were. The
// SHAPE of the formula is unchanged - mode × difficulty × rebirth × momentum, snapped to 10 -
// and the assertions are written against WORD_WINS_BASE and rebirthMult rather than against
// literals wherever the point is the RELATIONSHIP, so the next retune does not rewrite them.
test('perWordWins: 100 base × mode × difficulty, snapped to a round 10 (Economy v7)', () => {
  const B = WORD_WINS_BASE;
  assert.equal(B, 100, 'v7 raised the per-word base from 20');
  // R0 / LV1 base rates — post-rebalance mults (sim/rebalance-2), live round keys.
  assert.equal(perWordWins({ mode: 'wordBomb', rebirthCount: 0, level: 1 }), round10(B * 2)); // 200
  assert.equal(perWordWins({ mode: 'blitz', rebirthCount: 0, level: 1 }), round10(B * 1)); // 100
  assert.equal(perWordWins({ mode: 'satRush', rebirthCount: 0, level: 1 }), round10(B * 0.5)); // 50
  assert.equal(perWordWins({ mode: 'chain', rebirthCount: 0, level: 1 }), round10(B * 1.9)); // 190
  assert.equal(perWordWins({ mode: 'fuse', rebirthCount: 0, level: 1 }), round10(B * 1)); // 100
  // Difficulty scales the per-word rate (no mode → ×1), still snapped to 10.
  assert.equal(perWordWins({ difficulty: 'medium', rebirthCount: 0, level: 1 }), round10(B * 1.5));
  assert.equal(perWordWins({ difficulty: 'hard', rebirthCount: 0, level: 1 }), round10(B * 2));
});

test('perWordWins: REBIRTH multiplies wins on the same ladder as XP (now 3^rc)', () => {
  const wb = (rc) => perWordWins({ mode: 'wordBomb', rebirthCount: rc, level: 1 });
  assert.equal(wb(1), round10(WORD_WINS_BASE * 2 * rebirthMult(1))); // ×3  → 600
  assert.equal(wb(2), round10(WORD_WINS_BASE * 2 * rebirthMult(2))); // ×9  → 1800
  assert.equal(wb(3), round10(WORD_WINS_BASE * 2 * rebirthMult(3))); // ×27 → 5400
  assert.equal(wb(10), round10(WORD_WINS_BASE * 2 * rebirthMult(10)));
  assert.equal(perWordWins({ mode: 'fuse', rebirthCount: 5, level: 1 }), round10(WORD_WINS_BASE * rebirthMult(5)));
  // ...and it is strictly increasing, which the v6 table also was - the change is the SIZE of
  // the steps, not the direction.
  for (let rc = 0; rc < 8; rc++) assert.ok(wb(rc + 1) > wb(rc), `R${rc + 1} must pay more than R${rc}`);
});

// NEW IN v7: the per-word base itself grows with the level. This is the answer to "higher play
// should pay visibly more PER WORD, not just per minute" - before this, a LV80 player and a LV8
// player were paid identically for the same word.
test('perWordWins: the per-word base COMPOUNDS with level (v7)', () => {
  const at = (lv) => perWordWins({ mode: 'wordBomb', rebirthCount: 0, momentumCount: 0, level: lv });
  assert.ok(at(50) > at(1), 'LV50 must out-earn LV1 on the same word');
  assert.ok(at(100) > at(50));
  assert.ok(at(300) > at(200));
  // ×1.015 a level: ~×2.1 by LV50, ~×4.4 by LV100, ~×86 by LV300.
  assert.ok(Math.abs(winLevelMult(50) - Math.pow(WIN_LEVEL_STEP, 49)) < 1e-12);
  assert.ok(winLevelMult(100) > 4 && winLevelMult(100) < 4.5, winLevelMult(100));
  assert.ok(winLevelMult(300) > 80 && winLevelMult(300) < 90, winLevelMult(300));
  // Guarded: a missing / nonsense level reads as LV1, never NaN.
  assert.equal(winLevelMult(undefined), 1);
  assert.equal(winLevelMult(-5), 1);
});

test('awardWins: <3 words pays 0; else wordsAccepted × per-word', () => {
  const per = perWordWins({ rebirthCount: 0, level: 1 }); // 100 at v7
  assert.equal(awardWins({ wordsAccepted: 2, rebirthCount: 0, level: 1 }), 0);
  assert.equal(awardWins({ wordsAccepted: 3, rebirthCount: 0, level: 1 }), 3 * per);
  assert.equal(awardWins({ wordsAccepted: 10, rebirthCount: 0, level: 1 }), 10 * per);
  assert.equal(awardWins({ wordsAccepted: 0, rebirthCount: 0, level: 1 }), 0);
});

test('awardWins: SAT ×0.5, CHAIN ×1.9, FUSE ×1, Word Bomb ×2 per word (R0)', () => {
  const per = (mode) => perWordWins({ mode, rebirthCount: 0, level: 1 });
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'satRush', rebirthCount: 0, level: 1 }), 3 * per('satRush'));
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'chain', rebirthCount: 0, level: 1 }), 3 * per('chain'));
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'fuse', rebirthCount: 0, level: 1 }), 3 * per('fuse'));
  assert.equal(awardWins({ wordsAccepted: 2, mode: 'fuse', rebirthCount: 0, level: 1 }), 0); // gated on <3
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'wordBomb', rebirthCount: 0, level: 1 }), 3 * per('wordBomb'));
  // The ORDERING of the mode mults is the balance claim, and it survives the base change.
  assert.ok(per('wordBomb') > per('chain') && per('chain') > per('blitz') && per('blitz') > per('satRush'));
});

test('awardWins: difficulty scales the per-word rate (chill 1.0 / easy 1.25 / medium 1.5 / hard 2.0)', () => {
  const aw = (o) => awardWins({ wordsAccepted: 10, rebirthCount: 0, level: 1, ...o });
  const per = (o) => perWordWins({ rebirthCount: 0, level: 1, ...o });
  assert.equal(aw({ difficulty: 'chill' }), 10 * per({ difficulty: 'chill' }));
  assert.equal(aw({ difficulty: 'medium' }), 10 * per({ difficulty: 'medium' }));
  assert.equal(aw({ difficulty: 'hard' }), 10 * per({ difficulty: 'hard' }));
  assert.ok(aw({ difficulty: 'hard' }) > aw({ difficulty: 'medium' }));
  assert.ok(aw({ difficulty: 'medium' }) > aw({ difficulty: 'chill' }));
  // Difficulty stacks with mode.
  assert.equal(
    aw({ mode: 'chain', difficulty: 'hard' }),
    10 * per({ mode: 'chain', difficulty: 'hard' })
  );
  // Unknown / missing difficulty falls through to ×1.
  assert.equal(aw({ difficulty: 'zzz' }), aw({ difficulty: 'chill' }));
  assert.equal(aw({}), aw({ difficulty: 'chill' }));
  assert.equal(awardWins({ wordsAccepted: 2, difficulty: 'hard', rebirthCount: 0, level: 1 }), 0);
});

test('round/word estimates: card previews are the R0/LV1 BASE rate (v7: 100 base)', () => {
  const B = WORD_WINS_BASE;
  // wordWinsEstimate is the R0 BASE preview (never rebirth- or level-scaled) shown on game cards,
  // keyed by game.id. It deliberately excludes the level term so the card's headline number is
  // stable; the live boost is annotated separately (currentRebirthMult).
  assert.equal(wordWinsEstimate({ mode: 'word-bomb' }), round10(B * 2)); // 200
  assert.equal(wordWinsEstimate({ mode: 'category-blitz' }), round10(B * 1)); // 100
  assert.equal(wordWinsEstimate({ mode: 'sat-rush' }), round10(B * 0.5)); // 50
  assert.equal(wordWinsEstimate({ mode: 'chain' }), round10(B * 1.9)); // 190
  assert.equal(wordWinsEstimate({ mode: 'fuse' }), round10(B * 1)); // 100
  // roundWinsEstimate = a typical 10-word round. NOTE 'word-bomb' (hyphen) is NOT a WINS_MULT key
  // (the live WB wins key is 'wordBomb'), so it falls to ×1 here; this fn has no live caller and
  // is exercised only as a pure unit.
  assert.equal(roundWinsEstimate({ mode: 'word-bomb' }), 10 * round10(B));
  assert.equal(roundWinsEstimate({ mode: 'chain' }), 10 * round10(B * 1.9));
  assert.equal(roundWinsEstimate({ mode: 'fuse' }), 10 * round10(B));
  assert.equal(roundWinsEstimate({ mode: 'word-bomb', difficulty: 'hard' }), 10 * round10(B * 2));
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
    // A payout raises BOTH (R0/LV1; Word Bomb ×2).
    const wb5 = 5 * perWordWins({ mode: 'wordBomb', rebirthCount: 0, level: 1 });
    recordRound({ mode: 'wordBomb', wordsAccepted: 5 });
    assert.equal(getWins(), wb5);
    assert.equal(getWinsLifetime(), wb5);
    // Spending lowers the balance but NEVER the lifetime total.
    saveWins(5);
    assert.equal(getWins(), 5);
    assert.equal(getWinsLifetime(), wb5);
    // Another payout adds to both from their current values.
    const bl3 = 3 * perWordWins({ mode: 'blitz', rebirthCount: 0, level: 1 });
    recordRound({ mode: 'blitz', wordsAccepted: 3 });
    assert.equal(getWins(), 5 + bl3);
    assert.equal(getWinsLifetime(), wb5 + bl3);
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
// ECONOMY v7 NOTE: every expected figure from here down was written against the v6 per-word base
// of 20. The base is 100 now, so each is exactly 5× what it was, and the rebirth cases moved from
// the old ×1.5/×2.5 table to 3^rc. The assertions are rewritten to derive their expectation from
// perWordWins() rather than restate a literal — what these tests are FOR is the gate, the
// retroactive release and the weight arithmetic, none of which the refit touched.
test('bankWordWins: words 1-2 bank nothing, word 3 banks 3× retroactively, words 4+ bank 1× each', () => {
  withStorage(() => {
    // Word 1 and 2: under the gate, nothing banks.
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 0, nowWords: 1 }), 0);
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 1, nowWords: 2 }), 0);
    assert.equal(getWins(), 0);
    const per = perWordWins({ mode: 'wordBomb', rebirthCount: 0, level: 1 });
    // Word 3 crosses the gate → banks 3 × per retroactively (the first 3 words at once).
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 2, nowWords: 3 }), 3 * per);
    assert.equal(getWins(), 3 * per);
    assert.equal(getWinsLifetime(), 3 * per);
    // Word 4, 5: each banks one more per-word.
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 3, nowWords: 4 }), per);
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 4, nowWords: 5 }), per);
    assert.equal(getWins(), 5 * per); // == a full 5-word round: matches recordRound(5) exactly
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

test('bankWordWins: mode multipliers + difficulty apply per word (SAT ×0.5, CHAIN ×1.9, FUSE ×1, hard 2×)', () => {
  const per = (o) => perWordWins({ rebirthCount: 0, level: 1, ...o });
  withStorage(() => assert.equal(bankWordWins({ mode: 'satRush', prevWords: 2, nowWords: 3 }), 3 * per({ mode: 'satRush' })));
  withStorage(() => assert.equal(bankWordWins({ mode: 'chain', prevWords: 2, nowWords: 3 }), 3 * per({ mode: 'chain' })));
  withStorage(() => assert.equal(bankWordWins({ mode: 'fuse', prevWords: 2, nowWords: 3 }), 3 * per({ mode: 'fuse' })));
  // Word Bomb (×2) on HELL (hard ×2).
  withStorage(() => assert.equal(
    bankWordWins({ mode: 'wordBomb', difficulty: 'hard', prevWords: 3, nowWords: 4 }),
    per({ mode: 'wordBomb', difficulty: 'hard' })
  ));
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
test('a completed CHAIN run grants links × the per-word rate × rebirthMult; <3 grants 0', () => {
  withStorage(() => {
    const per = perWordWins({ mode: 'chain', rebirthCount: 0, level: 1 }); // round10(100×1.9)=190
    assert.equal(recordRound({ mode: 'chain', wordsAccepted: 7 }), 7 * per);
    assert.equal(getWins(), 7 * per);
  });
  withStorage(() => {
    localStorage.setItem('taw.rebirths', '3'); // R3 → ×27 in v7 (the v6 table said ×2.5)
    const per = perWordWins({ mode: 'chain', rebirthCount: 3, level: 1 });
    assert.equal(recordRound({ mode: 'chain', wordsAccepted: 5 }), 5 * per);
  });
  withStorage(() => {
    assert.equal(recordRound({ mode: 'chain', wordsAccepted: 2 }), 0); // <3 → nothing
    assert.equal(getWins(), 0);
  });
});

test('a completed FUSE run grants words × the per-word rate × rebirthMult; <3 grants 0', () => {
  withStorage(() => {
    const per = perWordWins({ mode: 'fuse', rebirthCount: 0, level: 1 }); // 100
    assert.equal(recordRound({ mode: 'fuse', wordsAccepted: 6 }), 6 * per);
    assert.equal(getWins(), 6 * per);
  });
  withStorage(() => {
    localStorage.setItem('taw.rebirths', '1'); // R1 → ×3 in v7 (the v6 table said ×1.5)
    const per = perWordWins({ mode: 'fuse', rebirthCount: 1, level: 1 });
    assert.equal(recordRound({ mode: 'fuse', wordsAccepted: 4 }), 4 * per);
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
    // No weight args: word 3 banks 3×per, word 4 banks per — exactly the count-based behaviour.
    const per = perWordWins({ mode: 'wordBomb', rebirthCount: 0, level: 1 });
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 2, nowWords: 3 }), 3 * per);
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 3, nowWords: 4 }), per);
  });
});

test('bankWordWins: the gate crossing releases the first three words RARITY RETROACTIVELY', () => {
  withStorage(() => {
    // Words 1,2,3 have mults 1.0, 2.5, 4.0 → cumulative weights 0→1, 1→3.5, 3.5→7.5.
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 0, nowWords: 1, prevWeight: 0, nowWeight: 1.0 }), 0); // pre-gate
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 1, nowWords: 2, prevWeight: 1.0, nowWeight: 3.5 }), 0); // pre-gate
    // Word 3 crosses the gate: releases the WHOLE cumulative weight 7.5 × the per-word rate.
    const per = perWordWins({ mode: 'wordBomb', rebirthCount: 0, level: 1 });
    const expect = round10(7.5 * per);
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 2, nowWords: 3, prevWeight: 3.5, nowWeight: 7.5 }), expect);
    assert.equal(getWins(), expect);
  });
});

test('bankWordWins: words 4+ each release exactly their own rarity weight', () => {
  withStorage(() => {
    const per = perWordWins({ mode: 'wordBomb', rebirthCount: 0, level: 1 });
    // Already past the gate (prev count 3). Word 4 is OBSCURE ×4.
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 7 }), round10(4 * per));
    // Word 5 is UNCOMMON ×1.5.
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 4, nowWords: 5, prevWeight: 7, nowWeight: 8.5 }), round10(1.5 * per));
  });
});

test('bankWordWins: rarity STACKS with the mode multiplier (FUSE ×15 × OBSCURE ×4 per word)', () => {
  withStorage(() => {
    // FUSE per-word base (×1); an OBSCURE word (weight 4) past the gate.
    const per = perWordWins({ mode: 'fuse', rebirthCount: 0, level: 1 });
    assert.equal(bankWordWins({ mode: 'fuse', prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 7 }), round10(4 * per));
  });
});

test('bankWordWins: rarity STACKS with rebirth (CHAIN × R3 × a RARE word)', () => {
  withStorage(() => {
    // R3 is ×27 in v7 (the v6 table said ×2.5); a RARE word carries weight 2.5.
    const per = perWordWins({ mode: 'chain', rebirthCount: 3, level: 1 });
    assert.equal(
      bankWordWins({ mode: 'chain', prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 5.5, rebirthCount: 3, level: 1 }),
      round10(2.5 * per)
    );
  });
});
