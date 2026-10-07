// e2e/overlays.spec.js — the overlays must RENDER and throw ZERO console/page errors. This is
// the guard that was missing when StatsScreen crashed on an undefined `keyPower` (a ReferenceError
// that blanked the app) while the whole suite stayed green: nothing had opened Stats and watched
// the console. Covers Stats, Shop, and the Rebirth view — each opened from its own menu icon.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { openStats } from './support/menu.js';

// Seed a realistic progressed state so every readout (KEY TIER tier, wins, rebirth mult, level)
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
    await openStats(page); // claims ride STATS (Andy oct2 A4)
    const panel = page.locator('.stats-panel');
    await expect(panel).toBeVisible();
    // STAT BOARD (Andy oct5; numbers audit: + MODE and INDEX lines): WINS / WORD and XP / LETTER, each BASE → lines → TOTAL
    await expect(panel.locator('.sb')).toHaveCount(2);
    await expect(panel.locator('.sb--wins .sb-line')).toHaveText([/^MODE/, /^REBIRTH/, /^MARK/, /^INDEX/, /^BOOST/]);
    await expect(panel.locator('.sb--xp .sb-line')).toHaveText([/^POWER/, /^REBIRTH/, /^MARK/, /^INDEX/, /^BOOST/]);
    await expect(panel.locator('.sb-total-v')).toHaveCount(2);
    await expect(panel.locator('.sb--xp .sb-line[data-line="key"]')).toContainText('TIER 3'); // shows the TIER, not "LV undefined"
    await page.waitForTimeout(150);
    expect(errors, `console/page errors: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('UPGRADES (was SHOP) opens, renders the panel, and throws zero errors', async ({ page }) => {
    const errors = [];
    await gotoSeededMenu(page, errors);
    await page.locator('.homepage-nav-btn.is-shop').click();
    const panel = page.locator('.shop-panel');
    await expect(panel).toBeVisible();
    await expect(page.locator('.shop-title')).toHaveText('UPGRADES'); // SEASON 2 #5: SHOP → UPGRADES
    await page.waitForTimeout(150);
    expect(errors, `console/page errors: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('REBIRTH opens, renders the panel, and throws zero errors', async ({ page }) => {
    const errors = [];
    await gotoSeededMenu(page, errors);
    await page.locator('.homepage-nav-btn.is-rebirth').click();
    const panel = page.locator('.shop-panel');
    await expect(panel).toBeVisible();
    await expect(page.locator('.shop-title')).toHaveText('REBIRTH');
    await page.waitForTimeout(150);
    expect(errors, `console/page errors: ${errors.join(' | ')}`).toHaveLength(0);
  });
});
