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
// e2e/parity-wb-blitz.spec.js — feat/parity-wb-blitz.
// Word Bomb + Category Blitz now score with the SAME combo (+0.1 per consecutive accept, ×3 cap) and
// lucky (1/40 ×5) that CHAIN/FUSE use — folded into the per-word reward WEIGHT (reused combo.js /
// luck.js, no forked logic). These tests drive the real App.jsx WS handlers over the mock socket and
// assert, via the WINS payout: the combo BUILDS across accepts, RESETS on a reject and on a turn-loss
// (life lost), and the payout INCLUDES the lucky ×5. The 1/40 lucky draw is pinned via the
// window.__TAW_LUCKY test seam so payouts are deterministic.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const ME = 'e2e-player';
const readWins = (page) => page.evaluate(() => Number(localStorage.getItem('taw.wins')) || 0);

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

    // 6th accept: C[5] is CAT, three letters, so perWordWins is 6 (10 XP/letter × 3 × WB ×2 ÷ 10).
    // Streak 6 → combo 1.6 → round(1.6 × 6) = 10. BUILDS past the ×1.1 base of 7.
    acceptWb(mock, C[5]);
    await expect.poll(async () => (await readWins(page)) - after5, { timeout: 5000 }).toBe(10);
    const after6 = await readWins(page);

    // A reject ends the combo.
    rejectWb(mock, 'ZZZQ');
    await page.waitForTimeout(80);

    // Next accept: streak 1 again → combo 1.1 → round(1.1 × 6) = 7. RESET (would be 11 if it kept
    // climbing to streak 7).
    acceptWb(mock, 'DOG');
    await expect.poll(async () => (await readWins(page)) - after6, { timeout: 5000 }).toBe(7);
  });

  test('WB: the combo RESETS when I lose a life (my turn times out)', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TAW_LUCKY = 'off';
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

    // Next accept: combo reset to 1.1 → +7 (not the +11 a continued streak-7 would pay).
    acceptWb(mock, 'DOG');
    await expect.poll(async () => (await readWins(page)) - after5, { timeout: 5000 }).toBe(7);
  });

  test('WB: the payout INCLUDES the lucky ×5 when a word is lucky', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TAW_LUCKY = 'always'; // every accept is lucky → ×5 on the weight
    });
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    await startWbMyTurn(mock, page);
    const before = await readWins(page);

    // 3 COMMON accepts, each ×5 lucky, combo 1.1/1.2/1.3:
    //   1×1.1×5 + 1×1.2×5 + 1×1.3×5 = 5.5 + 6 + 6.5 = 18 weight × 6 = 108.
    for (const w of ['CAT', 'DOG', 'FOX']) {
      acceptWb(mock, w);
      await page.waitForTimeout(40);
    }
    await expect.poll(async () => (await readWins(page)) - before, { timeout: 5000 }).toBe(108);
  });

  test('Blitz: the payout combo BUILDS and RESETS on a rejected answer', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TAW_LUCKY = 'off';
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

    // 6th accept: C[5] is CAT (3 letters) and Blitz is ×2 on the one per-mode table now, so
    // perWordWins is 6. Streak 6 → combo 1.6 → round(1.6 × 6) = 10. BUILDS past the ×1.1 base of 7.
    accept(C[5]);
    await expect.poll(async () => (await readWins(page)) - after5, { timeout: 5000 }).toBe(10);
    const after6 = await readWins(page);

    // A rejected answer breaks the combo.
    mock.pushToClient({ type: 'answer_result', payload: { accepted: false, answer: 'ZZZQ', reason: 'not_in_list' } });
    await page.waitForTimeout(80);

    // Next accept: combo reset to 1.1 → round(1.1 × 6) = 7 (not the 11 a streak-7 would pay).
    accept('DOG');
    await expect.poll(async () => (await readWins(page)) - after6, { timeout: 5000 }).toBe(7);
  });
});
