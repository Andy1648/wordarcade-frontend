// e2e/shop-fit.spec.js — item 2 acceptance: the shop panel stays fully on-screen (all four
// edges) at every viewport, and nothing forces a horizontal scrollbar on the document.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const VIEWPORTS = [
  { w: 1920, h: 1080 },
  { w: 1600, h: 900 },
  { w: 1440, h: 900 },
  { w: 1366, h: 768 },
  { w: 1280, h: 720 },
  { w: 1163, h: 501 },
  { w: 1024, h: 600 },
  { w: 390, h: 844 },
  { w: 360, h: 640 },
];

async function openShop(page) {
  await installBackendMock(page);
  // Seed enough wins + high level so every shop row (incl. rebirth) renders its fullest.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.wins', '999999');
      localStorage.setItem('taw.winsLifetime', '999999');
      localStorage.setItem('taw.xp', '400000');
    } catch { /* ignore */ }
  });
  await page.goto('/?portal=1');
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
  await page.locator('.homepage-shop-btn').click();
  await page.locator('.shop-panel').waitFor({ state: 'visible' });
}

async function measure(page) {
  return page.evaluate(() => {
    const p = document.querySelector('.shop-panel').getBoundingClientRect();
    return {
      left: Math.round(p.left),
      top: Math.round(p.top),
      right: Math.round(p.right),
      bottom: Math.round(p.bottom),
      vw: window.innerWidth,
      vh: window.innerHeight,
      bodyScrollW: document.body.scrollWidth,
      bodyClientW: document.body.clientWidth,
    };
  });
}

test.describe('shop fit (item 2)', () => {
  for (const { w, h } of VIEWPORTS) {
    test(`${w}x${h}: shop panel is fully inside the viewport, no h-scroll`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await openShop(page);
      const m = await measure(page);
      // eslint-disable-next-line no-console
      console.log(`[shop-fit] ${w}x${h}  L=${m.left} T=${m.top} R=${m.right} B=${m.bottom}  vw=${m.vw} vh=${m.vh}  hscroll=${m.bodyScrollW - m.bodyClientW}`);
      expect(m.left, `left edge @ ${w}x${h}`).toBeGreaterThanOrEqual(0);
      expect(m.top, `top edge @ ${w}x${h}`).toBeGreaterThanOrEqual(0);
      expect(m.right, `right edge @ ${w}x${h}`).toBeLessThanOrEqual(m.vw + 1);
      expect(m.bottom, `bottom edge @ ${w}x${h}`).toBeLessThanOrEqual(m.vh + 1);
      expect(m.bodyScrollW, `document h-scroll @ ${w}x${h}`).toBeLessThanOrEqual(m.bodyClientW + 1);
    });
  }
});
