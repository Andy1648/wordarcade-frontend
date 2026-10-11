// e2e/wb-solo.spec.js — Andy oct10: "for all game modes besides sat rush, just 2 buttons - create room and join".
// The mode dialog's PLAY SOLO (Word Bomb) and QUICK MATCH (Word Race) leads are gone: Word Bomb, Category Blitz and
// Word Race each show exactly CREATE ROOM + JOIN (a solo player adds a bot in the room, where every bot names its gem
// reward). Both buttons are on screen without scrolling, >= 44px tall, no text under 13px, at 1280x551, 1366x625 and
// 390x844. (The phone first-timer hook's one-tap PLAY SOLO is menu-hook.spec's.)
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, revealMode } from './support/menu.js';

const VIEWPORTS = [
  { width: 1280, height: 551 },
  { width: 1366, height: 625 },
  { width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  test(`room modes show CREATE ROOM + JOIN only @ ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await installBackendMock(page);
    await page.addInitScript(() => {
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      localStorage.setItem('wa_has_played', '1');
    });
    await page.goto('/?portal=1');
    await menuReady(page);
    for (const id of ['word-bomb', 'category-blitz', 'word-race']) {
      let entry;
      try { entry = await revealMode(page, id); } catch { continue; } // the phone list has no WORD RACE row at every size
      if (!(await entry.isVisible())) continue;
      await entry.click();
      const actions = page.locator('.mode-dialog-actions .mode-dialog-btn');
      await expect(actions).toHaveText(['CREATE ROOM', 'JOIN']);
      await expect(page.getByRole('button', { name: 'SOLO', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'QUICK MATCH', exact: true })).toHaveCount(0);
      const m = await actions.evaluateAll((btns) => btns.map((btn) => {
        const r = btn.getBoundingClientRect();
        const small = [btn, ...btn.querySelectorAll('*')]
          .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
          .map((el) => parseFloat(getComputedStyle(el).fontSize))
          .filter((px) => px < 13);
        return { h: r.height, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth, small };
      }));
      for (const b of m) {
        expect(b.h, `${id}: button height`).toBeGreaterThanOrEqual(44);
        expect(b.inView, `${id}: button on screen without scrolling`).toBe(true);
        expect(b.small, `${id}: text under 13px`).toEqual([]);
      }
      await page.keyboard.press('Escape');
      await expect(page.locator('.mode-dialog-shell')).toHaveCount(0);
    }
  });
}
