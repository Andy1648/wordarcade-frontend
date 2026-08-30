// e2e/menu-fill.spec.js — fix/visual-real item 2 GATE: "fills the viewport" is now a test, not a
// hope. The menu's app shell (the neon-framed .homepage-stage) must OCCUPY the window, not sit in a
// small centred box with dead space around it. Before the fix the stage was capped at
// max-width:1180px, so it filled only ~62% of a 1920 window and ~46% of a 2560 one; the height also
// hugged its content, leaving the "880×560 box" the audit reported.
//
// The gate asserts the stage fills ≥90% of BOTH axes at every desktop viewport it is given, and it
// logs the measured percentages so a regression (a re-introduced width cap, or the height hug) is
// visible in the run output. It runs at whatever viewports are listed here; on a runner with a
// different window it still catches a regression because the assertion is proportional to the
// viewport, not an absolute pixel size.
import { test, expect } from '@playwright/test';
import { gotoMenu } from './support/backendMock.js';

// The exact viewports the item-2 acceptance calls out, widest first.
const VIEWPORTS = [
  { w: 2560, h: 1440 },
  { w: 1920, h: 1080 },
  { w: 1600, h: 900 },
  { w: 1422, h: 864 },
  { w: 1366, h: 768 },
];

// The app shell must fill at least this fraction of each axis.
const MIN_FILL = 0.9;

async function measureStage(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.homepage-stage');
    const r = stage.getBoundingClientRect();
    return {
      w: r.width,
      h: r.height,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
}

test.describe('menu fills the viewport (item 2)', () => {
  for (const { w, h } of VIEWPORTS) {
    test(`${w}x${h}: app shell fills ≥90% of width and height`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await gotoMenu(page);
      // Let the two-pass layout effect (--menu-scale + fit) settle.
      await page.waitForTimeout(150);
      const m = await measureStage(page);
      const fillW = m.w / m.vw;
      const fillH = m.h / m.vh;
      // eslint-disable-next-line no-console
      console.log(
        `[menu-fill] ${w}x${h}  stage=${Math.round(m.w)}x${Math.round(m.h)}  ` +
          `fillW=${(fillW * 100).toFixed(1)}%  fillH=${(fillH * 100).toFixed(1)}%`,
      );
      expect(fillW, `stage width fill at ${w}x${h}`).toBeGreaterThanOrEqual(MIN_FILL);
      expect(fillH, `stage height fill at ${w}x${h}`).toBeGreaterThanOrEqual(MIN_FILL);
    });
  }
});
