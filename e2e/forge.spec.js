// e2e/forge.spec.js — the LETTER FORGE (Andy oct2: MOMENTUM capped at 200 and did nothing you could
// see; its replacement is uncapped and visible). The shop track draws the 26 letters at their
// levels, a buy forges the next letter and charges the price, and an old MOMENTUM save carries over.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

async function openShop(page, kv) {
  await page.addInitScript(() => {
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  });
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('fg.seeded')) return;
    sessionStorage.setItem('fg.seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, kv);
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  await navControl(page, 'shop').click();
  await page.locator('.shop-panel').waitFor({ state: 'visible' });
}

test('the shop draws the forge; a buy forges E and charges the quoted price', async ({ page }) => {
  await openShop(page, { 'taw.wins': '100000', 'taw.xp': JSON.stringify({ lv: 40, into: 0 }) });
  await expect(page.locator('.shop-subtitle', { hasText: 'LETTER FORGE' })).toBeVisible();
  await expect(page.locator('.forge-tile')).toHaveCount(26);
  await expect(page.locator('.forge-tile.is-forged')).toHaveCount(0);
  await expect(page.locator('.forge-tile.is-next')).toHaveText('E');
  const before = await page.evaluate(() => Number(localStorage.getItem('taw.wins')));
  await page.locator('.shop-forge .shop-buy').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('taw.forge') || '{}').e)).toBe(1);
  const after = await page.evaluate(() => Number(localStorage.getItem('taw.wins')));
  expect(before - after).toBeGreaterThan(0);
  await expect(page.locator('.sticker')).toContainText('FORGED');
});

test('an old MOMENTUM save carries over buy-for-buy (nothing lost, nothing capped)', async ({ page }) => {
  await openShop(page, { 'taw.momentum': '30', 'taw.wins': '0' });
  await expect(page.locator('.shop-subtitle', { hasText: 'LETTER FORGE — 30 FORGED' })).toBeVisible();
  await expect(page.locator('.forge-tile.is-forged')).toHaveCount(26);
  expect(await page.evaluate(() => localStorage.getItem('taw.momentum'))).toBeNull();
});
