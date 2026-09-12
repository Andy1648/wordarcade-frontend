// e2e/purchase-feel-shop.spec.js — feat/purchase-feel §3 (next-goal) + §2 (buy ritual).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function openShop(page, { wins = 999999, keytier = 0 } = {}) {
  // Opt out of the on-load achievement grant: this seeds lv40 + a wins balance, and checkAchievements
  // would otherwise credit level/progression achievement wins on mount, inflating the seeded balance.
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

test('§3 the shop always shows a next goal + progress bar', async ({ page }) => {
  await openShop(page, { wins: 50, keytier: 0 }); // < 90 (T1 cost, post-rebalance) → shows the gap
  // KEY POWER goal + bar always present. MOMENTUM reuses .shop-keypower/.shop-goal, so scope to
  // the FIRST .shop-keypower (KEY POWER, which renders above it). At 50 wins vs the T1 cost 90 →
  // "UNLOCKS AT".
  const kp = page.locator('.shop-keypower').first();
  await expect(kp.locator('.shop-goal')).toBeVisible();
  await expect(kp.locator('.shop-progress')).toBeVisible();
  await expect(kp.locator('.shop-goal')).toContainText('UNLOCKS AT');
  await expect(kp.locator('.shop-goal')).toContainText('YOU HAVE 50');
  // The cheapest unowned cosmetic is flagged NEXT with its gap.
  await expect(page.locator('.shop-card-next').first()).toBeVisible();
  await expect(page.locator('.shop-card-gap').first()).toBeVisible();
});

test('§2 buy is a plain click that commits and reveals the sticker', async ({ page }) => {
  await openShop(page, { wins: 999999, keytier: 0 }); // can afford T1 (90)
  // MOMENTUM is a second upgrade track that reuses .shop-keypower / .shop-kp-actions, so scope to
  // the FIRST .shop-keypower — KEY POWER, which renders above it. (The reveal banner assertion
  // below double-checks which one was bought.)
  // fix/shop-click-buy: buying is a plain CLICK (the unlabelled 400ms hold gate is gone), and
  // feat/shop-reveal-sticker: the reveal is the shared sticker — ribbon "★ UNLOCKED ★" plus the
  // item's own name, in place of the old one-line banner.
  const buyBtn = page.locator('.shop-keypower').first().locator('.shop-buy');
  await expect(buyBtn).toBeVisible();
  // The THEMES section renders above KEY POWER, so scope to the KEY POWER heading specifically.
  await expect(page.locator('.shop-subtitle', { hasText: 'KEY POWER' })).toContainText('TIER 0');
  await expect(page.locator('.sticker')).toHaveCount(0);

  // One click → commit → the sticker appears and the tier advances.
  await buyBtn.click();
  await expect(page.locator('.sticker')).toBeVisible();
  await expect(page.locator('.sticker-name')).toContainText('KEY POWER I');
  await expect(page.locator('.sticker-ribbon')).toContainText('UNLOCKED');
  await expect(page.locator('.shop-subtitle', { hasText: 'KEY POWER' })).toContainText('TIER 1');
});

test('§2/§3 add zero new infinite animations in the shop', async ({ page }) => {
  await openShop(page, { wins: 999999, keytier: 2 });
  const infinite = await page.evaluate(() =>
    document.getAnimations().filter((a) => {
      const it = a.effect && a.effect.getTiming && a.effect.getTiming().iterations;
      return it === Infinity;
    }).length
  );
  // The shop overlay itself runs no infinite loops.
  expect(infinite, 'infinite animations while the shop is open').toBe(0);
});
