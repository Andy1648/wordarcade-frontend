// e2e/purchase-feel-shop.spec.js — feat/purchase-feel §3 (next-goal) + §2 (buy ritual).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function openShop(page, { wins = 999999, keytier = 0 } = {}) {
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
  await openShop(page, { wins: 300, keytier: 0 }); // < 500 (T1 cost) → shows the gap
  // KEY POWER goal + bar always present.
  await expect(page.locator('.shop-goal').first()).toBeVisible();
  await expect(page.locator('.shop-progress').first()).toBeVisible();
  await expect(page.locator('.shop-goal').first()).toContainText('UNLOCKS AT');
  await expect(page.locator('.shop-goal').first()).toContainText('YOU HAVE 300');
  // The cheapest unowned cosmetic is flagged NEXT with its gap.
  await expect(page.locator('.shop-card-next').first()).toBeVisible();
  await expect(page.locator('.shop-card-gap').first()).toBeVisible();
});

test('§2 hold-to-buy commits after the hold and reveals; releasing early cancels', async ({ page }) => {
  await openShop(page, { wins: 999999, keytier: 0 }); // can afford T1 (500)
  const holdBtn = page.locator('.shop-kp-actions .shop-hold');
  await expect(holdBtn).toBeVisible();

  // Release early (well under the 400ms fill, deterministic even under load) → NO
  // commit, NO reveal.
  await holdBtn.hover();
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
  await page.waitForTimeout(250);
  await expect(page.locator('.shop-reveal')).toHaveCount(0);
  await expect(page.locator('.shop-subtitle').first()).toContainText('TIER 0'); // unchanged
  // Settle the pointer well clear of the button before the next sequence.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(100);

  // Full hold (> 400ms) → commit fires on the fill's finish → reveal appears.
  await holdBtn.hover();
  await page.mouse.down();
  await page.waitForTimeout(520);
  await expect(page.locator('.shop-reveal')).toBeVisible();
  await expect(page.locator('.shop-reveal-banner')).toContainText('KEY POWER I UNLOCKED');
  await page.mouse.up();
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
