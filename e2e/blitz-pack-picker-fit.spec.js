// e2e/blitz-pack-picker-fit.spec.js — PICK YOUR PACKS fills a laptop screen (Andy oct19: on a Chromebook the dialog was
// "ass proportion (so tiny)": 660px wide, 6 of 11 packs in a scrolling window). At the laptop sizes every pack tile is
// visible with NO scroll, and the dialog uses most of the width.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

for (const [w, h] of [[1366, 768], [1280, 800], [1280, 720], [1024, 768], [1536, 864]]) {
  test(`pack picker shows every pack without scrolling at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await gotoMenu(page);
    await page.getByRole('button', { name: /CATEGORY BLITZ/i }).first().click();
    await expect(page.locator('.ppp-picker')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => {
      const win = document.querySelector('.ppp-window-scroll');
      const box = win.getBoundingClientRect();
      const tiles = [...document.querySelectorAll('.ppp-pill')];
      const cut = tiles.filter((t) => { const r = t.getBoundingClientRect(); return r.bottom > box.bottom + 1 || r.top < box.top - 1; }).length;
      const dialog = document.querySelector('[role=dialog]').getBoundingClientRect();
      return { scrolls: win.scrollHeight - win.clientHeight > 1, cut, wide: dialog.width >= Math.min(innerWidth * 0.75, 1000), onScreen: dialog.bottom <= innerHeight };
    }), { timeout: 5000 }).toEqual({ scrolls: false, cut: 0, wide: true, onScreen: true });
  });
}
