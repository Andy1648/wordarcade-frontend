// e2e/rank-ladder.spec.js — ALL TITLES (Andy oct11): a popup of all 16 v3 ranks, yours marked YOU; nothing sticks out at
// 1280 or 360; Esc / ✕ close it. Since oct21 the menu's plate is the PROFILE plate: the ladder opens from the profile's
// TITLE row, and closing it lands back on the profile.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

for (const [w, h] of [[1280, 720], [360, 740]]) {
  test(`ALL RANKS @${w}x${h}: opens from the profile's TITLE row, 16 plates, YOU marked, fits, closes`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('rl.seeded')) return;
      sessionStorage.setItem('rl.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
    });
    await page.goto('/?portal=1&season2=1');
    await page.getByTestId('profile-plate').click();
    const pf = page.getByTestId('profile-popup');
    await expect(pf).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/contracts/profile-${w}.png` });
    await pf.getByTestId('profile-title').click();
    const rl = page.getByTestId('rank-ladder');
    await expect(rl).toBeVisible();
    await expect(rl.locator('.rl-item')).toHaveCount(16);
    await expect(rl.locator('.rl-item.is-you')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(rl).toHaveCount(0);
    await expect(pf).toBeVisible(); // Esc closes the ladder only — back on the profile
    await pf.getByTestId('profile-title').click();
    await rl.getByRole('button', { name: 'Close' }).click();
    await expect(rl).toHaveCount(0);
  });
}
