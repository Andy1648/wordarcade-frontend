// e2e/shop-keyboard.spec.js — the shop's buy button must be usable with the keyboard ONLY (it once
// had pointer handlers only, so nothing could be bought without a mouse). Buying is a plain
// activation: a single Enter or Space press commits (fix/shop-click-buy removed the hold gate),
// and the purchase reveals the shared sticker (feat/shop-reveal-sticker).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function openShop(page, { wins = 999999, keytier = 0 } = {}) {
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  await page.addInitScript((s) => {
    try {
      localStorage.setItem('taw.wins', String(s.wins));
      localStorage.setItem('taw.keytier', String(s.keytier));
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
    } catch { /* */ }
  }, { wins, keytier });
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  await page.locator('.homepage-nav-btn.is-shop').click();
  await page.locator('.shop-panel').waitFor({ state: 'visible' });
}

// The KEY POWER buy button (first .shop-keypower — it renders above WORD SENSE / MOMENTUM).
const keyPowerBuy = (page) => page.locator('.shop-keypower').first().locator('.shop-buy');
const keyPowerHeading = (page) => page.locator('.shop-subtitle', { hasText: 'KEY POWER' });

test('an Enter tap buys KEY POWER once — keyboard only, no mouse', async ({ page }) => {
  await openShop(page, { wins: 999999, keytier: 0 });
  const btn = keyPowerBuy(page);
  await expect(btn).toBeVisible();
  await btn.focus();
  await page.keyboard.press('Enter');
  // The purchase landed exactly once: KEY POWER advanced to TIER 1 (not 2).
  await expect(keyPowerHeading(page)).toContainText('TIER 1');
});

test('Enter buys KEY POWER and reveals the unlock sticker', async ({ page }) => {
  await openShop(page, { wins: 999999, keytier: 0 });
  const btn = keyPowerBuy(page);
  await expect(btn).toBeVisible();
  await btn.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.sticker')).toBeVisible();
  await expect(page.locator('.sticker-name')).toContainText('KEY POWER I');
  await expect(page.locator('.sticker-ribbon')).toContainText('UNLOCKED');
  await expect(keyPowerHeading(page)).toContainText('TIER 1');
});

test('Space also buys via the keyboard', async ({ page }) => {
  await openShop(page, { wins: 999999, keytier: 1 }); // already T1 → this buy reaches T2
  const btn = keyPowerBuy(page);
  await expect(btn).toBeVisible();
  await btn.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.sticker')).toBeVisible();
  await expect(page.locator('.sticker-name')).toContainText('KEY POWER II');
  await expect(keyPowerHeading(page)).toContainText('TIER 2');
});
