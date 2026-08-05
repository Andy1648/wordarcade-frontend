// e2e/intro.spec.js
//
// The boot chain: LoadingScreen (fixed ~2.5s fuse) -> SplashScreen (click to
// start) -> TransitionIntro (TYPE FAST / DIE SLOW) -> knife-split -> menu. First
// visits see the whole thing; the app has a built-in skip (?portal=1) that lands
// straight on the menu, which the rest of the suite uses.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const MENU = { name: 'Type a Word' };

test.describe('intro sequence', () => {
  // Exercise the REAL boot animation here (override the suite-wide reduced-motion
  // emulation): this is the one test that should sit through the genuine
  // loading -> splash -> fight-card intro, exactly as a first-time visitor sees
  // it. It only ever clicks the full-screen splash, so idle motion is no problem.
  test.use({ reducedMotion: 'no-preference' });

  test('a first visit loads through the full intro to the menu', async ({ page }) => {
    // The socket is intercepted so nothing hits the live backend; the intro is
    // driven entirely by the app's own timers, independent of the socket.
    const mock = await installBackendMock(page);

    // A fresh context (Playwright default) has no visitHistory, so SEEN_INTRO is
    // false and the full splash + fight-card intro plays.
    await page.goto('/');

    // 1) The loading screen (bomb fuse) is the very first thing shown.
    await expect(page.locator('.loading-wrap')).toBeVisible();

    // 2) It hands off to the splash on its own fixed timer (no arbitrary wait —
    //    we wait for the splash's call-to-action to appear).
    const splash = page.locator('.splash-screen');
    await expect(splash).toBeVisible();
    await expect(page.getByText('CLICK ANYWHERE TO START')).toBeVisible();

    // 3) Any click dismisses the splash (also the app's audio-unlock gesture) and
    //    starts the fight-card intro, which then wipes to the homepage.
    await splash.click();

    // 4) We end on the menu: the wordmark + the four mode cards are present.
    await expect(page.getByRole('img', MENU)).toBeVisible();
    await expect(page.locator('.game-card')).toHaveCount(4);

    // The whole time, the only backend contact was the intercepted socket attempt
    // — never the real server.
    expect(mock.connectionAttempts()).toBeGreaterThan(0);
  });

  test('the built-in ?portal=1 skip lands straight on the menu', async ({ page }) => {
    await installBackendMock(page);
    await page.goto('/?portal=1');

    // No splash — the menu is shown immediately (loading is pre-completed).
    await expect(page.getByRole('img', MENU)).toBeVisible();
    await expect(page.locator('.splash-screen')).toHaveCount(0);
    await expect(page.locator('.game-card')).toHaveCount(4);
  });
});
