// e2e/coverage.spec.js — test/coverage-gaps: open every menu-reachable screen/dialog/overlay
// and assert it renders with ZERO real console/page errors. This is the guard class that was
// missing when the Stats crash shipped with a green suite (no test had opened Stats). Backend-
// driven screens (room / in-game / multiplayer game-over) are covered separately where feasible.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

// Network-resource failures (the backend mock blocks the socket; favicon/asset 404s) are
// test-harness noise. A real bug is a pageerror (uncaught exception — the Stats ReferenceError
// was exactly this) or a genuine application console.error.
const isNoise = (t) => /Failed to load resource|net::ERR|ERR_FAILED|the server responded with a status of|status of \d{3}|favicon/i.test(t);

function attach(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
}

async function menu(page, errors, level) {
  attach(page, errors);
  await installBackendMock(page);
  if (level != null) {
    await page.addInitScript((lv) => {
      try {
        localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 }));
        localStorage.setItem('taw.wins', '999999');
      } catch { /* ignore */ }
    }, level);
  }
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
}
const card = (page, id) => page.locator(`.game-card-magnet[data-game="${id}"] .game-card`);
const assertClean = (errors) => expect(errors, `errors: ${errors.join(' | ')}`).toHaveLength(0);

test.describe('every menu-reachable screen renders without console errors', () => {
  test('SPLASH (first-time visitor)', async ({ page }) => {
    const errors = [];
    attach(page, errors);
    await installBackendMock(page);
    await page.goto('/'); // fresh context, no ?portal → the splash shows
    await page.locator('.splash-screen').waitFor({ state: 'visible' });
    await page.waitForTimeout(300);
    assertClean(errors);
  });

  test('WORD BOMB mode dialog', async ({ page }) => {
    const errors = [];
    await menu(page, errors, 30);
    await card(page, 'word-bomb').click();
    await expect(page.locator('.mode-dialog-shell')).toBeVisible();
    await page.waitForTimeout(300);
    assertClean(errors);
  });

  test('CATEGORY BLITZ mode dialog + PACK PICKER', async ({ page }) => {
    const errors = [];
    await menu(page, errors, 30);
    await card(page, 'category-blitz').click();
    await expect(page.locator('.mode-dialog-shell')).toBeVisible();
    await expect(page.locator('.ppp-picker')).toBeVisible(); // pack picker lives in the blitz dialog
    await page.waitForTimeout(300);
    assertClean(errors);
  });

  test('CHAIN mode dialog (unlocked)', async ({ page }) => {
    const errors = [];
    await menu(page, errors, 30);
    await card(page, 'chain').click();
    await expect(page.locator('.mode-dialog-shell')).toBeVisible();
    await page.waitForTimeout(300);
    assertClean(errors);
  });

  test('FUSE mode dialog (unlocked)', async ({ page }) => {
    const errors = [];
    await menu(page, errors, 30);
    await card(page, 'fuse').click();
    await expect(page.locator('.mode-dialog-shell')).toBeVisible();
    await page.waitForTimeout(300);
    assertClean(errors);
  });

  test('CHAIN locked preview', async ({ page }) => {
    const errors = [];
    await menu(page, errors, 1); // below LV15
    await card(page, 'chain').click({ force: true });
    await expect(page.locator('.lp-panel')).toBeVisible();
    await page.waitForTimeout(300);
    assertClean(errors);
  });

  test('FUSE locked preview', async ({ page }) => {
    const errors = [];
    await menu(page, errors, 16); // below LV22
    await card(page, 'fuse').click({ force: true });
    await expect(page.locator('.lp-panel')).toBeVisible();
    await page.waitForTimeout(300);
    assertClean(errors);
  });

  test('CREDITS screen', async ({ page }) => {
    const errors = [];
    await menu(page, errors, 30);
    await page.locator('.homepage-credits-link').click();
    await expect(page.locator('.credits-wrap')).toBeVisible();
    await page.waitForTimeout(300);
    assertClean(errors);
  });

  test('LOBBY screen (CREATE a room)', async ({ page }) => {
    const errors = [];
    await menu(page, errors, 30);
    await card(page, 'word-bomb').click();
    await page.locator('.mode-dialog-btn-create').click(); // CREATE → lobby
    await expect(page.locator('.lobby-wrap')).toBeVisible();
    await page.waitForTimeout(300);
    assertClean(errors);
  });

  test('PUBLIC ROOMS browser (JOIN)', async ({ page }) => {
    const errors = [];
    await menu(page, errors, 30);
    await page.locator('.homepage-btn-join').click(); // JOIN ROOM → browser
    await expect(page.locator('.browser-wrap')).toBeVisible();
    await page.waitForTimeout(300);
    assertClean(errors);
  });

  test('ROOM screen (waiting room via room_update)', async ({ page }) => {
    const errors = [];
    attach(page, errors);
    const mock = await installBackendMock(page);
    await page.goto('/?portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    // Drive the app into the waiting room with a plausible room_update frame.
    mock.pushToClient({
      type: 'room_update',
      payload: {
        code: 'ABCD',
        gameType: 'word-bomb',
        hostId: 'p1',
        difficultyKey: 'chill',
        players: [{ id: 'p1', name: 'YOU', lives: 3, isHost: true }],
      },
    });
    await expect(page.locator('.room-wrap')).toBeVisible();
    await page.waitForTimeout(300);
    assertClean(errors);
  });

  test('WORD BOMB in-game view (game_started)', async ({ page }) => {
    const errors = [];
    attach(page, errors);
    const mock = await installBackendMock(page);
    await page.goto('/?portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: 'p1', difficultyKey: 'chill', players: [{ id: 'p1', name: 'YOU', lives: 3, isHost: true }] } });
    await page.waitForTimeout(120);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
    await expect(page.locator('.game-wrap')).toBeVisible();
    await page.waitForTimeout(300);
    assertClean(errors);
  });
});
