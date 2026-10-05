// e2e/forge.spec.js — the LETTER FORGE is NO LONGER SOLD (Rebirth Rush, PROGRESSION FINAL: the forge is
// out of the wins formula, so the shop must not sell it). Its storage is untouched — nobody's data is
// lost: a forged save keeps taw.forge, and an old MOMENTUM save still migrates into it.
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

test('the shop does not sell the LETTER FORGE, and a forged save keeps its data', async ({ page }) => {
  const forged = JSON.stringify({ e: 3, t: 2 });
  await openShop(page, { 'taw.wins': '100000', 'taw.xp': JSON.stringify({ lv: 40, into: 0 }), 'taw.layer.forge': '1', 'taw.forge': forged });
  await expect(page.locator('.shop-subtitle', { hasText: 'KEY POWER' })).toBeVisible();
  await expect(page.locator('.shop-subtitle', { hasText: 'LETTER FORGE' })).toHaveCount(0);
  await expect(page.locator('.shop-forge')).toHaveCount(0);
  await expect(page.locator('.forge-tile')).toHaveCount(0);
  await expect(page.locator('.shop-panel')).not.toContainText('FORGE');
  expect(await page.evaluate(() => localStorage.getItem('taw.forge'))).toBe(forged);
});

test('an old MOMENTUM save still migrates into the forge store (nothing lost), with no shelf for it', async ({ page }) => {
  await openShop(page, { 'taw.momentum': '30', 'taw.wins': '0' });
  await expect(page.locator('.shop-subtitle', { hasText: 'LETTER FORGE' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('taw.momentum'))).toBeNull();
  const forge = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.forge') || '{}'));
  expect(Object.values(forge).reduce((a, n) => a + n, 0)).toBe(30);
});
