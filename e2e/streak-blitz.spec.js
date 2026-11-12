// e2e/streak-blitz.spec.js — THE STREAK in Category Blitz (nov12, the Word Bomb pass, Andy: "they need to feel benefits of
// playing"). Accepted answers in a row climb the HITS count and heat the category card; the game-over names the game's best streak
// as a NEW RECORD. STREAK_SHOTS=<dir> saves streak 0 / 5 / 11 / game-over.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player';
const SHOTS = process.env.STREAK_SHOTS || '';
const ANSWERS = ['apple', 'pear', 'plum', 'kiwi', 'mango', 'lime', 'fig', 'date', 'lemon', 'melon', 'grape'];

for (const [w, h] of [[390, 844], [1366, 768]]) {
  test(`BLITZ ${w}x${h}: answers in a row climb the streak and heat the card; the game-over names the best`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const mock = await installBackendMock(page);
    await page.addInitScript(() => { for (const [k, v] of Object.entries({ 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seenGameSpotlight': '1' })) localStorage.setItem(k, v); });
    await page.goto('/?portal=1');
    await menuReady(page);
    const players = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } });
    await page.locator('.game-input').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(5500); // the round countdown
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/blitz-${w}-s0.png` });
    const send = async (n, from) => { for (let i = from; i < n; i++) { mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: ANSWERS[i] } }); await page.waitForTimeout(200); } };
    await send(5, 0);
    await expect(page.locator('.cb-combo-host .combo-count')).toHaveText('5');
    await expect(page.locator('.game-stage--blitz')).toHaveAttribute('data-heat', '2');
    if (SHOTS) { await page.waitForTimeout(900); await page.screenshot({ path: `${SHOTS}/blitz-${w}-s5.png` }); }
    await send(11, 5);
    await expect(page.locator('.cb-combo-host .combo-count')).toHaveText('11');
    await expect(page.locator('.game-stage--blitz')).toHaveAttribute('data-heat', '4');
    if (SHOTS) { await page.waitForTimeout(1300); await page.screenshot({ path: `${SHOTS}/blitz-${w}-s11.png` }); }
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME, finalScores: [{ id: ME, name: 'YOU', score: 110 }, { id: 'p2', name: 'RIVAL', score: 40 }] } });
    await expect(page.getByTestId('cb-peak')).toContainText('11 BEST STREAK');
    await expect(page.getByTestId('cb-peak')).toContainText('NEW RECORD');
    await expect(page.getByTestId('cb-peak')).toHaveAttribute('data-heat', '4');
    if (SHOTS) { await page.waitForTimeout(1500); await page.screenshot({ path: `${SHOTS}/blitz-${w}-over.png` }); }
  });
}
