// e2e/blitz-pack-picker-fit.spec.js — PICK YOUR PACKS shows every pack with NO scroll, inside the SAME 660px card every
// other mode uses. Andy oct19: the 2-wide pill list showed 6 of 11 packs in a scroll window ("so tiny"); a two-panel
// 1100px dialog fixed that but oct21 he rejected it ("SO HUGE that it fits entire screen ... keep it like before").
// So the card is back to its old size and the packs are small painted stickers, six across, two rows. Includes real
// Chromebook BROWSER viewports (screen minus ~110px of tabs/omnibox, at 100/110/125% scaling). Every tile must sit
// inside the pack window AND the dialog, and the dialog must be the ordinary card, not a full-screen panel.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

for (const [w, h] of [[1366, 768], [1280, 800], [1280, 720], [1024, 768], [1536, 864], [1366, 657], [1280, 610], [1242, 597], [1093, 526]]) {
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
      const outside = tiles.filter((t) => { const r = t.getBoundingClientRect(); return r.bottom > dialog.bottom + 1 || r.top < dialog.top - 1; }).length;
      return { scrolls: win.scrollHeight - win.clientHeight > 1, cut, outside, card: dialog.width <= 700, onScreen: dialog.bottom <= innerHeight };
    }), { timeout: 5000 }).toEqual({ scrolls: false, cut: 0, outside: 0, card: true, onScreen: true });
  });
}
