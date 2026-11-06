// e2e/chromebook-fit.spec.js — the short laptop sizes (a Chromebook's browser leaves 600-650 px of height). Menu, shop and roll fit the
// window with no page scroll, and their main control is fully on screen.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

const OUT = process.env.FIT_SHOTS || '';
const SEED = {
  'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1', 'taw.rollsOn': '1', 'taw.marksRevealed': '1', 'taw.reveal': 'all',
  'taw.tut.gems': '1', 'taw.tut.power': '1', 'taw.tut.gears': '1', 'taw.tut.rebirth': '1', 'taw.tut.board': '1', 'taw.tut.keyTier': '1', 'taw.tut.init': '1',
  'taw.s2.welcome': JSON.stringify({ st: 'done' }), 'taw.s2.xp': JSON.stringify({ lv: 60, f: 0, rc: 6, v: 10 }), 'taw.s2.rebirths': '6',
  'taw.s2.gems': JSON.stringify({ v: 1, bal: 1840, peak: 60, streak: 3, mig: 1 }), 'taw.s2.wins': '184250',
};

const pageFits = (page) => page.evaluate(() => {
  const d = document.documentElement;
  return { x: d.scrollWidth - innerWidth, y: d.scrollHeight - innerHeight };
});
const onScreen = (page, sel, w, h) => page.locator(sel).first().evaluate((el, { w, h }) => {
  const r = el.getBoundingClientRect();
  return r.left >= -1 && r.top >= -1 && r.right <= w + 1 && r.bottom <= h + 1;
}, { w, h });

for (const [w, h] of [[1366, 650], [1280, 600]]) {
  test(`${w}x${h}: menu, shop and roll fit without a page scroll`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.addInitScript((s) => { localStorage.removeItem('taw.season2.off'); if (sessionStorage.getItem('cf')) return; sessionStorage.setItem('cf', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    let f = await pageFits(page);
    expect(f.x, 'menu sideways').toBeLessThanOrEqual(0);
    expect(f.y, 'menu down').toBeLessThanOrEqual(0);
    await navControl(page, 'gears').first().click();
    await page.locator('.rs-overlay').waitFor();
    await page.waitForTimeout(300);
    if (OUT) await page.screenshot({ path: `${OUT}/roll-${w}.png` });
    f = await pageFits(page);
    expect(f.x, 'roll sideways').toBeLessThanOrEqual(0);
    expect(f.y, 'roll down').toBeLessThanOrEqual(0);
    expect(await onScreen(page, '.rs-roll', w, h), 'ROLL on screen').toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('.rs-overlay')).toHaveCount(0);
    await navControl(page, 'shop').first().click();
    await page.locator('.sp2').first().waitFor();
    await page.waitForTimeout(600);
    if (OUT) await page.screenshot({ path: `${OUT}/shop-${w}.png` });
    f = await pageFits(page);
    expect(f.x, 'shop sideways').toBeLessThanOrEqual(0);
    expect(f.y, 'shop down').toBeLessThanOrEqual(0);
    const cards = await page.locator('.sp2-grid:not([hidden]) .sp2-card').evaluateAll((els, { h }) => els.filter((e) => e.getBoundingClientRect().bottom > h + 1).length, { h });
    expect(cards, 'no BOOSTS card hangs off the bottom').toBe(0);
  });
}
