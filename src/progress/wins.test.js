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
import { keyTierCostAt, rebirthMult, keyTierXp, XP_MULTIPLIERS } from './xp.js';

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
        assert.equal(xp % 10, 0, `XP must stay a multiple of 10: ${mode}/${difficulty}/${wordLength}`);
        assert.equal(
          perWordWins(o),
          Math.round(xp / 10),
          `wins must be XP/10 for ${mode}/${difficulty}/${wordLength} (xp ${xp})`,
        );
      }
    }
  }
});

test('perWordWins: key-tier letters × mode × difficulty, on the reference word (Economy v8)', () => {
  // T0 is 10 XP a letter and the reference word is 5 letters, so the flat base is 5 wins.
  assert.equal(WORD_LEN_REF, 5);
  assert.equal(wordWinsBase({ keyTier: 0 }), 5);
  const o = { rebirthCount: 0, streakMult: 1, masteryMult: 1, keyTier: 0 };
  // LITERALS, not `keyTierXp(0) * 5 * XP_MULTIPLIERS[m] / 10` — restating the implementation with
  // the constants under test is a test that passes whatever the tables say.
  assert.equal(perWordWins({ ...o, mode: 'wordBomb' }), 10);
  assert.equal(perWordWins({ ...o, mode: 'blitz' }), 10);
  assert.equal(perWordWins({ ...o, mode: 'satRush' }), 15);
  assert.equal(perWordWins({ ...o, mode: 'chain' }), 20);
  assert.equal(perWordWins({ ...o, mode: 'fuse' }), 25);
  // No mode → the menu rate (×1).
  assert.equal(perWordWins(o), 5);
  // KEY POWER now raises WINS too, because the base IS the key tier. This is the point of the
  // merge: it was the one upgrade that bought income in a currency it could not be spent on.
  assert.equal(perWordWins({ ...o, keyTier: 2, mode: 'wordBomb' }), (keyTierXp(2) * 5 * 2) / 10);
  assert.ok(perWordWins({ ...o, keyTier: 3 }) > perWordWins({ ...o, keyTier: 0 }));
  // DIFFICULTY APPLIES TO BOTH READOUTS NOW. It used to touch wins only, so playing on HELL
  // levelled you no faster than CHILL.
  assert.equal(perWordWins({ ...o, difficulty: 'medium' }), 8); // round10(50 × 1.5) = 80 → 8
  assert.equal(perWordWins({ ...o, difficulty: 'hard' }), 10);
  assert.ok(perWordXp({ ...o, difficulty: 'hard' }) > perWordXp({ ...o, difficulty: 'chill' }));
});

test('perWordWins: REBIRTH multiplies wins on the same ladder as XP (now 3^rc)', () => {
  const wb = (rc) => perWordWins({ mode: 'wordBomb', rebirthCount: rc, keyTier: 0, streakMult: 1, masteryMult: 1 });
  assert.equal(wb(1), (keyTierXp(0) * WORD_LEN_REF * 2 * rebirthMult(1)) / 10); // ×3
  assert.equal(wb(2), (keyTierXp(0) * WORD_LEN_REF * 2 * rebirthMult(2)) / 10); // ×9
  assert.equal(wb(3), (keyTierXp(0) * WORD_LEN_REF * 2 * rebirthMult(3)) / 10); // ×27
  assert.equal(wb(10), (keyTierXp(0) * WORD_LEN_REF * 2 * rebirthMult(10)) / 10);
  // FUSE carries its own mode multiplier on top — the omission that used to hide here passed
  // only because FUSE happened to be ×1 at the time.
  assert.equal(
    perWordWins({ mode: 'fuse', rebirthCount: 5, keyTier: 0, streakMult: 1, masteryMult: 1 }),
    (keyTierXp(0) * WORD_LEN_REF * XP_MULTIPLIERS.fuse * rebirthMult(5)) / 10,
  );
  // ...and it is strictly increasing, which the v6 table also was - the change is the SIZE of
  // the steps, not the direction.
  for (let rc = 0; rc < 8; rc++) assert.ok(wb(rc + 1) > wb(rc), `R${rc + 1} must pay more than R${rc}`);
});

