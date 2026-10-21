// e2e/blitz-round-break.spec.js — the break between Blitz rounds counts down what the server waits (Andy oct19: "it should
// somewhat scale so people can read each others"). round_end carries nextInMs (4 s + 1 s per player, max 10 s); the
// results screen counts it down. An older server sends none → the old flat 5 s.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const ME = 'e2e-player';

async function toResults(page, roundEnd) {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  const players = [{ id: ME, name: 'ANDY', isHost: true }, { id: 'p2', name: 'RIVAL' }, { id: 'p3', name: 'KAI' }, { id: 'p4', name: 'MIA' }];
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', hostId: ME, players, gameType: 'category-blitz', status: 'waiting' } });
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
  mock.pushToClient({ type: 'round_start', payload: { round: 1, totalRounds: 3, timerSeconds: 30, category: 'Pizza toppings', categoryId: 'pizza', rerollsRemaining: 1, topN: 376 } });
  await expect(page.locator('.cb-answers-list, .cb-category-display').first()).toBeVisible();
  mock.pushToClient({ type: 'round_end', payload: { round: 1, totalRounds: 3, category: 'Pizza toppings', playerResults: [], sampleAnswers: [], ...roundEnd } });
  return page.locator('.cb-next-round');
}

test('a 4-player break counts down from the server\'s 8 seconds', async ({ page }) => {
  const line = await toResults(page, { nextInMs: 8000 });
  await expect(line).toContainText('NEXT ROUND IN 8 SECONDS');
  await expect(line).toContainText(/NEXT ROUND IN [1-6] SECONDS?/, { timeout: 4000 });
});

test('an older server (no nextInMs) still reads the old 5 seconds', async ({ page }) => {
  const line = await toResults(page, {});
  await expect(line).toContainText('NEXT ROUND IN 5 SECONDS');
});
