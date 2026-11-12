// e2e/art-load.spec.js — art that has not arrived holds its box on a flat plate and fades in; a loading leaderboard says so
// instead of offering "YOUR NAME HERE?" (Andy nov6: "remember the idea of smoothness"). Slow files are simulated per route.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { menuReady, navControl } from './support/menu.js';

test.use({ reducedMotion: 'no-preference' });
const SEED = { 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1', 'taw.rollsOn': '1', 'taw.marksRevealed': '1', 'taw.xp': JSON.stringify({ lv: 12, into: 0 }) };

async function boot(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installBackendMock(page);
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
}

test('a slow shop image holds a sized plate, then fades in; a broken one keeps the plate', async ({ page }) => {
  await boot(page);
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route(/\/shop\/xp-v2\.webp/, async (route) => { await gate; await route.continue(); });
  await page.route(/\/shop\/wins-v2\.webp/, (route) => route.abort());
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await navControl(page, 'shop').first().click();
  const slow = page.locator('img.sp2-art[src*="xp-v2"]').first();
  await slow.waitFor({ state: 'attached' });
  const held = await slow.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, art: el.getAttribute('data-art'), bg: getComputedStyle(el).backgroundColor };
  });
  expect(held.art).toBeNull();
  expect(held.w).toBeGreaterThan(30); // the box is reserved before the file lands
  expect(held.h).toBeGreaterThan(30);
  expect(held.bg).not.toBe('rgba(0, 0, 0, 0)');
  // the shelf's layout does not move when it lands
  await page.waitForTimeout(1200); // the shelf's entrance has settled
  const before = await page.locator('.sp2-card').first().boundingBox();
  release();
  await expect(slow).toHaveAttribute('data-art', 'in');
  expect(await slow.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  expect(await page.locator('.sp2-card').first().boundingBox()).toEqual(before);
  // the fade is finite: nothing here loops
  expect(await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.tagName === 'IMG' && a.effect.getTiming().iterations === Infinity).length)).toBe(0);
  // the aborted file rests on the plate, no broken-image state
  const broken = page.locator('img.sp2-art[src*="wins-v2"]').first();
  await expect(broken).toHaveAttribute('data-art', 'fail');
  expect(await broken.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
});

test('a loading board shows row placeholders, never the empty-board offer', async ({ page }) => {
  await boot(page);
  await mockBoard(page, [], { caps: true, econ: true, boardEcon: true, weekly: true, season2: true });
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route(/\/rest\/v1\//, async (route) => { await gate; await route.fallback(); });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await navControl(page, 'leaderboard').first().click();
  await page.locator('.lb2').waitFor({ state: 'visible' });
  await expect(page.locator('.lb2-skel-row').first()).toBeVisible();
  await expect(page.getByText('YOUR NAME HERE?')).toHaveCount(0);
  release();
});
