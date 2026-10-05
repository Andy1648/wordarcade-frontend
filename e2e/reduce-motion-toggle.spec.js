// e2e/reduce-motion-toggle.spec.js — the app no longer follows the OS motion setting.
//
// School Chromebooks are managed devices that report `prefers-reduced-motion: reduce` by policy, so
// following the OS switched off nearly every animation for players who never asked. Reduce motion is
// now an in-game REDUCE MOTION switch in the 🔊 settings panel, OFF by default
// (src/lib/reduceMotion.js + the build-time CSS rewrite in scripts/postcss-reduce-motion.js).
//
// This spec opts OUT of the harness's reduce-motion mirror (installBackendMock seedReduceMotion:false)
// so it sees exactly what a Chromebook player sees: the OS says reduce, the app animates anyway.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const VIEWPORT = { width: 1366, height: 768 };

/** Names of the infinite animations running right now (the splash's loops), sorted. */
const runningInfinite = () =>
  document
    .getAnimations()
    .filter((a) => {
      try {
        return a.playState === 'running' && a.effect.getTiming().iterations === Infinity;
      } catch {
        return false;
      }
    })
    .map((a) => a.animationName || 'waapi')
    .sort();

/** Animations running on the cursor trail (it reacts to every pointer move on the menu). */
const runningTrail = () =>
  document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('.cursor-trail')).length;

/** A fresh page (fresh sessionStorage, so the splash shows) in `ctx`, with the OS reporting `os`. */
async function newPage(ctx, os) {
  const page = await ctx.newPage();
  await installBackendMock(page, { seedReduceMotion: false });
  await page.emulateMedia({ reducedMotion: os });
  return page;
}

/** The splash in a FRESH context (a context that has seen the menu skips the intro for 30 min),
 *  with the OS reporting `os` and `taw.reduceMotion` set to `stored` (null = never touched). */
async function splashLoops(browser, os, stored = null) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, reducedMotion: os });
  const page = await newPage(ctx, os);
  if (stored !== null) await page.addInitScript((v) => localStorage.setItem('taw.reduceMotion', v), stored);
  await page.goto('/');
  await page.locator('.splash-screen').waitFor();
  await expect(page.getByText(/TYPE TO START/i)).toBeVisible();
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(os === 'reduce');
  await page.waitForTimeout(600); // the one-shot enter pops settle
  const names = await page.evaluate(runningInfinite);
  await ctx.close();
  return names;
}

async function menu(ctx, os) {
  const page = await newPage(ctx, os);
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.waitForTimeout(800);
  return page;
}

async function trailAfterMove(page) {
  await page.mouse.move(300, 300);
  await page.mouse.move(700, 420, { steps: 8 }); // moves only — a click here would open a mode card
  await page.waitForTimeout(30);
  return page.evaluate(runningTrail);
}

async function motionSwitch(page) {
  const btn = page.locator('.homepage-corner-nav .audio-btn');
  if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
  const sw = page.getByRole('switch', { name: 'REDUCE MOTION' });
  await expect(sw).toBeVisible();
  return sw;
}

test('an OS reduced-motion setting no longer turns animations off; the in-game toggle does', async ({ browser }) => {
  // BASELINE: an OS with no motion preference.
  const baseline = await splashLoops(browser, 'no-preference');
  expect(baseline.length, 'the splash runs its loops').toBeGreaterThan(0);

  // A CHROMEBOOK: the OS says reduce, nothing is stored, so REDUCE MOTION is at its default (OFF).
  const ctx = await browser.newContext({ viewport: VIEWPORT, reducedMotion: 'reduce' });
  expect(await splashLoops(browser, 'reduce'), 'infinite animations match the no-preference baseline').toEqual(baseline);

  const page = await menu(ctx, 'reduce');
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-reduce-motion'))).toBe(false);
  await expect(page.locator('.cursor-trail')).not.toHaveCSS('display', 'none');
  expect(await trailAfterMove(page), 'menu pointer effects animate under OS reduce').toBeGreaterThan(0);

  // Turn REDUCE MOTION on in the settings panel: the reduced styling applies LIVE, no reload.
  const sw = await motionSwitch(page);
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  const box = await sw.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', '1');
  expect(await page.evaluate(() => localStorage.getItem('taw.reduceMotion'))).toBe('1');
  await expect(page.locator('.cursor-trail')).toHaveCSS('display', 'none'); // a reduced-motion block, now live
  expect(await trailAfterMove(page), 'no pointer effects with REDUCE MOTION on').toBe(0);

  // It persists, is applied before first paint (index.html inline script), and stills the splash loops.
  const fresh = await newPage(ctx, 'reduce');
  await fresh.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await fresh.evaluate(() => document.documentElement.getAttribute('data-reduce-motion'))).toBe('1');
  await fresh.close();
  expect(await splashLoops(browser, 'reduce', '1'), 'REDUCE MOTION on stops every splash loop').toEqual([]);

  // Keyboard: Space flips it back OFF — the animations return, live.
  const sw2 = await motionSwitch(page);
  await sw2.focus();
  await page.keyboard.press('Space');
  await expect(sw2).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('html')).not.toHaveAttribute('data-reduce-motion', /.*/);
  await expect(page.locator('.cursor-trail')).not.toHaveCSS('display', 'none');
  expect(await trailAfterMove(page)).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('taw.reduceMotion'))).toBe('0');
  expect(await splashLoops(browser, 'reduce', '0'), 'OFF again: back to the baseline loops').toEqual(baseline);
  await ctx.close();
});

test('JS-driven motion follows the toggle, not the OS', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: VIEWPORT, reducedMotion: 'reduce' });
  const page = await menu(ctx, 'reduce');
  // The magnetic card pull is a JS rAF loop gated on reduce motion: it engages under OS reduce.
  const magnet = page.locator('.game-card-magnet').first();
  await magnet.hover();
  await expect.poll(() => magnet.evaluate((el) => el.style.transform), { timeout: 3000 }).not.toBe('');
  // Toggle ON: the magnet unregisters live and hands the rest pose back to CSS.
  await (await motionSwitch(page)).click();
  await expect.poll(() => magnet.evaluate((el) => el.style.transform)).toBe('');
  await magnet.hover();
  await page.waitForTimeout(300);
  expect(await magnet.evaluate((el) => el.style.transform)).toBe('');
  await ctx.close();
});