// REVERSED IN v8, DELIBERATELY. v7 compounded the per-word base with the LEVEL — income
// chasing the very curve it buys, which is the compounding that produced "stuck at LV40". The
// per-word award is now FLAT in level; income grows through KEY POWER, rebirth, mastery and
// momentum, which are levers the player buys rather than ones that accrue and then race the
// curve. winLevelMult survives for the FLAT one-off grants (secret finds, secret achievements).
test('perWordWins is FLAT in level (v8); winLevelMult survives for the flat grants', () => {
  const at = (lv) => perWordWins({ mode: 'wordBomb', rebirthCount: 0, momentumCount: 0, level: lv, keyTier: 0, streakMult: 1, masteryMult: 1 });
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
  // THE ORDERING IS THE BALANCE CLAIM. It used to assert wordBomb > chain > blitz > satRush;
  // both solo modes sitting UNDER Word Bomb is exactly what Andy called wrong ("CHAIN and FUSE
  // are solo, score-attack — they should be MUCH higher").
  // ANDY'S ORDERING, and it is only reachable because SAT reached PARITY. With SAT banking
  // rarity alone there was NO card assignment satisfying all three of these at once (searched
  // exhaustively in claude/econ-visible-sim.mjs); giving SAT the combo+lucky every other mode
  // already had is what made the target satisfiable rather than the target being wrong.
  const soloLow = Math.min(per('chain'), per('fuse'));
  const mpHigh = Math.max(per('wordBomb'), per('blitz'));
  assert.ok(soloLow > mpHigh, `solo floor ${soloLow} must beat multiplayer ceiling ${mpHigh}`);
  assert.ok(soloLow / mpHigh >= 1.25, `the solo lead must be real, got ${(soloLow / mpHigh).toFixed(2)}x`);
  // SAT SITS ABOVE BLITZ NOW, NOT LEVEL WITH IT — and that is a v8 consequence worth stating
  // rather than papering over. The "within 20% of Blitz" target belonged to WINS_MULT, the second
  // per-mode table the merge deleted; with XP_MULTIPLIERS as the only table SAT is ×3 against
  // Blitz's ×2. It is the vocabulary mode and it is between Blitz and the solo modes, which is
  // the ordering the modes are for.
  assert.ok(per('satRush') > per('blitz'), 'SAT must out-pay Blitz per word');
  assert.ok(per('satRush') < soloLow, 'SAT must still sit under the solo modes');
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

test('round/word estimates: card previews are the R0 BASE rate (v8: key-tier letters ÷ 10)', () => {
  // wordWinsEstimate is the R0 BASE preview shown on game cards, keyed by game.id: mode ×
  // difficulty on the reference word, with NO earned multipliers at all. At T0 that is
  // 10 XP/letter × 5 letters ÷ 10 = 5, times the mode.
  assert.equal(wordWinsEstimate({ mode: 'word-bomb', keyTier: 0 }), 10);
  assert.equal(wordWinsEstimate({ mode: 'category-blitz', keyTier: 0 }), 10);
  assert.equal(wordWinsEstimate({ mode: 'sat-rush', keyTier: 0 }), 15);
  assert.equal(wordWinsEstimate({ mode: 'chain', keyTier: 0 }), 20);
  assert.equal(wordWinsEstimate({ mode: 'fuse', keyTier: 0 }), 25);
  assert.equal(wordWinsEstimate({ mode: 'word-bomb', difficulty: 'hard', keyTier: 0 }), 20);
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
test('PRICES end in a zero; every XP grant is a multiple of 10; every wins payout is a whole number', () => {
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
        assert.equal(perWordXp(o) % 10, 0, `XP ${mode}/${difficulty}/R${rebirthCount}`);
        assert.equal(perWordWins(o), Math.round(perWordXp(o) / 10), `wins==xp/10 ${mode}/${difficulty}/R${rebirthCount}`);
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

test('bankWordWins: the gate crossing releases the first three words RARITY RETROACTIVELY', () => {
  withStorage(() => {
    // Words 1,2,3 have mults 1.0, 2.5, 4.0 → cumulative weights 0→1, 1→3.5, 3.5→7.5.
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 0, nowWords: 1, prevWeight: 0, nowWeight: 1.0 }), 0); // pre-gate
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 1, nowWords: 2, prevWeight: 1.0, nowWeight: 3.5 }), 0); // pre-gate
    // Word 3 crosses the gate: releases the WHOLE cumulative weight 7.5 × the per-word rate.
    const per = perWordWins({ mode: 'wordBomb', rebirthCount: 0, level: 1 });
    // Math.round, not round10: wins are XP÷10 now and no longer land on a multiple of ten.
    const expect = Math.round(7.5 * per);
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 2, nowWords: 3, prevWeight: 3.5, nowWeight: 7.5 }), expect);
    assert.equal(getWins(), expect);
  });
});

test('bankWordWins: words 4+ each release exactly their own rarity weight', () => {
  withStorage(() => {
    const per = perWordWins({ mode: 'wordBomb', rebirthCount: 0, level: 1 });
    // Already past the gate (prev count 3). Word 4 is OBSCURE ×4.
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 7 }), Math.round(4 * per));
    // Word 5 is UNCOMMON ×1.5.
    assert.equal(bankWordWins({ mode: 'wordBomb', prevWords: 4, nowWords: 5, prevWeight: 7, nowWeight: 8.5 }), Math.round(1.5 * per));
  });
});

test('bankWordWins: rarity STACKS with the mode multiplier (FUSE ×15 × OBSCURE ×4 per word)', () => {
  withStorage(() => {
    // FUSE per-word base (×1); an OBSCURE word (weight 4) past the gate.
    const per = perWordWins({ mode: 'fuse', rebirthCount: 0, level: 1 });
    assert.equal(bankWordWins({ mode: 'fuse', prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 7 }), Math.round(4 * per));
  });
});

test('bankWordWins: rarity STACKS with rebirth (CHAIN × R3 × a RARE word)', () => {
  withStorage(() => {
    // R3 is ×27 in v7 (the v6 table said ×2.5); a RARE word carries weight 2.5.
    const per = perWordWins({ mode: 'chain', rebirthCount: 3, level: 1 });
    assert.equal(
      bankWordWins({ mode: 'chain', prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 5.5, rebirthCount: 3, level: 1 }),
      Math.round(2.5 * per)
    );
  });
});
