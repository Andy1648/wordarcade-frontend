// e2e/rank-ladder.spec.js — ALL RANKS (Andy oct11): the menu's RANK plate opens a popup of all 16 v3 ranks, yours
// marked YOU; nothing sticks out at 1280 or 360; Esc / ✕ close it.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

for (const [w, h] of [[1280, 720], [360, 740]]) {
  test(`ALL RANKS @${w}x${h}: opens from the RANK plate, 16 plates, YOU marked, fits, closes`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('rl.seeded')) return;
      sessionStorage.setItem('rl.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
    });
    await page.goto('/?portal=1&season2=1');
    await page.getByTestId('rank-plate').click();
    const rl = page.getByTestId('rank-ladder');
    await expect(rl).toBeVisible();
    await expect(rl.locator('.rl-item')).toHaveCount(16);
    await expect(rl.locator('.rl-item.is-you')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(rl).toHaveCount(0);
    await page.getByTestId('rank-plate').click();
    await rl.getByRole('button', { name: 'Close' }).click();
    await expect(rl).toHaveCount(0);
  });
}
