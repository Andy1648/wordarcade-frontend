// e2e/menu-fill.spec.js — fix/visual-real item 2 GATE: "fills the viewport" is now a test, not a
// hope. The menu's app shell (the neon-framed .homepage-stage) must OCCUPY the window, not sit in a
// small centred box with dead space around it.
//
// TWO assertions, because the first alone let a real regression through:
//   1) FILL — the stage fills >=90% of both axes at every desktop viewport.
//   2) NO-ANCESTOR-ZOOM — no element from .homepage-stage up to <body> carries a `zoom` other than 1.
//      This is the important one. The menu used to inherit .view-screen's `zoom: var(--app-scale)`
//      and cancel it with a reciprocal `zoom: calc(1/var(--app-scale))` on .homepage-wrap. Headless
//      Chromium compounds that reciprocal to a clean 1.0, so the FILL check passed — but recent
//      real Chrome does NOT compound it, so the menu rendered at --app-scale (~64% at 1568x675) in
//      production while this gate stayed green. A fill built on nested-zoom cancellation is a fill
//      that can silently break per-browser; forbidding ancestor zoom entirely is what actually
//      guards it. The height 675 below is deliberately SHORT (--app-scale is heightCap-driven there),
//      the exact case the old all-tall viewport list missed.
import { test, expect } from '@playwright/test';
import { gotoMenu } from './support/backendMock.js';

const VIEWPORTS = [
  { w: 2560, h: 1440 },
  { w: 1920, h: 1080 },
  { w: 1600, h: 900 },
  { w: 1568, h: 675 }, // short height — --app-scale < 1, the production-regression case
  { w: 1422, h: 864 },
  { w: 1366, h: 768 },
  { w: 1280, h: 640 }, // short height
];

const MIN_FILL = 0.9;

async function measure(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.homepage-stage');
    const r = stage.getBoundingClientRect();
    // Walk stage -> body; record any ancestor whose computed zoom isn't 1 ("normal").
    const zoomed = [];
    let el = stage;
    while (el) {
      const z = getComputedStyle(el).zoom;
      if (z && z !== '1' && z !== 'normal') {
        zoomed.push(`${el.id ? '#' + el.id : '.' + (el.className || el.tagName).toString().split(' ')[0]}=${z}`);
      }
      el = el.parentElement;
    }
    return { w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight, zoomed };
  });
}

test.describe('menu fills the viewport (item 2)', () => {
  for (const { w, h } of VIEWPORTS) {
    test(`${w}x${h}: app shell fills >=90% of both axes with no ancestor zoom`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await gotoMenu(page);
      await page.waitForTimeout(150);
      const m = await measure(page);
      const fillW = m.w / m.vw;
      const fillH = m.h / m.vh;
      // eslint-disable-next-line no-console
      console.log(`[menu-fill] ${w}x${h}  stage=${Math.round(m.w)}x${Math.round(m.h)}  fillW=${(fillW * 100).toFixed(1)}%  fillH=${(fillH * 100).toFixed(1)}%  zoomedAncestors=${JSON.stringify(m.zoomed)}`);
      // The fill must NOT be produced by a nested-zoom cancellation (breaks on real Chrome).
      expect(m.zoomed, `menu fill must not depend on ancestor zoom at ${w}x${h}`).toEqual([]);
      expect(fillW, `stage width fill at ${w}x${h}`).toBeGreaterThanOrEqual(MIN_FILL);
      expect(fillH, `stage height fill at ${w}x${h}`).toBeGreaterThanOrEqual(MIN_FILL);
    });
  }
});
