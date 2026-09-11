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

// ---------------------------------------------------------------------------------------------
// WAITING ON STATE, NOT ON A CLOCK (fix/parity-wait)
//
// This spec used to separate a pushed WS frame from the next action with a fixed
// `page.waitForTimeout(80)` — 80ms of wall-clock for React to drain TWO frames and apply a combo
// reset. That is a bet on the machine being fast, and on a loaded 2 vCPU box it loses: the next
// accept fires against the OLD combo, the payout is computed on a streak that should have been
// cleared, and the assertion polls for a number that can never arrive. It showed up exactly once,
// in a full-suite run that had other work competing for the box, and never in isolation — the
// signature of a timing bet rather than a bug.
//
// Every wait below now keys on STATE the frame actually produces:
//   * the accept/reject TOAST is rendered from `lastWordResult` — it appears when the frame is
//     drained and stays until dismissed, so it is state, not motion, and it names the word.
//   * LIVES are counted as (total - lost), where "lost" means a grey heart OR one mid-shatter.
//     Counting the LOST ones is what makes this animation-proof: the shattering heart is still
//     pink, so counting pink hearts would wait on the animation. This reads the post-frame value
//     the instant the frame lands and keeps reading it after the shatter clears.
//   * WINS are polled for STABILITY rather than slept on.
// No app code changes — the behaviour under test is identical; only the synchronisation is.
// ---------------------------------------------------------------------------------------------

/** The toast rendered for the most recent result. '' when none is up. */
const toastText = (page) =>
  page.evaluate(() => (document.querySelector('.game-toast')?.textContent || '').toUpperCase());

/** Barrier: this exact word's result frame has been drained and rendered. */
async function awaitResult(page, word) {
  await expect.poll(() => toastText(page), { timeout: 8000 }).toContain(String(word).toUpperCase());
}

/** Barrier: a REJECTED result has been drained (the toast carries the `rejected` class). */
async function awaitReject(page) {
  await expect.poll(
    () => page.evaluate(() => !!document.querySelector('.game-toast.rejected')),
    { timeout: 8000 },
  ).toBe(true);
}

/** My rendered lives = hearts - lost, where lost = grey OR mid-shatter. Animation-proof. */
const livesShown = (page) =>
  page.evaluate(() => {
    const slot = document.querySelector('.game-player-bar .game-player-slot');
    if (!slot) return -1;
    const hearts = [...slot.querySelectorAll('.game-player-hearts .heart')];
    if (!hearts.length) return -1;
    const lost = hearts.filter(
      (h) => h.classList.contains('heart-shatter')
        || h.querySelector('path')?.getAttribute('fill') === '#555',
    ).length;
    return hearts.length - lost;
  });

/** Yield until the renderer has actually produced two frames.
 *  The Blitz test below never renders a board — it pushes `round_start` without a
 *  `game_started`, so the economy is driven purely through the WS handlers and there is no
 *  category, no toast and no card to observe. With no DOM state to key on, the next best thing
 *  is to wait on the RENDER PIPELINE rather than on a clock: two rAFs guarantee React has
 *  committed, and unlike a fixed sleep it stretches automatically when the box is loaded. */
const settleFrames = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** Barrier: the turn-loss frames have been drained and my life count has actually dropped. */
async function awaitLives(page, n) {
  await expect.poll(() => livesShown(page), { timeout: 8000 }).toBe(n);
}

async function startWbMyTurn(mock, page, { lives = 3 } = {}) {
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
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
  // Both frames are drained once the board has rendered BOTH player slots — the second frame is
  // what creates them, so seeing them proves the pair landed. (The queue is FIFO, so frame 1
  // cannot still be pending once frame 2 has been applied.)
  await expect.poll(
    () => page.evaluate(() => document.querySelectorAll('.game-player-bar .game-player-slot').length),
    { timeout: 8000 },
  ).toBe(2);
  await awaitLives(page, lives);
}
const acceptWb = (mock, word) => mock.pushToClient({ type: 'word_result', payload: { accepted: true, word } });
const rejectWb = (mock, word) => mock.pushToClient({ type: 'word_result', payload: { accepted: false, reason: 'not_a_word', word } });
// Six real COMMON words (rarity ×1) so the ONLY variable in the payout is the combo multiplier.
const C = ['WATER', 'TABLE', 'CHAIR', 'APPLE', 'HOUSE', 'CAT'];

/** Wait until the WINS balance has stopped moving, instead of guessing how long that takes. */
async function bankSettle(page) {
  let last = -1;
  let stable = 0;
  await expect.poll(async () => {
    const now = await readWins(page);
    stable = now === last ? stable + 1 : 0;
    last = now;
    return stable;
  }, { timeout: 8000, intervals: [40] }).toBeGreaterThanOrEqual(3);
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
      await awaitResult(page, w);
    }
    await bankSettle(page);
    const after5 = await readWins(page);

    // 6th accept: streak 6 → combo 1.6 → round10(1.6 × 40) = 60. BUILDS past the ×1.1 base 40.
    acceptWb(mock, C[5]);
    await expect.poll(async () => (await readWins(page)) - after5, { timeout: 5000 }).toBe(60);
    const after6 = await readWins(page);

    // A reject ends the combo.
    rejectWb(mock, 'ZZZQ');
    await awaitReject(page); // the combo-break frame is drained, not merely 80ms old

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
      await awaitResult(page, w);
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
    // THE ONE THAT BROKE. Two frames have to be drained and the combo reset applied before the
    // next accept is allowed to fire; an 80ms sleep was betting the box could do that in time.
    await awaitLives(page, 2);

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
      await awaitResult(page, w);
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
    await settleFrames(page);
    const accept = (a) => mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: a } });

    for (const a of C.slice(0, 5)) {
      accept(a);
      await settleFrames(page);
    }
    await bankSettle(page);
    const after5 = await readWins(page);

    // 6th accept: streak 6 → combo 1.6 → round10(1.6 × 20) = 30 (Blitz per-word 20). BUILDS past base 20.
    accept(C[5]);
    await expect.poll(async () => (await readWins(page)) - after5, { timeout: 5000 }).toBe(30);
    const after6 = await readWins(page);

    // A rejected answer breaks the combo.
    mock.pushToClient({ type: 'answer_result', payload: { accepted: false, answer: 'ZZZQ', reason: 'not_in_list' } });
    // No board is rendered here, so there is no reject toast to key on. Settle frames AND wait
    // for the balance to stop moving — together that guarantees the combo-break has committed
    // before the next accept is priced against it.
    await settleFrames(page);
    await bankSettle(page);

    // Next accept: combo reset to 1.1 → round10(1.1 × 20) = 20 (not the 30 a continued streak-7 pays).
    accept('DOG');
    await expect.poll(async () => (await readWins(page)) - after6, { timeout: 5000 }).toBe(20);
  });
});
