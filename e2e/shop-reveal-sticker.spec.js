// e2e/shop-reveal-sticker.spec.js — feat/shop-reveal-sticker: the shop's purchase reveal is the
// shared reveal STICKER, not the old black box with a star and a one-line banner.
//
// Buying the INFERNO theme (2,500 wins — the moment that prompted this) must show a sticker that
// says what happened: the UNLOCKED ribbon, the item's name, the price as a debit, and its own art
// (the theme's swatch strip). Clicking it dismisses it and leaves the SHOP open — the sticker is a
// modal whose backdrop swallows the click, so it can never fall through to the shop behind it.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function openShop(page, { wins = 999999 } = {}) {
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  await page.addInitScript((w) => {
    try {
      localStorage.setItem('taw.wins', String(w));
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
    } catch { /* */ }
  }, wins);
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  await page.locator('.homepage-nav-btn.is-shop').click();
  await page.locator('.shop-panel').waitFor({ state: 'visible' });
}

// Buying is a plain click (fix/shop-click-buy removed the unlabelled 400ms hold gate).

test('buying INFERNO reveals a sticker naming the theme and its price', async ({ page }) => {
  await openShop(page);
  const inferno = page.locator('.shop-card', { hasText: 'INFERNO' }).first();
  await expect(inferno).toBeVisible();
  await inferno.locator('.shop-buy').click();

  const sticker = page.locator('.sticker');
  await expect(sticker).toBeVisible();
  await expect(sticker).toContainText('UNLOCKED');
  await expect(sticker).toContainText('INFERNO');
  await expect(sticker).toContainText('2,500');
  // It is the SHOP skin of the shared shell, and the price reads as a debit (spent, not earned).
  await expect(page.locator('.shop-sticker')).toHaveCount(1);
  await expect(sticker.locator('.sticker-coin.is-debit')).toContainText('2,500');
  // The item's OWN art, not a generic star: the theme's swatch strip is an inline SVG.
  await expect(sticker.locator('svg.sticker-glyph')).toHaveCount(1);
  await expect(page.locator('.shop-reveal')).toHaveCount(0); // the old black box is gone
});

test('clicking the sticker dismisses it and the shop stays open', async ({ page }) => {
  await openShop(page);
  const inferno = page.locator('.shop-card', { hasText: 'INFERNO' }).first();
  await inferno.locator('.shop-buy').click();
  await expect(page.locator('.sticker')).toBeVisible();

  // Click the viewport centre — the sticker itself. The click must be swallowed: it dismisses the
  // sticker and must NOT reach the shop card underneath (which would re-trigger a buy/equip).
  const size = page.viewportSize();
  await page.mouse.click(Math.round(size.width / 2), Math.round(size.height / 2));
  await expect(page.locator('.sticker')).toHaveCount(0);
  await expect(page.locator('.sticker-backdrop')).toHaveCount(0);
  await expect(page.locator('.shop-panel')).toBeVisible();
  await expect(page.locator('.shop-title')).toHaveText('SHOP');
});

test('the backdrop also dismisses, and the sticker auto-dismisses on its own', async ({ page }) => {
  await openShop(page);
  const inferno = page.locator('.shop-card', { hasText: 'INFERNO' }).first();
  await inferno.locator('.shop-buy').click();
  await expect(page.locator('.sticker')).toBeVisible();
  // A click on the scrim (top-left corner, clear of the card) dismisses too.
  await page.mouse.click(8, 8);
  await expect(page.locator('.sticker')).toHaveCount(0);
  await expect(page.locator('.shop-panel')).toBeVisible();

  // Auto-dismiss: buy another item and wait out the 4.2s lifetime without touching anything.
  const chrome = page.locator('.shop-card', { hasText: 'CHROME' }).first();
  await chrome.locator('.shop-buy').click();
  await expect(page.locator('.sticker')).toBeVisible();
  await expect(page.locator('.sticker')).toHaveCount(0, { timeout: 7000 });
  await expect(page.locator('.shop-panel')).toBeVisible();
});

test('a key power buy shows the tier and what it pays, and adds no infinite animation', async ({ page }) => {
  await openShop(page);
  await page.locator('.shop-keypower').first().locator('.shop-buy').click();
  const sticker = page.locator('.sticker');
  await expect(sticker).toContainText('KEY POWER I');
  await expect(sticker).toContainText('XP');
  await expect(sticker.locator('.sticker-coin.is-debit')).toBeVisible();
  // The shell's punch-in is a single finite animation; nothing here may loop.
  const infinite = await page.evaluate(() =>
    document.getAnimations().filter((a) => {
      const it = a.effect && a.effect.getTiming && a.effect.getTiming().iterations;
      return it === Infinity;
    }).length
  );
  expect(infinite, 'infinite animations while the sticker is up').toBe(0);
});
