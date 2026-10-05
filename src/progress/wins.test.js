// node --test — the WINS currency model: the payout formula, the independent balance vs
// lifetime totals, the per-mode round counters (gated on >=3 words), and storage safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORD_LEN_REF,
  wordWinsBase,
  WIN_LEVEL_STEP,
  winLevelMult,
  awardWins,
  perWordWins,
  perWordXp,
  perWordRateNow,
  modeKey,
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
  getWinsCarry,
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

// ECONOMY v8: WINS ARE THE WORD'S XP DIVIDED BY TEN. There is no second stack and no
// WORD_WINS_BASE any more — the base is the word's LETTERS at the player's key tier, and the
// per-mode table is XP_MULTIPLIERS (menu 1 · WB 2 · Blitz 2 · SAT 3 · CHAIN 4 · FUSE 5), the only
// one left. The figures below are therefore an order of magnitude smaller than v7's and the mode
// ORDERING changed with them; the shop prices moved by the same factor (see shop.test.js).
test('perWordWins is EXACTLY the word’s XP ÷ 10 — every mode × every difficulty', () => {
  // THE REGRESSION GUARD FOR THE WHOLE BINDING. If these two ever diverge, a player is being
  // paid one number and shown another, which is the defect the unified stack exists to remove.
  for (const mode of ['wordBomb', 'blitz', 'satRush', 'chain', 'fuse']) {
    for (const difficulty of ['chill', 'easy', 'medium', 'hard']) {
      for (const wordLength of [3, 5, 9]) {
        const o = { mode, difficulty, wordLength, rebirthCount: 0, streakMult: 1, masteryMult: 1 };
        const xp = perWordXp(o);
        // WHOLE XP (fix/payout-honesty) — no longer snapped to a multiple of ten, which is what
        // swallowed the first nine momentum marks. Wins are the exact tenth, not a rounded integer.
        assert.ok(Number.isInteger(xp), `XP must be whole: ${mode}/${difficulty}/${wordLength}`);
        assert.equal(
          perWordWins(o),
          xp / 10,
          `wins must be XP/10 for ${mode}/${difficulty}/${wordLength} (xp ${xp})`,
        );
      }
    }
  }
});

test('perWordWins (Rebirth Rush): BASE 10 × len/5 × MODE POWER — KEY and DIFFICULTY do not pay', () => {
  // The frozen formula: a 5-letter reference word is BASE 10 wins at Word Bomb (POWER ×1).
  assert.equal(WORD_LEN_REF, 5);
  assert.equal(wordWinsBase({ keyTier: 0 }), 10);
  assert.equal(wordWinsBase({ keyTier: 9 }), 10, 'KEY is the bar’s booster, not a wins one');
  const o = { rebirthCount: 0, streakMult: 1, masteryMult: 1, keyTier: 0 };
  // LITERALS, not `keyTierXp(0) * 5 * XP_MULTIPLIERS[m] / 10` — restating the implementation with
  // the constants under test is a test that passes whatever the tables say.
  assert.equal(perWordWins({ ...o, mode: 'wordBomb' }), 10);
  assert.equal(perWordWins({ ...o, mode: 'blitz' }), 10);
  assert.equal(perWordWins({ ...o, mode: 'satRush' }), 50); // oct2: POWER ×5
  assert.equal(perWordWins({ ...o, mode: 'chain' }), 20);
  assert.equal(perWordWins({ ...o, mode: 'fuse' }), 10); // oct2: same as Word Bomb (FRENZY is its edge)
  assert.equal(perWordWins({ ...o, mode: 'wordRace' }), 15); // POWER ×1.5
  // No mode → the menu rate (POWER ½).
  assert.equal(perWordWins(o), 5);
  // KEY tier does not touch wins any more.
  assert.equal(perWordWins({ ...o, keyTier: 2, mode: 'wordBomb' }), 10);
  assert.equal(perWordWins({ ...o, keyTier: 9, mode: 'satRush' }), 50);
  // DIFFICULTY and STREAK are out of the formula.
  for (const difficulty of ['chill', 'easy', 'medium', 'hard']) assert.equal(perWordWins({ ...o, mode: 'wordBomb', difficulty }), 10, difficulty);
  assert.equal(perWordWins({ ...o, mode: 'wordBomb', streakMult: 1.5 }), 10);
  // LENGTH scales linearly.
  assert.equal(perWordWins({ ...o, mode: 'wordBomb', wordLength: 8 }), 16);
});

