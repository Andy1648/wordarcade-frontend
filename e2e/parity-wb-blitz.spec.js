// ECONOMY v7 NOTE: the per-word wins base went 20 -> 100 (WORD_WINS_BASE in
// src/progress/wins.js), because Andy's read was that the base was simply too low to
// register next to five-figure upgrade prices. Every expected figure in this file moved
// with it. The WEIGHT arithmetic each test is actually about - the combo build, the
// lucky roll, the reset, the 3-word gate - is untouched; only the rate it multiplies.
//
// RE-PINNED AGAIN (econ-visible round 2): WORD BOMB's mode multiplier went x2 -> x2.1 to lift
// the FLOOR of the cross-mode wins/min band, so every WB figure below moved with it.
//
// AND ONE OF THESE WAS ALREADY WRONG BEFORE THAT. The two BLITZ figures were pinned at 160/110,
// which is round10(combo x 100) - i.e. Blitz at the BASE rate, x1. Blitz's multiplier has been
// x1.2 (per-word 120) since the rebalance-2 fit, so the correct figures were 190/130 and this
// test was red before this branch touched anything. It is the failure mode the full-suite gate
// exists to catch: a viewport-only gate never ran these, so the stale pins survived several
// merges. Recomputed here from the live table rather than adjusted by hand.
// RE-PINNED FOR THE WINS CARRY (PR #59, fix/payout-honesty). bankWordWins no longer rounds each
// grant: it works in XP, pays floor(xpOwed / 10) and CARRIES the 0-9 leftover tenths in
// taw.winsCarry into the next word. So a word's delta is floor((its XP + carry-in) / 10), not
// round(weight x rate). Every figure below is worked in XP (1 win = 10 XP) and the carry is
// asserted alongside it. WB and Blitz still produce IDENTICAL numbers for identical input - the
// parity these tests exist for holds; only the rounding rule moved.
//
// The 1-in-750 MIDAS golden pop (secrets.js) pays ~100 wins into the same balance and was NOT
// covered by __TAW_LUCKY, so it could land inside a delta (seen once: lucky 108 read as 211 =
// 108 + MIDAS 103). window.__TAW_RARE_POP = 'off' pins it.
// e2e/parity-wb-blitz.spec.js — feat/parity-wb-blitz.
// Word Bomb + Category Blitz now score with the SAME combo (+0.1 per consecutive accept, ×3 cap) and
// lucky (1/40 ×5) that CHAIN/FUSE use — folded into the per-word reward WEIGHT (reused combo.js /
// luck.js, no forked logic). These tests drive the real App.jsx WS handlers over the mock socket and
// assert, via the WINS payout: the combo BUILDS across accepts, RESETS on a reject and on a turn-loss
// (life lost), and the payout INCLUDES the lucky ×5. The 1/40 lucky draw is pinned via the
// window.__TAW_LUCKY test seam so payouts are deterministic.
// REBIRTH RUSH (PROGRESSION-FINAL.md, FROZEN): wins / word = BASE 10 × length/5 × MODE × 5^R × MARK × BOOST.
// feat/wb-bonus-boost (Andy oct5): in WORD BOMB and BLITZ the combo × lucky × rarity weight is a BOOST factor
// again — the word's weight multiplies its base, with the carry. At R0 / T0 / no mark / no code: a 5-letter word
// = 10 wins (100 in XP units), a 3-letter word = 6 (60). Every figure below is worked in XP units (wins × 10):
// a word banks floor((weight × base XP + carry-in) / 10) and carries the 0-9 leftover tenths. Blitz is MODE ×1
// like Word Bomb, so the two produce IDENTICAL numbers for identical input — the parity these tests exist for.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const ME = 'e2e-player';
const readWins = (page) => page.evaluate(() => Number(localStorage.getItem('taw.wins')) || 0);
const readCarry = (page) => page.evaluate(() => Number(localStorage.getItem('taw.winsCarry')) || 0);

async function startWbMyTurn(mock, page, { lives = 3 } = {}) {
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({
    type: 'turn_update',
    payload: {
      currentPlayerId: ME,
      players: [{ id: ME, name: 'YOU', lives, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 3 }],
      combo: 'at',
      usedWords: [],
      timerSeconds: 30,
    },
  });
  await page.waitForTimeout(60);
}
const acceptWb = (mock, word) => mock.pushToClient({ type: 'word_result', payload: { accepted: true, word } });
const rejectWb = (mock, word) => mock.pushToClient({ type: 'word_result', payload: { accepted: false, reason: 'not_a_word', word } });
// Six real COMMON words (rarity ×1) so the ONLY variable in the payout is the combo multiplier.
const C = ['WATER', 'TABLE', 'CHAIR', 'APPLE', 'HOUSE', 'CAT'];

// WAIT FOR THE BALANCE TO STOP MOVING, not for 200ms and a hope. The per-word bank happens on
// React's async drain, and under full-suite load five words can still be in flight when the
// snapshot is taken — measured once: an after5 read that landed before ANY of them banked, which
// made the NEXT delta 75 instead of 10 and pointed the blame at the combo. A fixed sleep can only
// ever be too short on a loaded machine or too slow on an idle one.
async function bankSettle(page) {
  let last = null;
  let stable = 0;
  for (let i = 0; i < 50 && stable < 3; i += 1) {
    await page.waitForTimeout(100);
    const now = await readWins(page);
    stable = now === last ? stable + 1 : 0;
    last = now;
  }
}

