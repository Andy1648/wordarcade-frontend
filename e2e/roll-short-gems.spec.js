// e2e/roll-short-gems.spec.js — short of gems is not a dead end: the ROLL button says how far off and shows how far along, and
// PLAY FOR GEMS sits under it and goes back to the games. It fits at every size, over nothing. Finite: nothing here loops.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const OUT = process.env.SHORT_SHOTS || '';
const SEED = {
  'taw.rollsOn': '1', 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1',
  'taw.xp': JSON.stringify({ lv: 12, into: 0 }), 'taw.marksRevealed': '1', 'taw.marksOwned': '[]', 'taw.marksSeen': '[]',
  'taw.s2.gems': JSON.stringify({ v: 1, bal: 20, peak: 12, streak: 0, mig: 1 }),
  'taw.s2.welcome': JSON.stringify({ st: 'done' }), 'taw.reveal': 'all', 'taw.s2.xp': JSON.stringify({ lv: 12, f: 0, rc: 0, v: 10 }),
  'taw.markRolls': JSON.stringify({ v: 2, rolls: 30, sinceEpic: 5, sinceLegendary: 30, everEpic: true, starter: true, marks: {}, milestones: [], done: [] }),
};

for (const [w, h] of [[1920, 1080], [1366, 768], [1280, 551], [390, 844], [360, 640]]) {
  test(`${w}x${h}: short of gems shows the distance + the way to earn`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.addInitScript((s) => { localStorage.removeItem('taw.season2.off'); if (sessionStorage.getItem('sg')) return; sessionStorage.setItem('sg', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    await page.locator('.hp-nav.is-gears:visible').first().click();
    await page.locator('.rs-overlay').waitFor();
    const roll = page.locator('.rs-roll');
    await expect(roll.locator('.rs-roll-lbl')).toHaveText('55 MORE');
    await expect(roll.locator('.rs-roll-price')).toHaveText('20 / 75');
    const earn = page.getByTestId('roll-earn');
    await expect(earn).toHaveText('PLAY FOR GEMS');
    if (OUT) await page.screenshot({ path: `${OUT}/short-${w}.png` });
    const g = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const e = r('[data-testid="roll-earn"]');
      const b = r('.rs-roll');
      const fill = document.querySelector('.rs-roll-fill');
      return { top: e.top, bottom: e.bottom, left: e.left, right: e.right, h: e.height, btnBottom: b.bottom, scale: new DOMMatrix(getComputedStyle(fill).transform).a };
    });
    expect(g.h).toBeGreaterThanOrEqual(44);
    expect(g.top).toBeGreaterThanOrEqual(g.btnBottom - 1); // under the button, never on it
    expect(g.bottom).toBeLessThanOrEqual(h);
    expect(g.left).toBeGreaterThanOrEqual(0);
    expect(g.right).toBeLessThanOrEqual(w);
    expect(g.scale).toBeCloseTo(20 / 75, 2);
    await earn.click();
    await expect(page.locator('.rs-overlay')).toHaveCount(0);
  });
}