test('perWordWins: REBIRTH ×5 a rebirth (5^R) — R2 = ×25', () => {
  const wb = (rc) => perWordWins({ mode: 'wordBomb', rebirthCount: rc, keyTier: 0, streakMult: 1, masteryMult: 1 });
  assert.equal(wb(0), 10);
  assert.equal(wb(1), 50);
  assert.equal(wb(2), 250);
  assert.equal(wb(3), 1250);
  assert.equal(wb(10), 97656250);
  assert.equal(perWordWins({ mode: 'fuse', rebirthCount: 5, keyTier: 0, streakMult: 1, masteryMult: 1 }), 31250);
  assert.equal(perWordWins({ mode: 'satRush', rebirthCount: 2, keyTier: 0, streakMult: 1, masteryMult: 1 }), 1250);
  for (let rc = 0; rc < 8; rc++) assert.equal(wb(rc + 1) / wb(rc), 5, `R${rc + 1} pays ×5 of R${rc}`);
});

// REVERSED IN v8, DELIBERATELY. v7 compounded the per-word base with the LEVEL — income
// chasing the very curve it buys, which is the compounding that produced "stuck at LV40". The
// per-word award is now FLAT in level; income grows through KEY POWER, rebirth, mastery and
// momentum, which are levers the player buys rather than ones that accrue and then race the
// curve. winLevelMult survives for the FLAT one-off grants (secret finds, secret achievements).
test('perWordWins is FLAT in level (v8); winLevelMult survives for the flat grants', () => {
  const at = (lv) => perWordWins({ mode: 'wordBomb', rebirthCount: 0, level: lv, keyTier: 0, streakMult: 1, masteryMult: 1 });
  assert.equal(at(1), at(50));
  assert.equal(at(50), at(300), 'a level must not silently multiply a word’s payout any more');
  // The helper itself is unchanged and still exported — achievements.js and useWordSecrets.js
  // scale their one-off grants with it, which is what it is good for.
  assert.ok(Math.abs(winLevelMult(50) - Math.pow(WIN_LEVEL_STEP, 49)) < 1e-12);
  assert.ok(winLevelMult(100) > 29 && winLevelMult(100) < 31, winLevelMult(100));
  assert.ok(winLevelMult(300) > 29000 && winLevelMult(300) < 29700, winLevelMult(300));
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

test('awardWins: the SOLO modes now out-pay the multiplayer ones per word (R0)', () => {
  const per = (mode) => perWordWins({ mode, rebirthCount: 0, level: 1 });
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'satRush', rebirthCount: 0, level: 1 }), 3 * per('satRush'));
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'chain', rebirthCount: 0, level: 1 }), 3 * per('chain'));
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'fuse', rebirthCount: 0, level: 1 }), 3 * per('fuse'));
  assert.equal(awardWins({ wordsAccepted: 2, mode: 'fuse', rebirthCount: 0, level: 1 }), 0); // gated on <3
  assert.equal(awardWins({ wordsAccepted: 3, mode: 'wordBomb', rebirthCount: 0, level: 1 }), 3 * per('wordBomb'));
  // ANDY OCT2 — MODE POWER IS THE PAYOUT. Read against Word Bomb: SAT ×5, CHAIN ×2, FUSE ×1 (its
  // edge is FRENZY, a timed ×5, not a higher base), Blitz ×1.
  assert.equal(per('satRush'), 5 * per('wordBomb'), 'SAT pays POWER ×5 of Word Bomb per word');
  assert.equal(per('chain'), 2 * per('wordBomb'), 'CHAIN pays POWER ×2');
  assert.equal(per('fuse'), per('wordBomb'), 'FUSE pays the SAME per word as Word Bomb');
  assert.equal(per('blitz'), per('wordBomb'));
});

test('awardWins (Rebirth Rush): difficulty no longer changes the per-word rate', () => {
  const aw = (o) => awardWins({ wordsAccepted: 10, rebirthCount: 0, level: 1, mode: 'wordBomb', ...o });
  for (const difficulty of ['chill', 'easy', 'medium', 'hard', 'zzz', undefined]) assert.equal(aw({ difficulty }), 100, String(difficulty));
  assert.equal(aw({ mode: 'chain', difficulty: 'hard' }), 200);
  assert.equal(awardWins({ wordsAccepted: 2, difficulty: 'hard', rebirthCount: 0, level: 1 }), 0);
});