test.describe('combo + lucky parity (Word Bomb + Category Blitz)', () => {
  test('WB: the payout combo BUILDS across accepts and RESETS on a reject', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TAW_LUCKY = 'off';
      window.__TAW_RARE_POP = 'off';
    });
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    await startWbMyTurn(mock, page);

    // 5 COMMON accepts (streak 1..5). All banked (gate crosses at 3).
    for (const w of C.slice(0, 5)) {
      acceptWb(mock, w);
      await page.waitForTimeout(40);
    }
    await bankSettle(page);
    const after5 = await readWins(page);
    // The five 5-letter words are 100 XP units/word: gate (1.1+1.2+1.3)×100 = 360, then 1.4×100 = 140,
    // 1.5×100 = 150 — all whole wins (36 + 14 + 15 = 65), so nothing is carried into word 6.
    expect(await readCarry(page)).toBe(0);

    // 6th accept: C[5] is CAT, three letters → 60 XP units/word. Streak 6 → combo 1.6 → 96 + carry 0
    // → floor(9.6) = +9, carry 6. BUILDS past the ×1.1 base (66 → +6).
    acceptWb(mock, C[5]);
    await expect.poll(async () => (await readWins(page)) - after5, { timeout: 5000 }).toBe(9);
    expect(await readCarry(page)).toBe(6);
    const after6 = await readWins(page);

    // A reject ends the combo.
    rejectWb(mock, 'ZZZQ');
    await page.waitForTimeout(80);

    // Next accept: streak 1 again → combo 1.1 → 66 + carry 6 = 72 → +7, carry 2. RESET: a
    // streak-7 combo would be 1.7 × 60 = 102 + 6 = 108 → +10.
    acceptWb(mock, 'DOG');
    await expect.poll(async () => (await readWins(page)) - after6, { timeout: 5000 }).toBe(7);
    expect(await readCarry(page)).toBe(2);
  });

  test('WB: the combo RESETS when I lose a life (my turn times out)', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TAW_LUCKY = 'off';
      window.__TAW_RARE_POP = 'off';
    });
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    await startWbMyTurn(mock, page);

    for (const w of C.slice(0, 5)) {
      acceptWb(mock, w);
      await page.waitForTimeout(40);
    }
    await bankSettle(page);
    const after5 = await readWins(page);

    // My turn times out → I drop a life (3 → 2). turn_timeout then a turn_update carrying the loss.
    mock.pushToClient({ type: 'turn_timeout', payload: {} });
    mock.pushToClient({
      type: 'turn_update',
      payload: {
        currentPlayerId: ME,
        players: [{ id: ME, name: 'YOU', lives: 2, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 3 }],
        combo: 'at',
        usedWords: [],
        timerSeconds: 30,
      },
    });
    await page.waitForTimeout(80);

    // Next accept (carry 0 after the five 100-XP-unit words): combo reset to 1.1 → 66 → +6, carry 6.
    // A continued streak-6 combo would be 1.6 × 60 = 96 → +9.
    expect(await readCarry(page)).toBe(0);
    acceptWb(mock, 'DOG');
    await expect.poll(async () => (await readWins(page)) - after5, { timeout: 5000 }).toBe(6);
    expect(await readCarry(page)).toBe(6);
  });

  test('WB: the payout INCLUDES the lucky ×5 when a word is lucky', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TAW_LUCKY = 'always'; // every accept is lucky → ×5 on the weight
      window.__TAW_RARE_POP = 'off';
    });
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    await startWbMyTurn(mock, page);
    const before = await readWins(page);

    // 3 COMMON three-letter accepts, each ×5 lucky, combo 1.1/1.2/1.3:
    //   1×1.1×5 + 1×1.2×5 + 1×1.3×5 = 5.5 + 6 + 6.5 = 18 weight × 60 = 1080 → +108, carry 0.
    //   (Flat, they would pay 3 × 6 = 18.)
    for (const w of ['CAT', 'DOG', 'FOX']) {
      acceptWb(mock, w);
      await page.waitForTimeout(40);
    }
    await expect.poll(async () => (await readWins(page)) - before, { timeout: 5000 }).toBe(108);
    expect(await readCarry(page)).toBe(0);
  });

  test('Blitz: the payout combo BUILDS and RESETS on a rejected answer', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TAW_LUCKY = 'off';
      window.__TAW_RARE_POP = 'off';
    });
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'X', categoryId: 'x', rerollsRemaining: 1 } });
    await page.waitForTimeout(60);
    const accept = (a) => mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: a } });

    for (const a of C.slice(0, 5)) {
      accept(a);
      await page.waitForTimeout(40);
    }
    await bankSettle(page);
    const after5 = await readWins(page);
    expect(await readCarry(page)).toBe(0); // 360 + 140 + 150, as in WB: nothing carried

    // 6th accept: C[5] is CAT (3 letters) and Blitz is MODE ×1 like Word Bomb, so 60 XP units/word.
    // Streak 6 → 1.6 × 60 = 96 → +9, carry 6 (identical to the WB test).
    accept(C[5]);
    await expect.poll(async () => (await readWins(page)) - after5, { timeout: 5000 }).toBe(9);
    expect(await readCarry(page)).toBe(6);
    const after6 = await readWins(page);

    // A rejected answer breaks the combo.
    mock.pushToClient({ type: 'answer_result', payload: { accepted: false, answer: 'ZZZQ', reason: 'not_in_list' } });
    await page.waitForTimeout(80);

    // Next accept: combo reset to 1.1 → 66 + carry 6 = 72 → +7, carry 2 (a streak-7 would be
    // 102 + 6 = 108 → +10).
    accept('DOG');
    await expect.poll(async () => (await readWins(page)) - after6, { timeout: 5000 }).toBe(7);
    expect(await readCarry(page)).toBe(2);
  });
});
