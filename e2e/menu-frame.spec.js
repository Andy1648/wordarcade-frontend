// e2e/menu-frame.spec.js — items 2 & 3: the card grid fills the frame (a 16-32px gutter to the
// stage's inner edge, not ~200px of dead space) and NO mode card is clipped by the scroll
// region's overflow (the featured Word Bomb card was poking past the left clip edge).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const VIEWPORTS = [
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1366, h: 768 },
];

async function measure(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.homepage-stage');
    const cs = getComputedStyle(stage);
    const sb = stage.getBoundingClientRect();
    const inner = {
      left: sb.left + parseFloat(cs.paddingLeft),
      right: sb.right - parseFloat(cs.paddingRight),
    };
    const grid = document.querySelector('.homepage-cards-grid').getBoundingClientRect();
    // feat/menu-centre: the card row lives in the CONSOLE (the cards region, right of the rail) — its gutter is to
    // the region's edges, and the row is centred in it.
    const region = document.querySelector('.homepage-cards-region').getBoundingClientRect();
    const scroll = document.querySelector('.homepage-cards-scroll').getBoundingClientRect();
    // only the cards ON the shown page (feat/menu-centre: the other page is display:none, rect 0)
    const cards = [...document.querySelectorAll('.game-card-magnet')].filter((m) => m.getClientRects().length).map((m) => {
      const c = m.querySelector('.game-card').getBoundingClientRect();
      return {
        name: m.getAttribute('data-game') || '?',
        insideL: +(c.left - scroll.left).toFixed(1),
        insideR: +(scroll.right - c.right).toFixed(1),
      };
    });
    return {
      gapL: +(grid.left - region.left).toFixed(1),
      gapR: +(region.right - grid.right).toFixed(1),
      regionW: region.width,
      stageL: +(region.left - inner.left).toFixed(1),
      cards,
    };
  });
}

for (const { w, h } of VIEWPORTS) {
  test(`${w}x${h}: grid gutter is 16-32px and no card is clipped`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.goto('/?portal=1');
    await menuReady(page);
    await page.waitForTimeout(200);
    const m = await measure(page);
    // eslint-disable-next-line no-console
    console.log(`[menu-frame] ${w}x${h} gutter L=${m.gapL} R=${m.gapR} | ${m.cards.map((c) => `${c.name}(L${c.insideL},R${c.insideR})`).join(' ')}`);

    // Item 2 (feat/menu-centre): the row is centred in the console — equal gutters (±1.5px), each at least the
    // scroll gutter (8px) and never a dead band (≤ 15% of the region: the cards fill it, height-bound at most).
    expect(Math.abs(m.gapL - m.gapR), `centred in the console at ${w}x${h}`).toBeLessThanOrEqual(1.5);
    for (const side of ['gapL', 'gapR']) {
      expect(m[side], `${side} at ${w}x${h}`).toBeGreaterThanOrEqual(8);
      expect(m[side], `${side} at ${w}x${h}`).toBeLessThanOrEqual(m.regionW * 0.15);
    }
    // the console starts right of the rail, never at the stage edge (the rail column is real)
    expect(m.stageL, `rail column at ${w}x${h}`).toBeGreaterThan(100);
    // Item 3: every card sits horizontally inside the scroll region (its clipping parent).
    for (const c of m.cards) {
      expect(c.insideL, `${c.name} left inside scroll @ ${w}x${h}`).toBeGreaterThanOrEqual(-0.5);
      expect(c.insideR, `${c.name} right inside scroll @ ${w}x${h}`).toBeGreaterThanOrEqual(-0.5);
    }
  });
}