test('round/word estimates: card previews are the R0 BASE rate (BASE 10 × MODE POWER)', () => {
  // wordWinsEstimate is the R0 BASE preview shown on game cards, keyed by game.id: the mode on
  // the reference word, with NO earned multipliers at all (difficulty no longer pays).
  assert.equal(wordWinsEstimate({ mode: 'word-bomb', keyTier: 0 }), 10);
  assert.equal(wordWinsEstimate({ mode: 'category-blitz', keyTier: 0 }), 10);
  assert.equal(wordWinsEstimate({ mode: 'sat-rush', keyTier: 0 }), 50);
  assert.equal(wordWinsEstimate({ mode: 'chain', keyTier: 0 }), 20);
  assert.equal(wordWinsEstimate({ mode: 'fuse', keyTier: 0 }), 10);
  assert.equal(wordWinsEstimate({ mode: 'word-bomb', difficulty: 'hard', keyTier: 0 }), 10);
  assert.equal(wordWinsEstimate({ mode: 'word-bomb', keyTier: 9 }), 10);
  // BOTH SPELLINGS OF A MODE NOW RESOLVE. 'word-bomb' used not to be a payout key, so the
  // estimate quietly fell through to ×1; gameKey() normalises it.
  assert.equal(wordWinsEstimate({ mode: 'word-bomb', keyTier: 0 }), wordWinsEstimate({ mode: 'wordBomb', keyTier: 0 }));
  // roundWinsEstimate = a typical 10-word round.
  assert.equal(roundWinsEstimate({ mode: 'chain' }), 10 * perWordWins({ mode: 'chain' }));
  assert.equal(
    roundWinsEstimate({ mode: 'word-bomb', difficulty: 'hard' }),
    10 * perWordWins({ mode: 'word-bomb', difficulty: 'hard' }),
  );
});

// THE INVARIANT MOVED UP A LEVEL (v8). Wins used to be snapped to a multiple of ten of their
// own; they are now the word's XP ÷ 10, and it is the XP that is snapped. So the thing that must
// end in a zero is the XP — wins are simply whole, and "+15 WINS" is now a sentence the game can
// say. PRICES still end in a zero: they are read, compared and remembered by the player.
test('PRICES end in a zero; every XP grant is whole; wins are XP/10 to the tenth; every round payout is a whole number', () => {
  // Shop cosmetics.
  for (const item of [...POP_STYLES, ...SOUND_PACKS]) {
    assert.equal(item.price % 10, 0, `${item.id} price ${item.price}`);
  }
  // Key Power TIER costs across the exact-integer range.
  for (let t = 0; t <= 15; t++) assert.equal(keyTierCostAt(t) % 10, 0, `keyTierCostAt(${t})`);
  const modes = [undefined, 'word-bomb', 'wordBomb', 'blitz', 'satRush', 'chain', 'fuse'];
  const diffs = [undefined, 'chill', 'easy', 'medium', 'hard', 'zzz'];
  const rebirths = [0, 1, 2, 3, 5, 10, 15];
  for (const mode of modes) {
    for (const difficulty of diffs) {
      for (const rebirthCount of rebirths) {
        const o = { mode, difficulty, rebirthCount, keyTier: 0, streakMult: 1, masteryMult: 1 };
        assert.ok(Number.isInteger(perWordXp(o)), `XP ${mode}/${difficulty}/R${rebirthCount}`);
        assert.equal(perWordWins(o), perWordXp(o) / 10, `wins==xp/10 ${mode}/${difficulty}/R${rebirthCount}`);
        for (let w = 0; w <= 20; w++) {
          const paid = awardWins({ wordsAccepted: w, ...o });
          assert.ok(Number.isInteger(paid), `award ${mode}/${difficulty}/R${rebirthCount}/${w} = ${paid}`);
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

test('bankWordWins: mode POWER applies per word (SAT ×5, CHAIN ×2, FUSE ×1); difficulty does not', () => {
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
    const per = perWordWins({ mode: 'chain', rebirthCount: 0 });
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

// REBIRTH RUSH + feat/wb-bonus-boost: the per-word weight (rarity × combo × lucky, capped) is a BOOST factor
// in WORD BOMB and BLITZ only — bankWordWins banks the cumulative weight × the per-word unit there. Every
// other mode IGNORES the weights its callers pass and pays by word COUNT.
test('bankWordWins: Word Bomb + Blitz pay the rarity / combo / lucky WEIGHT (BOOST); the gate stays on the count', () => {
  withStorage(() => {
    // A 5-letter WB word at R0 = 10 wins (100 in XP units).
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 0, nowWords: 1, prevWeight: 0, nowWeight: 1.0 }), 0); // pre-gate
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 1, nowWords: 2, prevWeight: 1.0, nowWeight: 3.5 }), 0);
    // the gate crossing releases the whole 7.5 weight of words 1-3: 7.5 × 10
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 2, nowWords: 3, prevWeight: 3.5, nowWeight: 7.5 }), 75);
    // an OBSCURE ×4 word 4 pays its own weight: 4 × 10
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 3, nowWords: 4, prevWeight: 7.5, nowWeight: 11.5 }), 40);
    assert.equal(getWins(), 115);
    assert.deepEqual(getRounds(), { wordBomb: 1, blitz: 0, satRush: 0 });
  });
  withStorage(() => {
    // gameData spelling is accepted too ('category-blitz' → blitz): a LUCKY ×5 answer past the gate = 5 × 10
    assert.equal(bankWordWins({ mode: 'category-blitz', prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 8 }), 5 * perWordWins({ mode: 'blitz', rebirthCount: 0 }));
    // payout-key spelling, R1 (×5): a COMBO ×1.2 word = 1.2 × 10 × 5
    assert.equal(bankWordWins({ mode: 'blitz', prevWords: 4, nowWords: 5, prevWeight: 8, nowWeight: 9.2, rebirthCount: 1 }), 60);
  });
  withStorage(() => {
    // THE CARRY: a 3-letter WB word = 6 wins (60 XP units); at COMBO ×1.1 it is 66 → 6 wins + 6 tenths carried.
    assert.equal(bankWordWins({ mode: 'wordBomb', wordLength: 3, prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 4.1 }), 6);
    assert.equal(getWinsCarry(), 6);
    // the next ×1.2 word: 72 + 6 carried = 78 → 7 wins, 8 tenths carried. No tenth is lost or paid twice.
    assert.equal(bankWordWins({ mode: 'wordBomb', wordLength: 3, prevWords: 4, nowWords: 5, prevWeight: 4.1, nowWeight: 5.3 }), 7);
    assert.equal(getWinsCarry(), 8);
    assert.equal(getWins(), 13);
  });
  withStorage(() => {
    // NO DOUBLE PAY: a call that does not advance the count/weight (a re-delivered word) pays nothing.
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 4, nowWords: 4, prevWeight: 6, nowWeight: 6 }), 0);
    // weights omitted → count-based (×1 a word), exactly the pre-rarity behaviour
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 3, nowWords: 4 }), 10);
  });
});

