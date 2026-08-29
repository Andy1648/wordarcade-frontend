// e2e/momentum.spec.js — the MOMENTUM repeatable sink: the menu trophy RAIL (one mark per buy,
// absent at 0) and the SHOP track (hold-to-buy increments the count + the wins multiplier).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function seed(page, kv) {
  await page.addInitScript(() => {
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  });
  await page.addInitScript((s) => {
    try {
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  }, kv);
  await installBackendMock(page);
}

test.describe('momentum repeatable sink', () => {
  test('menu rail shows a board of marks for a player who has bought in', async ({ page }) => {
    await seed(page, { 'taw.momentum': '20' });
    await page.goto('/?portal=1');
    await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
    const rail = page.locator('.momentum-rail');
    await expect(rail).toBeVisible();
    await expect(rail).toHaveAttribute('aria-label', /20 of 200/);
    // The studs are real SVG art (a merged diamond path), not text.
    await expect(rail.locator('svg path.mr-stud')).toHaveCount(1);
  });

  test('menu rail is absent for a fresh account (0 buys — no clutter)', async ({ page }) => {
    await seed(page, {});
    await page.goto('/?portal=1');
    await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
    await expect(page.locator('.momentum-rail')).toHaveCount(0);
  });

  test('shop MOMENTUM track hold-to-buy adds a mark and deducts the rising cost', async ({ page }) => {
    await seed(page, { 'taw.wins': '6000', 'taw.momentum': '0', 'taw.xp': JSON.stringify({ lv: 40, into: 0 }) });
    await page.goto('/?portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    await page.locator('.homepage-nav-btn.is-shop').click();
    await page.locator('.shop-panel').waitFor({ state: 'visible' });
    // The MOMENTUM track renders (subtitle + its own hold-to-buy).
    await expect(page.locator('.shop-subtitle', { hasText: 'MOMENTUM' })).toBeVisible();
    // KEY POWER, WORD SENSE, MOMENTUM are the three .shop-keypower blocks — MOMENTUM is the third.
    const hold = page.locator('.shop-keypower').nth(2).locator('.shop-hold');
    await expect(hold).toBeVisible();
    await hold.hover();
    await page.mouse.down();
    await page.waitForTimeout(520); // past the ~400ms fill → commit
    await page.mouse.up();
    // One mark bought: count 0→1, wins 6000 − 5000 = 1000.
    await expect
      .poll(() => page.evaluate(() => Number(localStorage.getItem('taw.momentum'))), { timeout: 4000 })
      .toBe(1);
    expect(await page.evaluate(() => Number(localStorage.getItem('taw.wins')))).toBe(1000);
  });
});
