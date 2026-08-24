// e2e/shop.spec.js — the shop overlay + rebirth flow in a real browser: locked items are
// visible-but-dimmed, buying deducts wins (not winsLifetime) and enables equip, and rebirth
// (gated on level) zeroes xp while preserving wins + purchases and fires the celebration.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function openShop(page, seed) {
  await installBackendMock(page);
  await page.addInitScript((s) => {
    try {
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  }, seed);
  await page.goto('/?portal=1');
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
  await page.locator('.homepage-footer-links button', { hasText: 'SHOP' }).click();
  await page.locator('.shop-panel').waitFor({ state: 'visible' });
}

test.describe('shop', () => {
  test('locked items are visible+dimmed; buying deducts wins only and enables equip', async ({ page }) => {
    await openShop(page, { 'taw.wins': '500', 'taw.winsLifetime': '900', 'taw.xp': '0' });

    // All catalog cards render; unaffordable ones are visible-but-dimmed (not hidden).
    await expect(page.locator('.shop-card')).toHaveCount(11);
    expect(await page.locator('.shop-card.is-locked').count()).toBeGreaterThan(0);
    await expect(page.locator('.shop-rebirth')).toHaveCount(0); // level 1 → no rebirth

    const chrome = page.locator('.shop-card', { hasText: 'CHROME' });
    await chrome.locator('.shop-card-btn').click(); // BUY (150)
    await expect(page.evaluate(() => Number(localStorage.getItem('taw.wins')))).resolves.toBe(350);
    expect(await page.evaluate(() => Number(localStorage.getItem('taw.winsLifetime')))).toBe(900); // untouched
    await chrome.locator('.shop-card-btn').click(); // now EQUIP
    await expect(chrome.locator('.shop-card-tag')).toHaveText('EQUIPPED');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('taw.equipped')).popStyle)).toBe('chrome');
  });

  test('rebirth is gated by level, confirms what changes, zeroes xp and keeps everything else', async ({ page }) => {
    // Seed a high XP (well past level 15) + a purchase; rebirth must appear.
    await openShop(page, { 'taw.xp': '60000', 'taw.wins': '400', 'taw.owned': JSON.stringify(['classic', 'thock', 'clack', 'cream', 'inferno']) });
    await expect(page.locator('.shop-rebirth')).toBeVisible();

    await page.locator('.shop-rebirth').click();
    const confirm = page.locator('.shop-confirm');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('LOSE'); // states exactly what is lost/gained
    await expect(confirm).toContainText('KEEP');
    await expect(confirm).toContainText('GAIN');

    await confirm.locator('.shop-card-btn.danger').click(); // CONFIRM
    await page.locator('.menu-xp-bar').waitFor({ state: 'visible' }); // returned to menu

    const after = await page.evaluate(() => ({
      xp: Number(localStorage.getItem('taw.xp')),
      rebirths: Number(localStorage.getItem('taw.rebirths')),
      wins: Number(localStorage.getItem('taw.wins')),
      keepsInferno: JSON.parse(localStorage.getItem('taw.owned') || '[]').includes('inferno'),
      celeb: document.querySelector('.menu-xp-levelup-title')?.textContent,
    }));
    expect(after.xp).toBe(0); // XP zeroed
    expect(after.rebirths).toBe(1);
    expect(after.wins).toBe(400); // wins preserved
    expect(after.keepsInferno).toBe(true); // purchases survive rebirth
    expect(after.celeb).toBe('REBIRTH 1'); // celebration fired on the menu
  });
});
