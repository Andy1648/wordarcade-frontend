// winner-bonus.spec.js — O12 (Andy oct2: cards show the end-of-round bonuses): WINNING a Word Bomb
// game pays +50% of what the game's words earned, as its own WINNER BONUS row on the round
// receipt AND a named line on WINS EARNED; losing pays none.
// H4 (oct3): +50% is now Word Bomb's FALLBACK — the rival here never plays a word, so the big match
// bonus (payout.js winnerPayout; announced only by the round-start "WIN = ×7 YOUR GAME" banner) is gated off and today's +50% still pays.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player';
const WORDS = ['STRAND', 'MINSTREL', 'STRIDE', 'ABSTRACT', 'STRAY', 'STREAM'];

async function playTo(page, winnerId) {
  const mock = await installBackendMock(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 12, into: 0 })); localStorage.setItem('taw.claims', '[]'); } catch { /* blocked */ }
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  const players = [
    { id: ME, name: 'YOU', lives: 3, isHost: true },
    { id: 'p1', name: 'PLAYER1', lives: 3 },
  ];
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [], timerSeconds: 30, maxLives: 3 } });
  await page.waitForTimeout(4800);
  const used = [];
  for (const w of WORDS) {
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w, playerId: ME } });
    await page.waitForTimeout(140);
    used.push(w);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: used, timerSeconds: 30, maxLives: 3 } });
    await page.waitForTimeout(140);
  }
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => Number(localStorage.getItem('taw.wins') || 0));
  mock.pushToClient({ type: 'game_over', payload: { winnerId, players } });
  // a re-delivered frame must not pay twice
  mock.pushToClient({ type: 'game_over', payload: { winnerId, players } });
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => Number(localStorage.getItem('taw.wins') || 0));
  return after - before;
}

test('winning pays +50% of the game, once, on its own receipt row and wins line', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const delta = await playTo(page, ME);
  // P9b: the results card itemises the bonus ONCE — its own tally line, with its ×1.5 (resultsModel.tallyLines)
  const line = page.locator('[data-wins-line="WINNER BONUS"]');
  await expect(line).toHaveCount(1);
  await expect(line).toContainText('WINNER BONUS');
  await expect(line).toContainText('×1.5');
  const amount = Number(await line.getAttribute('data-wins-amount'));
  expect(amount).toBeGreaterThan(0);
  expect(delta, 'the bonus is credited exactly once').toBe(amount);
  // +50% of the words: TOTAL = words + bonus, so bonus ≈ (TOTAL - bonus) / 2.
  const total = Number(await page.locator('[data-wins-total]').getAttribute('data-wins-total'));
  expect(Math.abs(amount - Math.round((total - amount) * 0.5))).toBeLessThanOrEqual(1);
});

test('losing pays no winner bonus', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const delta = await playTo(page, 'p1');
  await expect(page.locator('[data-wins-line="WINNER BONUS"]')).toHaveCount(0);
  expect(delta).toBe(0);
});
