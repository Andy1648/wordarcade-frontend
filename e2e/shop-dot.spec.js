// e2e/shop-dot.spec.js — Andy oct2 A5: "SHOP shows a notification with nothing affordable."
// The dot means something can ACTUALLY be bought. The bug: retired menu themes (gone from the shop
// since STEP 50) still counted, so 60+ wins lit the dot with nothing on the shelf.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

async function menuWith(page, seed) {
  await installBackendMock(page);
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('shopdot.seeded')) return;
    sessionStorage.setItem('shopdot.seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, seed);
  await page.goto('/?portal=1');
  await menuReady(page);
}

const shopDot = (page) => navControl(page, 'shop').locator('.homepage-shop-dot, .hp-m-dot');

test('a fresh LV1 profile with 0 wins shows no shop dot', async ({ page }) => {
  await menuWith(page, { 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1' });
  await expect(navControl(page, 'shop')).toBeVisible();
  await expect(navControl(page, 'shop')).toHaveAttribute('aria-label', 'Open shop');
  await expect(shopDot(page)).toHaveCount(0);
});

test('150 wins (a retired theme price, below KEY POWER I) shows no shop dot', async ({ page }) => {
  await menuWith(page, { 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.wins': '150' });
  await expect(navControl(page, 'shop')).toBeVisible();
  await expect(shopDot(page)).toHaveCount(0);
});

test('enough for KEY POWER I lights the shop dot', async ({ page }) => {
  await menuWith(page, { 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.wins': '5000' });
  await expect(shopDot(page)).toHaveCount(1);
});
