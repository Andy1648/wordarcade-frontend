// e2e/wins.spec.js
//
// The WINS wiring (item 2): the app subscribes to round-end events that ALREADY fire and
// pays out from data it already has. Here the backend mock delivers a Category Blitz round
// (round_start → accepted answer_results → round_end) over the same intercepted socket the
// app listens on; the real App.jsx handlers count MY accepted answers and call recordRound.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const readWins = (page) =>
  page.evaluate(() => {
    const num = (k) => Number(localStorage.getItem(k)) || 0;
    let blitz = 0;
    try {
      blitz = JSON.parse(localStorage.getItem('taw.rounds') || '{}').blitz || 0;
    } catch {
      blitz = 0;
    }
    return { wins: num('taw.wins'), lifetime: num('taw.winsLifetime'), blitz };
  });

async function playBlitzRound(mock, page, answers) {
  mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'X', categoryId: 'x', rerollsRemaining: 1 } });
  await page.waitForTimeout(40);
  for (const a of answers) mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: a } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'round_end', payload: { playerResults: [] } });
  await page.waitForTimeout(150);
}

test.describe('wins wiring', () => {
  test('a Blitz round_end with 3 accepted answers pays 30 and counts the round', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const before = await readWins(page);
    await playBlitzRound(mock, page, ['CAT', 'DOG', 'FOX']); // 3 accepted → awardWins(3) = 3×10 = 30 (Economy v5 per-word)
    const after = await readWins(page);
    expect(after.wins - before.wins).toBe(30);
    expect(after.lifetime - before.lifetime).toBe(30);
    expect(after.blitz - before.blitz).toBe(1);
  });

  test('a Blitz round with <3 accepted answers pays nothing and does not count', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const before = await readWins(page);
    await playBlitzRound(mock, page, ['CAT', 'DOG']); // only 2 → no payout, no round counted
    const after = await readWins(page);
    expect(after.wins - before.wins).toBe(0);
    expect(after.blitz - before.blitz).toBe(0);
  });
});
