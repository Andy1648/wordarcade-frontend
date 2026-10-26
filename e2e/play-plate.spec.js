// e2e/play-plate.spec.js — the painted PLAY sticker (components/playPlate, Andy oct24 "that giant play button on first
// screen horrendously lacks flavor"): on the first screen (the splash) and the fresh menu's TITLE it is the painted plate
// with the word on it, a ≥44px target, inside a phone's width, and it still does its one job. PW_SHOTS=dir saves the
// review screenshots.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SHOTS = process.env.PW_SHOTS || '';
const SIZES = [{ name: 'desk', w: 1366, h: 768 }, { name: 'phone', w: 390, h: 844 }, { name: 'small', w: 360, h: 640 }];

// wait for the finite one-shot entrances (slap / pop scale) on this element and its ancestors to land before measuring —
// a box read mid-overshoot is wider than the resting layout and reads as a clip on a slow CI runner
const settled = (loc) => loc.evaluate((el) => {
  const anims = [];
  for (let n = el; n; n = n.parentElement) {
    for (const a of n.getAnimations()) if (a.effect?.getTiming().iterations !== Infinity) anims.push(a.finished.catch(() => {}));
  }
  return Promise.all(anims);
});

async function plateOk(page, sel) {
  const plate = page.locator(`${sel}.pp`);
  await expect(plate).toBeVisible();
  await expect(plate.locator('.pp-plate')).toHaveJSProperty('complete', true);
  expect(await plate.locator('.pp-plate').evaluate((i) => i.naturalWidth)).toBeGreaterThan(0);
  await settled(plate);
  const box = await plate.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  const vw = page.viewportSize().width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vw + 0.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
  return plate;
}

for (const s of SIZES) {
  test(`${s.name}: the first screen's PLAY is the painted sticker and starts the game`, async ({ page }) => {
    await page.setViewportSize({ width: s.w, height: s.h });
    await installBackendMock(page, { freshReveal: true });
    await page.goto('/');
    const plate = await plateOk(page, '.splash-play');
    await expect(plate.locator('.pp-k')).toHaveText('PLAY');
    await page.waitForTimeout(700); // the slap-in settles
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/splash-${s.name}.png` });
    await plate.click();
    await expect(page.locator('.splash-play')).toHaveCount(0, { timeout: 5000 });
  });

  test(`${s.name}: the fresh menu's TITLE PLAY is the painted sticker`, async ({ page }) => {
    await page.setViewportSize({ width: s.w, height: s.h });
    await installBackendMock(page, { freshReveal: true });
    await page.addInitScript(() => {
      if (sessionStorage.getItem('pp.seeded')) return;
      sessionStorage.setItem('pp.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.econ', '12');
      localStorage.setItem('taw.tut.markRolls', '1');
      localStorage.setItem('taw.s2.conv', JSON.stringify({ v: 1, st: 'shown', had: false, srv: 1 }));
    });
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    const plate = await plateOk(page, '.tp-play');
    await expect(plate.locator('.pp-k')).toHaveText('PLAY');
    await expect(plate.locator('.tp-play-s')).toHaveText(/WORD BOMB/);
    await page.waitForTimeout(700);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/title-${s.name}.png` });
  });
}
