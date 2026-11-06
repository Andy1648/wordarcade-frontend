// e2e/load-feedback.spec.js — NOTHING WAITS ON A BLANK SCREEN (Andy nov6: "why don't you have a loading symbol or a filler for
// things that don't load immediately"). A cold visit paints the boot shell from the HTML alone, before any JS or CSS has
// arrived; the shell's bar is finite; a slow overlay chunk shows its skeleton after a beat; a fast one never flashes it.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

const SEED = { 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1', 'taw.rollsOn': '1', 'taw.marksRevealed': '1', 'taw.xp': JSON.stringify({ lv: 12, into: 0 }) };

for (const [w, h] of [[1366, 768], [390, 844]]) {
  test(`${w}x${h}: the boot shell paints with the HTML alone, finite, then React replaces it`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    // hold every script + stylesheet: only the HTML has arrived
    let release;
    const gate = new Promise((res) => { release = res; });
    await page.route(/\/assets\/.*\.(js|css)$/, async (route) => { await gate; await route.continue(); });
    await page.goto('/?portal=1', { waitUntil: 'commit' });
    const title = page.locator('.boot-t');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('TYPE A WORD');
    const shell = await page.evaluate(() => {
      const anims = document.getAnimations();
      const r = document.querySelector('.boot-b').getBoundingClientRect();
      return {
        bg: getComputedStyle(document.querySelector('.boot')).backgroundColor,
        inf: anims.filter((a) => a.effect.getTiming().iterations === Infinity).length,
        barOnScreen: r.left >= 0 && r.right <= innerWidth && r.width > 100,
        scroll: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(shell.bg).toBe('rgb(13, 6, 24)');
    expect(shell.inf).toBe(0);
    expect(shell.barOnScreen).toBe(true);
    expect(shell.scroll).toBe(false);
    release();
    await menuReady(page);
    await expect(page.locator('.boot')).toHaveCount(0); // React replaced it
    // the app never painted unstyled: its own stylesheet is applied by the time the menu is up
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.homepage-logo, .hp-m-title')).fontFamily)).not.toMatch(/^"?Times/);
  });
}

async function seeded(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installBackendMock(page);
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
}

test('a slow GEARS chunk shows the panel skeleton instead of a dead tap', async ({ page }) => {
  await seeded(page);
  let held = 0;
  await page.route(/\/assets\/RollScreen-.*\.js$/, async (route) => { held += 1; await new Promise((r) => setTimeout(r, 2500)); await route.continue(); });
  await page.goto('/?portal=1');
  await menuReady(page);
  const t0 = Date.now();
  await navControl(page, 'gears').first().click();
  const sk = page.locator('.ovsk-overlay');
  await expect(sk).toBeVisible({ timeout: 2000 });
  await expect(sk.locator('.ovsk-title')).toHaveText('GEARS');
  await expect.poll(() => sk.evaluate((el) => Number(getComputedStyle(el).opacity)).catch(() => 0), { timeout: 1500 }).toBeGreaterThan(0.9);
  expect(Date.now() - t0, 'the skeleton shows long before the chunk lands').toBeLessThan(2400);
  await page.locator('.rs-overlay').waitFor();
  await expect(sk).toHaveCount(0);
  expect(held).toBeGreaterThan(0);
});

test('a fast chunk never flashes the skeleton: it stays invisible for its first 150 ms', async ({ page }) => {
  await seeded(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  const css = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'ovsk-overlay';
    document.body.appendChild(el);
    const a = el.getAnimations()[0];
    const t = a ? a.effect.getTiming() : null;
    const out = a ? { delay: t.delay, iterations: t.iterations, opacity: Number(getComputedStyle(el).opacity) } : null;
    el.remove();
    return out;
  });
  expect(css).toEqual({ delay: 150, iterations: 1, opacity: 0 });
});
