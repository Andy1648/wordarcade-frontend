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

async function bankSettle(page) {
  await page.waitForTimeout(200);
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

    // 6th accept: streak 6 → combo 1.6 → round10(1.6 × 40) = 60. BUILDS past the ×1.1 base 40.
    acceptWb(mock, C[5]);
    await expect.poll(async () => (await readWins(page)) - after5, { timeout: 5000 }).toBe(60);
    const after6 = await readWins(page);

    // A reject ends the combo.
    rejectWb(mock, 'ZZZQ');
    await page.waitForTimeout(80);

    // Next accept: streak 1 again → combo 1.1 → round10(1.1 × 40) = 40. RESET (would be 70 if it kept
    // climbing to streak 7).
    acceptWb(mock, 'DOG');
    await expect.poll(async () => (await readWins(page)) - after6, { timeout: 5000 }).toBe(40);
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

    // Next accept: combo reset to 1.1 → +40 (not the +70 a continued streak-7 would pay).
    acceptWb(mock, 'DOG');
    await expect.poll(async () => (await readWins(page)) - after5, { timeout: 5000 }).toBe(40);
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
    //   1×1.1×5 + 1×1.2×5 + 1×1.3×5 = 5.5 + 6 + 6.5 = 18 weight × 40 = round10(720) = 720.
    for (const w of ['CAT', 'DOG', 'FOX']) {
      acceptWb(mock, w);
      await page.waitForTimeout(40);
    }
    await expect.poll(async () => (await readWins(page)) - before, { timeout: 5000 }).toBe(720);
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

    // 6th accept: streak 6 → combo 1.6 → round10(1.6 × 20) = 30 (Blitz per-word 20). BUILDS past base 20.
    accept(C[5]);
    await expect.poll(async () => (await readWins(page)) - after5, { timeout: 5000 }).toBe(30);
    const after6 = await readWins(page);

    // A rejected answer breaks the combo.
    mock.pushToClient({ type: 'answer_result', payload: { accepted: false, answer: 'ZZZQ', reason: 'not_in_list' } });
    await page.waitForTimeout(80);

    // Next accept: combo reset to 1.1 → round10(1.1 × 20) = 20 (not the 30 a continued streak-7 pays).
    accept('DOG');
    await expect.poll(async () => (await readWins(page)) - after6, { timeout: 5000 }).toBe(20);
  });
});
