// e2e/overlay-fill.spec.js — fix/overlay-zoom GATE. The Shop / Stats / Collection / Achievements
// overlays used the SAME fragile trick the menu did: rendered inside .view-screen's
// `zoom: var(--app-scale)` and cancelled it with a reciprocal `zoom: calc(1/var(--app-scale))` on the
// overlay root. Headless Chromium compounds that to 1.0, so it "worked" in tests; recent real Chrome
// does not, so the overlay rendered at --app-scale (mis-sized / off-centre) in production.
//
// Same rule as menu-fill: NO element from the overlay panel up to <body> may carry zoom != 1. Each
// overlay is opened at four viewports incl. two short heights (--app-scale < 1, the regression case).
import { test, expect } from '@playwright/test';
import { gotoMenu } from './support/backendMock.js';

const VIEWPORTS = [
  { w: 1280, h: 640 },
  { w: 1568, h: 675 },
  { w: 1920, h: 1080 },
  { w: 2560, h: 1440 },
];

// name -> { open(page), root, panel }
const OVERLAYS = {
  shop: { root: '.shop-overlay', panel: '.shop-panel', open: async (p) => { await p.locator('.homepage-nav-btn.is-shop').click(); await p.locator('.shop-overlay').waitFor(); } },
  stats: { root: '.stats-overlay', panel: '.stats-panel', open: async (p) => { await p.locator('.homepage-nav-btn.is-stats').click(); await p.locator('.stats-overlay').waitFor(); } },
  collection: { root: '.stats-overlay', panel: '.stats-panel', open: async (p) => { await p.locator('.homepage-nav-btn.is-stats').click(); await p.locator('.stats-overlay').waitFor(); await p.getByRole('tab', { name: 'COLLECTION' }).click(); } },
  achievements: { root: '.stats-overlay', panel: '.stats-panel', open: async (p) => { await p.locator('.homepage-nav-btn.is-stats').click(); await p.locator('.stats-overlay').waitFor(); await p.getByRole('tab', { name: 'ACHIEVEMENTS' }).click(); } },
};

async function measure(page, rootSel, panelSel) {
  return page.evaluate(([rootSel, panelSel]) => {
    const root = document.querySelector(rootSel);
    const panel = document.querySelector(panelSel) || root;
    const rr = root.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const zoomed = [];
    let el = panel;
    while (el) {
      const z = getComputedStyle(el).zoom;
      if (z && z !== '1' && z !== 'normal') zoomed.push(`${el.id ? '#' + el.id : '.' + (el.className || el.tagName).toString().split(' ')[0]}=${z}`);
      el = el.parentElement;
    }
    return { rootW: Math.round(rr.width), rootH: Math.round(rr.height), panelW: Math.round(pr.width), panelH: Math.round(pr.height), vw: window.innerWidth, vh: window.innerHeight, zoomed };
  }, [rootSel, panelSel]);
}

for (const name of Object.keys(OVERLAYS)) {
  const o = OVERLAYS[name];
  test.describe(`overlay ${name} fills / no ancestor zoom`, () => {
    for (const { w, h } of VIEWPORTS) {
      test(`${name} @ ${w}x${h}`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await gotoMenu(page);
        await o.open(page);
        await page.waitForTimeout(120);
        const m = await measure(page, o.root, o.panel);
        // eslint-disable-next-line no-console
        console.log(`[overlay-fill] ${name} @ ${w}x${h}  root=${m.rootW}x${m.rootH} (${(m.rootW / m.vw * 100).toFixed(1)}% x ${(m.rootH / m.vh * 100).toFixed(1)}%)  panel=${m.panelW}x${m.panelH}  zoomed=${JSON.stringify(m.zoomed)}`);
        expect(m.zoomed, `${name} overlay must not depend on ancestor zoom at ${w}x${h}`).toEqual([]);
        // The scrim root is inset:0 → must cover the whole viewport (this breaks on real Chrome when
        // the reciprocal fails: the fixed inset:0 renders at --app-scale instead).
        expect(m.rootW / m.vw, `${name} root width fill at ${w}x${h}`).toBeGreaterThanOrEqual(0.99);
        expect(m.rootH / m.vh, `${name} root height fill at ${w}x${h}`).toBeGreaterThanOrEqual(0.99);
      });
    }
  });
}
