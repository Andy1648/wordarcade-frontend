// e2e/blitz-answers-fit.spec.js — YOUR ANSWERS NEVER SCROLLS on a laptop (Andy oct19: "on category blitz on chromebook
// im getting a scroll bar to see the answers. I DONT WANT SCROLL BARS … the answers can just shrink").
// A FULL 8-player lobby with 24 accepted answers at the Chromebook sizes: the answers list shows every chip with no
// overflow (it shrinks a step instead), the rail stays on screen, and the newest answer leads the list.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const ME = 'e2e-player';
const ANSWERS = ['PEPPERONI', 'MUSHROOMS', 'OLIVES', 'PINEAPPLE', 'JALAPENOS', 'ANCHOVIES', 'BASIL', 'BUFFALO CHICKEN',
  'HAM', 'BACON', 'ONIONS', 'SPINACH', 'GARLIC', 'SAUSAGE', 'FETA', 'ARUGULA', 'CORN', 'TUNA', 'EGG', 'SALAMI', 'CAPERS',
  'PESTO', 'RICOTTA', 'TOMATO'];
const RIVALS = ['RIVAL', 'BOTZILLA', 'BETTERTHANANDY', 'KAI', 'MIA', 'ZED', 'LOU'];

for (const [w, h] of [[1366, 768], [1280, 800], [1280, 720], [1024, 768]]) {
  test(`Blitz answers fit with no scrollbar — full lobby, 24 answers, ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.addInitScript(() => {
      window.__TAW_LUCKY = 'off';
      window.__TAW_RARE_POP = 'off';
      try { localStorage.setItem('taw.seenGameSpotlight', '1'); } catch { /* storage blocked */ }
    });
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const players = [{ id: ME, name: 'ANDY', isHost: true }, ...RIVALS.map((name, i) => ({ id: `p${i}`, name }))];
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', hostId: ME, players, gameType: 'category-blitz', status: 'waiting' } });
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
    mock.pushToClient({ type: 'round_start', payload: { round: 1, totalRounds: 3, timerSeconds: 60, category: 'Pizza toppings', categoryId: 'pizza', rerollsRemaining: 1, topN: 376, pack: 'food' } });
    await expect(page.locator('.cb-answers-list')).toBeVisible();
    for (const answer of ANSWERS) mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer } });
    RIVALS.forEach((_, i) => mock.pushToClient({ type: 'player_progress', payload: { playerId: `p${i}`, answerCount: 3 + i } }));
    await expect(page.locator('.cb-answer-chip')).toHaveCount(ANSWERS.length);
    await expect(page.locator('.cb-answers-count')).toContainText('24');
    await expect(page.locator('.cb-answers-count')).toContainText('/376');

    await expect.poll(async () => page.evaluate(() => {
      const list = document.querySelector('.cb-answers-list');
      const box = list.getBoundingClientRect();
      const side = document.querySelector('.cb-round-side').getBoundingClientRect();
      const clipped = [...list.querySelectorAll('.cb-answer-chip')].filter((c) => {
        const r = c.getBoundingClientRect();
        return r.bottom > box.bottom + 1 || r.right > box.right + 1;
      }).length;
      return { overflow: list.scrollHeight - list.clientHeight > 1, clipped, railOnScreen: side.bottom <= innerHeight };
    }), { timeout: 5000 }).toEqual({ overflow: false, clipped: 0, railOnScreen: true });

    // newest first: the last accepted answer is the first chip the eye meets
    const firstShown = await page.evaluate(() => {
      const chips = [...document.querySelectorAll('.cb-answer-chip')];
      return chips.sort((a, b) => Number(getComputedStyle(a).order) - Number(getComputedStyle(b).order))[0].textContent;
    });
    expect(firstShown).toBe('TOMATO');
  });
}
