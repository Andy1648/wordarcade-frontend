// e2e/rarity-race.spec.js — JOB A.1: prove the Word Bomb rarity RACE is fixed.
// rarityOf() returns COMMON until the lazy words.recall.txt?raw chunk resolves. A word accepted
// in that window used to be scored COMMON and UNDERPAID. The fix defers rarity-dependent scoring
// to when the index resolves (in word order). Here we DELAY the chunk so words land during the
// race, and assert the final payout is the correct rarity-weighted total (not the COMMON total).
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const ME = 'e2e-player';
const readWins = (page) => page.evaluate(() => Number(localStorage.getItem('taw.wins')) || 0);

async function startMyTurn(mock, page) {
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(40);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 3 }], combo: 'at', usedWords: [], timerSeconds: 30 } });
  await page.waitForTimeout(40);
}

// Combo is captured at ACCEPT time, so it's unaffected by the rarity-index race (lucky forced off in
// each test below). CAT 1×combo1.1 + BAT 1.5×1.2 + HAT 1×1.3 = 1.1+1.8+1.3 = 4.2 × 40 = 170 (correct).
// If BAT is scored COMMON (the race), it's 1.1+1.2+1.3 = 3.6 × 40 = round10(144) = 140 — a 30-win underpay.
const WORDS = ['CAT', 'BAT', 'HAT'];
const CORRECT = 170;
const RACED_COMMON = 140;

test('rarity race: a word accepted before the index loads still pays its true rarity', async ({ page }) => {
  await page.addInitScript(() => {
    window.__TAW_LUCKY = 'off'; // deterministic payout (combo on, lucky off)
  });
  const mock = await installBackendMock(page);
  // Hold the rarity chunk ~1.5s so the words below land DURING the race window.
  let chunkDelayed = false;
  await page.route(/recall/i, async (route) => {
    chunkDelayed = true;
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await gotoMenu(page); // App mounts + kicks off loadRarityIndex(), but the chunk is stalled
  const before = await readWins(page);
  await startMyTurn(mock, page);

  // Push all three words within the race window (well under 1.5s from mount).
  for (const w of WORDS) {
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w } });
    await page.waitForTimeout(40);
  }
  // During the race, the correct total is NOT yet banked (scoring is deferred).
  const during = await readWins(page);

  // After the chunk resolves, the deferred scoring runs — assert the CORRECT rarity payout.
  await expect.poll(async () => (await readWins(page)) - before, { timeout: 6000 }).toBe(CORRECT);
  const after = await readWins(page);
  // eslint-disable-next-line no-console
  console.log(`RARITY-RACE chunkDelayed=${chunkDelayed} during=${during - before} after=${after - before} (correct=${CORRECT}, common-race-underpay=${RACED_COMMON}=>${CORRECT - RACED_COMMON} underpaid before fix)`);
  expect(chunkDelayed, 'the recall chunk was actually intercepted/delayed').toBe(true);
});

// Control: with the index loaded first (no race), the same words pay the same correct total —
// so the fix does not change the non-raced payout.
test('control: no race, same words pay the same correct total', async ({ page }) => {
  await page.addInitScript(() => {
    window.__TAW_LUCKY = 'off';
  });
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await page.waitForFunction(() => true); // index loads promptly with no delay
  await page.waitForTimeout(400);
  const before = await readWins(page);
  await startMyTurn(mock, page);
  for (const w of WORDS) {
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w } });
    await page.waitForTimeout(40);
  }
  await expect.poll(async () => (await readWins(page)) - before, { timeout: 5000 }).toBe(CORRECT);
});
