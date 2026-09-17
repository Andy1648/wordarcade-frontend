// e2e/splash-loops.spec.js (perf/first-load) — the SPLASH is the LCP screen, so it runs at most
// THREE infinite animations: the start-prompt blink, ONE logo effect (the bounce) and the burst
// spin. Before this branch it ran 21 (15 ember risers, the two RGB ghost drifts, the mascot
// breathe, plus those three). The MENU's persistent loop count is pinned unchanged (0 at rest:
// the menu motion law — its beat effects are finite one-shots).
// Reduced-motion is switched OFF here (the suite emulates it) so the real loops are counted;
// a second test confirms reduced-motion still stops every loop on the splash.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const MENU_INFINITE_AT_REST = 0;

const runningInfinite = () => document.getAnimations().filter((a) => {
  try { return a.playState === 'running' && a.effect.getTiming().iterations === Infinity; } catch { return false; }
}).length;

test.describe('splash infinite-animation budget', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the splash runs ≤ 3 infinite animations; the menu count is unchanged', async ({ page }) => {
    await installBackendMock(page);
    await page.goto('/');
    await page.locator('.splash-screen').waitFor();
    await expect(page.getByText(/TYPE TO START/i)).toBeVisible();
    // Let the one-shot enter pops (mascot-enter 250ms, tagline fade) settle.
    await page.waitForTimeout(600);
    const splash = await page.evaluate(runningInfinite);
    expect(splash, 'infinite animations running on the splash').toBeLessThanOrEqual(3);
    // The embers are a single static layer: present, but nothing on them animates.
    const emberAnims = await page.evaluate(() =>
      document.getAnimations().filter((a) => a.effect?.target?.classList?.contains('splash-ember')).length);
    expect(emberAnims).toBe(0);
    await expect(page.locator('.splash-ember')).toHaveCount(15);

    await page.goto('/?portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    await page.waitForTimeout(1500);
    const menu = await page.evaluate(runningInfinite);
    expect(menu, 'infinite animations running on the menu at rest').toBe(MENU_INFINITE_AT_REST);
  });
});

test.describe('splash honours prefers-reduced-motion', () => {
  test('no infinite animation runs on the splash', async ({ page }) => {
    await installBackendMock(page);
    // Explicit per-page emulation: the context-level `reducedMotion` option was observed NOT
    // to flip matchMedia('(prefers-reduced-motion: reduce)') in this suite, which would make
    // this assertion vacuous. emulateMedia does flip it (verified).
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await page.locator('.splash-screen').waitFor();
    await expect(page.getByText(/TYPE TO START/i)).toBeVisible();
    await page.waitForTimeout(600);
    expect(await page.evaluate(runningInfinite)).toBe(0);
  });
});
