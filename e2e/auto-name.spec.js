// e2e/auto-name.spec.js — EVERY VISITOR GETS A NAME (Andy oct13): a fresh browser with no board name claims a
// generated one (or its multiplayer name) on its first key, through the real lb_claim (board mock), and shows up on
// the leaderboard as YOU — no CLAIM step. A browser that already has a name claims nothing.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

async function boot(page, { stored = null, named = false } = {}) {
  await page.setViewportSize({ width: 1366, height: 657 });
  await installBackendMock(page, { autoName: true });
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const shared = { rows: [], secrets: new Map(), saves: new Map() };
  const board = await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, season2: true });
  await page.addInitScript(({ stored, named }) => {
    if (sessionStorage.getItem('an.seeded')) return;
    sessionStorage.setItem('an.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.reveal', 'all'); // the whole menu (the first-run reveal hides the board on a brand-new save)
    if (stored) localStorage.setItem('wa_playername', stored);
    if (named) localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'x', username: 'ALREADY' }));
  }, { stored, named });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'leaderboard').waitFor({ state: 'visible' });
  return { board, shared };
}
const profile = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('taw.lb.profile') || 'null'));

test('a fresh visitor gets a generated board name on the first key — no sign-up', async ({ page }) => {
  const { shared } = await boot(page);
  expect(await profile(page)).toBeNull();
  await page.keyboard.press('a');
  await expect.poll(async () => (await profile(page))?.username || '', { timeout: 10_000 }).toMatch(/^[A-Z]+\d{2}$/);
  const name = (await profile(page)).username;
  expect(shared.rows.some((r) => r.username === name)).toBe(true);
  // the multiplayer name is now the same one
  expect(await page.evaluate(() => localStorage.getItem('wa_playername'))).toBe(name);
  await navControl(page, 'leaderboard').click();
  await expect(page.locator('.lb2')).toContainText(name);
});

test('the multiplayer name is reused; a browser that already has a name claims nothing', async ({ page, browser }) => {
  await boot(page, { stored: 'Andy_99' });
  await page.keyboard.press('a');
  await expect.poll(async () => (await profile(page))?.username || '', { timeout: 10_000 }).toBe('Andy_99');
  const p2 = await browser.newPage();
  const { shared } = await boot(p2, { named: true });
  await p2.keyboard.press('a');
  await p2.waitForTimeout(1500);
  expect(shared.rows.length).toBe(0);
  expect((await profile(p2)).username).toBe('ALREADY');
  await p2.close();
});
