// e2e/shop-fit.spec.js — item 4: the SHOP / REBIRTH panel is centred in the REAL viewport and
// never taller than it — panel top >= 0 AND panel bottom <= innerHeight — at every viewport,
// INCLUDING wide monitors where the ancestor .view-screen --app-scale zoom (up to 1.6) used to
// scale the fixed overlay's 88dvh past the screen and run it off the top and bottom.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const VIEWPORTS = [
  { w: 2560, h: 1440 }, // wide → app-scale ~1.385: the case the previous pass missed
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

async function openVia(page, selector) {
  await installBackendMock(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.wins', '999999');
      localStorage.setItem('taw.winsLifetime', '999999');
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
    } catch { /* ignore */ }
  });
  await page.goto('/?portal=1');
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
  await page.locator(selector).click();
  await page.locator('.shop-panel').waitFor({ state: 'visible' });
}

async function measure(page) {
  return page.evaluate(() => {
    const p = document.querySelector('.shop-panel').getBoundingClientRect();
    return { top: Math.round(p.top), bottom: Math.round(p.bottom), ih: window.innerHeight };
  });
}

for (const { w, h } of VIEWPORTS) {
  for (const [view, selector] of [['SHOP', '.homepage-nav-btn.is-shop'], ['REBIRTH', '.homepage-nav-btn.is-rebirth']]) {
    test(`${view} panel fits ${w}x${h}: top>=0 and bottom<=innerHeight`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await openVia(page, selector);
      const m = await measure(page);
      // eslint-disable-next-line no-console
      console.log(`[shop-fit] ${view} ${w}x${h}  top=${m.top} bottom=${m.bottom} ih=${m.ih}  ${m.top >= 0 && m.bottom <= m.ih ? 'PASS' : 'FAIL'}`);
      expect(m.top, `${view} top @ ${w}x${h}`).toBeGreaterThanOrEqual(0);
      expect(m.bottom, `${view} bottom @ ${w}x${h}`).toBeLessThanOrEqual(m.ih + 1);
    });
  }
}
