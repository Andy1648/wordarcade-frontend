// e2e/game-fill.spec.js — fix/game-fill GATE: the in-game solo stage (.solo-root) must FILL the
// viewport, the same bar menu-fill.spec.js holds the menu to. This is the guard that was MISSING:
// the fill gate only covered the menu, so the game screens silently rendered as a narrow centred
// column (CHAIN at 1280x551 filled ~36% of the width — two-thirds backdrop). CHAIN + FUSE are now
// exempt from the .view-screen --app-scale zoom (App.jsx) and fill the window like the menu does.
//
// TWO assertions, mirroring menu-fill (the second is the important one):
//   1) FILL — .solo-root fills >=90% of BOTH axes at every desktop viewport.
//   2) NO-ANCESTOR-ZOOM — nothing from .solo-root up to <body> carries a `zoom` != 1. A fill built
//      on ancestor zoom breaks per-browser (recent Chrome does not compound the reciprocal); the
//      menu regression came from exactly that, so we forbid it here too.
//
// NOTE (scope): Word Bomb / Category Blitz / SAT Rush deliberately KEEP the --app-scale zoom — their
// taller stages cannot fit a 551px-high window without it (removing it clips the live game), so they
// are not width-fillable without a per-screen height-fit redesign. This gate covers the solo modes,
// which were the egregious case and are now converted.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const VIEWPORTS = [
  { w: 1920, h: 1080 },
  { w: 1600, h: 900 },
  { w: 1568, h: 675 }, // short height
  { w: 1366, h: 768 },
  { w: 1280, h: 551 }, // wide-short — the reported regression case
];
const MIN_FILL = 0.9;
const card = (page, id) => page.locator(`.game-card-magnet[data-game="${id}"] .game-card`);

async function enterSolo(page, id) {
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* ignore */ }
  });
  await installBackendMock(page);
  await page.goto('/?portal=1&soloms=20000');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  await card(page, id).click({ force: true });
  await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor({ state: 'visible' });
  await page.waitForTimeout(150);
}

async function measure(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.solo-root');
    const r = root.getBoundingClientRect();
    const zoomed = [];
    let el = root;
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

for (const id of ['chain', 'fuse']) {
  test.describe(`${id} fills the viewport`, () => {
    for (const { w, h } of VIEWPORTS) {
      test(`${id} ${w}x${h}: .solo-root fills >=90% of both axes with no ancestor zoom`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await enterSolo(page, id);
        const m = await measure(page);
        const fillW = m.w / m.vw;
        const fillH = m.h / m.vh;
        // eslint-disable-next-line no-console
        console.log(`[game-fill] ${id} ${w}x${h}  root=${Math.round(m.w)}x${Math.round(m.h)}  fillW=${(fillW * 100).toFixed(1)}%  fillH=${(fillH * 100).toFixed(1)}%  zoomedAncestors=${JSON.stringify(m.zoomed)}`);
        expect(m.zoomed, `${id} fill must not depend on ancestor zoom at ${w}x${h}`).toEqual([]);
        expect(fillW, `${id} .solo-root width fill at ${w}x${h}`).toBeGreaterThanOrEqual(MIN_FILL);
        expect(fillH, `${id} .solo-root height fill at ${w}x${h}`).toBeGreaterThanOrEqual(MIN_FILL);
      });
    }
  });
}