test('bankWordWins: every OTHER mode ignores the weight and pays by word count', () => {
  withStorage(() => {
    // FUSE (POWER ×1) and an OBSCURE weight: one word
    assert.equal(bankWordWins({ mode: 'fuse', prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 7 }), 10);
    // CHAIN (×2) at R3 (×125) with a RARE weight: one word = 10 × 2 × 125
    assert.equal(bankWordWins({ mode: 'chain', prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 5.5, rebirthCount: 3, level: 1 }), 2500);
    // SAT RUSH and WORD RACE: the gate crossing releases 3 words, not the weight
    const sat = perWordWins({ mode: 'satRush', rebirthCount: 0 });
    assert.equal(bankWordWins({ mode: 'satRush', prevWords: 2, nowWords: 3, prevWeight: 2, nowWeight: 9 }), 3 * sat);
    const race = perWordXp({ mode: 'wordRace', rebirthCount: 0 });
    assert.equal(bankWordWins({ mode: 'wordRace', prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 13 }), Math.floor(race / 10));
  });
});

// ---- THE CARD'S TWO LINES COME OUT OF ONE CALL ----------------------------------------------
// GameCard prints XP above WINS. Computed separately they could drift; perWordRateNow returns
// both, and this is the assertion that keeps them one number.
test('perWordRateNow returns the XP and the WINS for the same word, and xp === rate x 10', () => {
  for (const mode of ['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse']) {
    for (const difficulty of [undefined, 'chill', 'medium', 'hard']) {
      const o = { mode, difficulty, rebirthCount: 0, keyTier: 0, streakMult: 1, masteryMult: 1 };
      const now = perWordRateNow(o);
      assert.equal(now.xp, perWordXp({ ...o, mode: modeKey(mode) }), `${mode}/${difficulty} xp`);
      assert.equal(now.rate, now.xp / 10, `${mode}/${difficulty} wins`);
      assert.equal(now.xp, Math.round(now.rate * 10), `${mode}/${difficulty} xp === rate x 10`);
      // The multiplier the card prints applies to BOTH lines: rate/base in wins and xp/xpBase in
      // XP are the same ratio, which is why one "(xN)" can sit on both.
      assert.ok(Math.abs(now.mult - now.xp / now.xpBase) < 1e-9, `${mode}/${difficulty} mult`);
    }
  }
});
