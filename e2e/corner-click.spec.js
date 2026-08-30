// e2e/corner-click.spec.js — fix/shop-click GATE. A real POINTER click (by coordinate, not
// element.click() or a ref) on each corner-nav control must open its overlay. The production bug:
// the menu was scaled by a `zoom` that hit-testing ignored, so a click aimed at a corner button's
// on-screen position landed on the visual gap — it credited XP and never reached the button, while
// element.click() (which bypasses hit-testing) still worked. Clicking by coordinate is the only way
// to catch that class of bug; it also guards against any handler that swallows the pointer event.
//
// (Headless Chromium hit-tests and renders zoom consistently, so it can't reproduce the real-Chrome
// zoom split directly — but the fix removes the menu zoom entirely, and the sibling gates
// menu-fill / overlay-fill assert no ancestor zoom, so the class is guarded end to end.)
import { test, expect } from '@playwright/test';
import { gotoMenu } from './support/backendMock.js';

// name -> { button selector, overlay that must open }
const CONTROLS = [
  { name: 'SHOP', btn: '.homepage-nav-btn.is-shop', opens: '.shop-overlay' },
  { name: 'STATS', btn: '.homepage-nav-btn.is-stats', opens: '.stats-overlay' },
  { name: 'REBIRTH', btn: '.homepage-nav-btn.is-rebirth', opens: '.shop-overlay' },
  { name: 'audio', btn: '.homepage-corner-nav .audio-btn', opens: '.audio-panel' },
];

const VIEWPORTS = [
  { w: 1280, h: 640 },
  { w: 1568, h: 675 },
  { w: 1920, h: 827 },
];

for (const { w, h } of VIEWPORTS) {
  for (const c of CONTROLS) {
    test(`${c.name} opens on a coordinate click @ ${w}x${h}`, async ({ page }) => {
      // Seed enough that REBIRTH shows in the corner (winsLifetime>0), so all four controls exist.
      await page.addInitScript(() => {
        try {
          localStorage.setItem('taw.winsLifetime', '4000');
          localStorage.setItem('taw.wins', '1500');
        } catch (e) { /* ignore */ }
      });
      await page.setViewportSize({ width: w, height: h });
      await gotoMenu(page);
      const btn = page.locator(c.btn);
      await btn.waitFor({ state: 'visible' });
      const box = await btn.boundingBox();
      const cx = Math.round(box.x + box.width / 2);
      const cy = Math.round(box.y + box.height / 2);
      // Sanity: the button must be the top hit-test element at its own centre (what a real click hits).
      const hitOk = await page.evaluate(([x, y, sel]) => {
        const el = document.elementFromPoint(x, y);
        return !!(el && (el.matches(sel) || el.closest(sel)));
      }, [cx, cy, c.btn]);
      expect(hitOk, `${c.name} must be the hit-test element at its own centre @ ${w}x${h}`).toBe(true);
      // The actual test: a REAL pointer click at those coordinates (not btn.click()).
      await page.mouse.click(cx, cy);
      await expect(page.locator(c.opens), `${c.name} coordinate click must open ${c.opens} @ ${w}x${h}`).toBeVisible({ timeout: 5000 });
    });
  }
}
