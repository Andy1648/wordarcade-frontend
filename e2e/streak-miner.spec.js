// e2e/streak-miner.spec.js — THE STRIKE STREAK in MINER (nov12, the Word Bomb pass, Andy: "they need to feel benefits of playing").
// Rounds in a row your answer struck COAL or better climb the count on the dig panel and heat the sign; a DIRT strike breaks it;
// the end names the best run as a NEW RECORD. STREAK_SHOTS=<dir> saves streak 0 / 5 / 10 / the end.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const SHOTS = process.env.STREAK_SHOTS || '';
const ORE = ['coal', 'gold', 'coal', 'diamond', 'gold', 'coal', 'gold', 'coal', 'gold', 'diamond'];

for (const [w, h] of [[390, 844], [1366, 768]]) {
  test(`MINER ${w}x${h}: strikes in a row climb the streak and heat the sign; DIRT breaks it; the end names the best`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: w, height: h });
    const mock = await installBackendMock(page);
    await page.goto('/miner/play');
    await page.locator('.lobby-continue-btn').click();
    await mock.waitForSent('create_room');
    mock.pushToClient({ type: 'room_created', payload: { code: 'MINE1' } });
    const miners = [{ id: ME, name: 'ANNA', depth: 0 }, { id: 'b1', name: 'BOT', isBot: true, depth: 0 }];
    mock.pushToClient({ type: 'room_update', payload: { code: 'MINE1', hostId: ME, gameType: 'miner', isPublic: true, players: miners } });
    await page.getByTestId('miner-lobby').waitFor();
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'miner' } });
    await page.waitForTimeout(80);
    const now = Date.now();
    mock.pushToClient({ type: 'miner_start', payload: { serverNow: now, goAt: now + 50, miners, target: 500, lives: 3 } });
    const round = async (n, ore) => {
      const t = Date.now();
      mock.pushToClient({ type: 'miner_round', payload: { serverNow: t, round: n, prompt: 'pizza toppings', ask: 'PIZZA TOPPING', endsAt: t + 15000, roundMs: 15000 } });
      await page.getByTestId('miner-prompt').waitFor();
      if (ore) mock.pushToClient({ type: 'miner_result', payload: { accepted: true, answer: `anchovy${n}`, ore, depth: 25, top: 3 } });
      await page.waitForTimeout(150);
    };
    await round(1, null);
    if (SHOTS) { await page.waitForTimeout(400); await page.screenshot({ path: `${SHOTS}/miner-${w}-s0.png` }); }
    for (let i = 0; i < 5; i++) await round(i + 2, ORE[i]); // round 1 had no answer: the streak starts at round 2
    await expect(page.locator('.mn-streak .combo-count')).toHaveText('5');
    await expect(page.locator('.mn-root')).toHaveAttribute('data-heat', '2');
    if (SHOTS) { await page.waitForTimeout(900); await page.screenshot({ path: `${SHOTS}/miner-${w}-s5.png` }); }
    for (let i = 5; i < 10; i++) await round(i + 2, ORE[i]);
    await expect(page.locator('.mn-streak .combo-count')).toHaveText('10');
    await expect(page.locator('.mn-root')).toHaveAttribute('data-heat', '4');
    const m = await page.evaluate(() => {
      const b = document.querySelector('.mn-streak .combo-badge').getBoundingClientRect();
      return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight;
    });
    expect(m, 'the streak is inside the window').toBe(true);
    if (SHOTS) { await page.waitForTimeout(1300); await page.screenshot({ path: `${SHOTS}/miner-${w}-s10.png` }); }
    await round(12, 'dirt'); // DIRT breaks it
    await expect(page.locator('.mn-streak .combo-badge')).toHaveCount(0);
    mock.pushToClient({ type: 'miner_over', payload: { winnerIds: [ME], reason: 'core', rounds: 12, standings: [{ id: ME, name: 'ANNA', depth: 520, best: { ore: 'diamond', text: 'ANCHOVY' } }, { id: 'b1', name: 'BOT', isBot: true, depth: 200 }] } });
    await expect(page.getByTestId('miner-peak')).toContainText('10 STRIKES IN A ROW');
    await expect(page.getByTestId('miner-peak')).toContainText('NEW RECORD');
    if (SHOTS) { await page.waitForTimeout(1200); await page.screenshot({ path: `${SHOTS}/miner-${w}-over.png` }); }
  });
}
