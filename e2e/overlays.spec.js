// e2e/overlays.spec.js — the overlays must RENDER and throw ZERO console/page errors. This is
// the guard that was missing when StatsScreen crashed on an undefined `keyPower` (a ReferenceError
// that blanked the app) while the whole suite stayed green: nothing had opened Stats and watched
// the console. Covers Stats, Shop, and the Rebirth view — each opened from its own menu icon.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

// Seed a realistic progressed state so every readout (KEY POWER tier, wins, rebirth mult, level)
// renders with real values rather than the empty defaults.
const SEED = {
  'taw.keytier': '3',
  'taw.wins': '5000',
  'taw.winsLifetime': '9000',
  'taw.xp': JSON.stringify({ lv: 18, into: 40 }),
  'taw.rebirths': '2',
  'taw.letters': '1234',
};

// Network-resource failures (the backend mock blocks the socket; a favicon/asset may 404) are
// test-harness noise, not app errors — ignore those, but catch every real JS error: an uncaught
// exception (pageerror — the StatsScreen ReferenceError was exactly this) or a genuine
// console.error from application code.
const isResourceNoise = (t) =>
  /Failed to load resource|net::ERR|ERR_FAILED|the server responded with a status of|status of \d{3}|favicon/i.test(t);

async function gotoSeededMenu(page, errors) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !isResourceNoise(m.text())) errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await installBackendMock(page);
  await page.addInitScript((s) => {
    try {
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  }, SEED);
  await page.goto('/?portal=1');
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
}

test.describe('overlays render without console errors', () => {
  test('STATS opens, renders the panel, and throws zero errors', async ({ page }) => {
    const errors = [];
    await gotoSeededMenu(page, errors);
    await page.locator('.homepage-stats-btn').click();
    const panel = page.locator('.stats-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('KEY POWER'); // the row that used to crash
    await expect(panel).toContainText('T3'); // shows the TIER, not "LV undefined"
    await page.waitForTimeout(150);
    expect(errors, `console/page errors: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('SHOP opens, renders the panel, and throws zero errors', async ({ page }) => {
    const errors = [];
    await gotoSeededMenu(page, errors);
    await page.locator('.homepage-shop-btn').click();
    const panel = page.locator('.shop-panel');
    await expect(panel).toBeVisible();
    await expect(page.locator('.shop-title')).toHaveText('SHOP');
    await page.waitForTimeout(150);
    expect(errors, `console/page errors: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('REBIRTH opens, renders the panel, and throws zero errors', async ({ page }) => {
    const errors = [];
    await gotoSeededMenu(page, errors);
    await page.locator('.homepage-rebirth-btn').click();
    const panel = page.locator('.shop-panel');
    await expect(panel).toBeVisible();
    await expect(page.locator('.shop-title')).toHaveText('REBIRTH');
    await page.waitForTimeout(150);
    expect(errors, `console/page errors: ${errors.join(' | ')}`).toHaveLength(0);
  });
});
