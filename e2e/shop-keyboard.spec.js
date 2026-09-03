// e2e/shop-keyboard.spec.js (fix/shop-keyboard) — the shop's HoldBuy had pointer handlers ONLY, so
// no upgrade/cosmetic/theme could be bought without a mouse. These tests buy an item using ONLY the
// keyboard: Enter (and Space) HELD for the hold duration commits; a short tap does NOT (parity with
// the mouse hold — keyboard is not an instant-buy shortcut mouse users don't get).
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

// The KEY POWER hold-to-buy button (first .shop-keypower — it renders above WORD SENSE / MOMENTUM).
const keyPowerHold = (page) => page.locator('.shop-keypower').first().locator('.shop-hold');
const keyPowerHeading = (page) => page.locator('.shop-subtitle', { hasText: 'KEY POWER' });

test('a short Enter tap does NOT buy (respects the hold)', async ({ page }) => {
  await openShop(page, { wins: 999999, keytier: 0 });
  const btn = keyPowerHold(page);
  await expect(btn).toBeVisible();
  await btn.focus();
  // Tap: keydown then keyup well under the 400ms hold → no commit, no reveal, tier unchanged.
  await page.keyboard.down('Enter');
  await page.waitForTimeout(60);
  await page.keyboard.up('Enter');
  await page.waitForTimeout(300);
  await expect(page.locator('.shop-reveal')).toHaveCount(0);
  await expect(keyPowerHeading(page)).toContainText('TIER 0');
});

test('Enter HELD for the hold duration buys KEY POWER — keyboard only, no mouse', async ({ page }) => {
  await openShop(page, { wins: 999999, keytier: 0 });
  const btn = keyPowerHold(page);
  await expect(btn).toBeVisible();
  await btn.focus();
  // Hold Enter past the 400ms hold → commit → reveal banner names the KEY POWER unlock.
  await page.keyboard.down('Enter');
  await page.waitForTimeout(560);
  await expect(page.locator('.shop-reveal')).toBeVisible();
  await expect(page.locator('.shop-reveal-banner')).toContainText('KEY POWER I UNLOCKED');
  await page.keyboard.up('Enter');
  // The purchase actually landed: KEY POWER advanced to TIER 1.
  await expect(keyPowerHeading(page)).toContainText('TIER 1');
});

test('Space HELD also buys via the keyboard', async ({ page }) => {
  await openShop(page, { wins: 999999, keytier: 1 }); // already T1 → this buy reaches T2
  const btn = keyPowerHold(page);
  await expect(btn).toBeVisible();
  await btn.focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(560);
  await expect(page.locator('.shop-reveal')).toBeVisible();
  await expect(page.locator('.shop-reveal-banner')).toContainText('KEY POWER II UNLOCKED');
  await page.keyboard.up('Space');
  await expect(keyPowerHeading(page)).toContainText('TIER 2');
});
