// e2e/blitz-break-showcase-fit.spec.js — the round-break SHOWCASE and the game-over AWARDS never scroll (Andy oct21: "NO
// SCROLLING — only things that are logically lists"). A 4- and an 8-player game at laptop, Chromebook and phone size:
// no element scrolls on the break or the final card, no answer card overflows its box (chips shrink, then fold into
// "+N"), and the break's moments + awards render.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const ME = 'e2e-player';
const NAMES = ['ANDY', 'KAI', 'MIA', 'BETTERTHANANDY', 'ZED', 'LOU', 'NOVA', 'RIO'];
const POOL = ['pepperoni', 'mushrooms', 'olives', 'pineapple', 'jalapenos', 'anchovies', 'basil', 'buffalo chicken', 'ham', 'bacon',
  'onions', 'spinach', 'garlic', 'sausage', 'feta', 'arugula', 'corn', 'tuna', 'egg', 'salami', 'capers', 'pesto', 'ricotta', 'tomato',
  'peppers', 'chicken', 'beef', 'mozzarella', 'parmesan', 'oregano', 'shrimp', 'broccoli', 'artichoke', 'prosciutto', 'chorizo'];

function results(n, round, seed) {
  return Array.from({ length: n }, (_, i) => {
    const cnt = [9, 6, 12, 4, 8, 3, 10, 5][(i + seed) % 8];
    const answers = [...new Set(Array.from({ length: cnt }, (_, k) => POOL[(i * 4 + k * (seed + 1) + round) % POOL.length]))];
    return { id: i === 0 ? ME : `p${i}`, name: NAMES[i], answers, roundScore: answers.length };
  });
}

const scrolling = () => [...document.querySelectorAll('*')].filter((e) => {
  const cs = getComputedStyle(e);
  return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1 && !e.closest('.cb-missed');
}).map((e) => String(e.className).slice(0, 40));

for (const [w, h] of [[1366, 768], [1366, 650], [390, 844]]) for (const n of [4, 8]) {
  test(`Blitz break showcase + awards fit with no scroll — ${n} players, ${w}x${h}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: w, height: h });
    await page.addInitScript(() => { try { localStorage.setItem('taw.seenGameSpotlight', '1'); } catch { /* storage blocked */ } });
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const players = NAMES.slice(0, n).map((name, i) => ({ id: i === 0 ? ME : `p${i}`, name, isHost: i === 0 }));
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', hostId: ME, players, gameType: 'category-blitz', status: 'waiting' } });
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
    const r1 = results(n, 1, 0);
    const r2 = results(n, 2, 3);
    for (const [round, res] of [[1, r1], [2, r2]]) {
      mock.pushToClient({ type: 'round_start', payload: { round, totalRounds: 2, timerSeconds: 30, category: 'Pizza toppings', categoryId: 'x', rerollsRemaining: 1, topN: 376 } });
      await expect(page.locator('.cb-category-display')).toBeVisible();
      mock.pushToClient({ type: 'round_end', payload: { round, totalRounds: 2, category: 'Pizza toppings', nextInMs: Math.min(18000, 8000 + 1500 * n), sampleAnswers: ['figs', 'clams', 'kimchi'], playerResults: res } });
      await expect(page.locator('.sc-show')).toBeVisible();
    }
    await expect(page.locator('.sc-card')).toHaveCount(n);
    await expect(page.locator('.sc-moment').first()).toBeVisible();
    await expect.poll(async () => page.evaluate((fn) => {
      const over = [...document.querySelectorAll('.sc-chips')].filter((c) => c.scrollHeight > c.clientHeight + 1).length;
      // eslint-disable-next-line no-new-func
      return { over, scroll: new Function(`return (${fn})()`)() };
    }, scrolling.toString()), { timeout: 8000 }).toEqual({ over: 0, scroll: [] });

    const totals = r1.map((p, i) => ({ id: p.id, name: p.name, score: p.roundScore + r2[i].roundScore }));
    mock.pushToClient({ type: 'game_over', payload: { winnerId: [...totals].sort((a, b) => b.score - a.score)[0].id, finalScores: totals } });
    await expect(page.locator('.sc-awards')).toBeVisible();
    await expect.poll(async () => page.evaluate((fn) => new Function(`return (${fn})()`)(), scrolling.toString()), { timeout: 5000 }).toEqual([]);
  });
}
