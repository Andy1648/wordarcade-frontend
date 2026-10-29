// e2e/menu-spotlight.spec.js
//
// The first-run MENU spotlight (coach mark over the XP bar) must NEVER block input: the very
// first keystroke has to BOTH dismiss the spotlight AND credit XP, exactly as it would with no
// spotlight present. A regression once let the coach mark swallow the opening keystrokes, so
// this drives a REAL key (page.keyboard.press → a trusted CDP key event, not a dispatched one,
// which is the only kind that reproduced the bug) and asserts the spotlight is gone and the XP
// store advanced on that single press.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

// intoLevel banked in the Economy-v5 store (taw.xp = { lv, into }); 0 when nothing is credited.
async function intoLevel(page) {
  return page.evaluate(() => {
    try {
      // PV10: taw.xp stores the fraction into the level; the XP number comes from the app's probe.
      if (!localStorage.getItem('taw.xp') || !window.__tawXp) return 0;
      return Math.round(window.__tawXp().intoLevel) || 0;
    } catch {
      return 0;
    }
  });
}

test.describe('first-run menu spotlight', () => {
  test('one real keystroke dismisses the spotlight AND credits XP', async ({ page }) => {
    await installBackendMock(page);
    // Fresh context => the menu-spotlight "seen" flag is unset, so the coach mark shows.
    // ?portal=1 skips only the boot splash/intro (not the spotlight).
    await page.goto('/?portal=1');

    await page.locator('.menu-xp-bar').first().waitFor({ state: 'visible' });
    // The spotlight is up (once the intro is over, ~2.6 s) and nothing has been credited yet.
    await expect(page.locator('.spotlight-overlay')).toHaveCount(1, { timeout: 8_000 });
    expect(await intoLevel(page)).toBe(0);

    // A single REAL keystroke (trusted key event), the way a first-time player starts typing.
    await page.keyboard.press('KeyH');

    // It must dismiss the coach mark…
    await expect(page.locator('.spotlight-overlay')).toHaveCount(0);
    // …and the same keystroke must have credited XP (the spotlight never swallowed it).
    await expect.poll(() => intoLevel(page)).toBeGreaterThan(0);
    // FIRST-RUN TOUR step 2 (Andy oct14): PLAY GAMES = WINS on the Word Bomb card; typing keeps it up, a tap ends it
    await expect(page.locator('.spotlight-caption-text')).toHaveText('PLAY GAMES = WINS', { timeout: 5_000 });
    await page.waitForTimeout(800); // past its hold
    await page.keyboard.type('abc');
    await expect(page.locator('.spotlight-overlay')).toHaveCount(1);
    await page.mouse.click(5, 300);
    await expect(page.locator('.spotlight-overlay')).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(3500);
    await expect(page.locator('.spotlight-overlay')).toHaveCount(0); // once ever
  });
});

// OVERLAP AUDIT (oct29): a fresh visitor who opened GEARS during the first-run tour got TWO spotlights at once — the
// tour's step 2 ("PLAY GAMES = WINS") came up after its gap UNDER the ROLL screen, its ring framing a menu card through
// it and its caption bleeding over the ROLL highlight, stacked with the ROLL screen's own "TAP ROLL" spotlight. The
// tour now waits while a screen covers the menu: with ROLL open only ROLL's spotlight shows; the tour resumes on close.
for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`@${vp.width}x${vp.height} the tour never draws under the ROLL screen`, async ({ page }) => {
    await page.setViewportSize(vp);
    await installBackendMock(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('tour.seeded')) return;
      sessionStorage.setItem('tour.seeded', '1');
      localStorage.setItem('taw.rollsOn', '1');
      localStorage.setItem('taw.marksRevealed', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 12, into: 0 }));
      localStorage.setItem('taw.gems', JSON.stringify({ v: 1, bal: 300, peak: 12, streak: 0, mig: 1 }));
    });
    await page.goto('/?portal=1');
    await expect(page.locator('.spotlight-caption-text')).toHaveText('TYPE ANYTHING = XP', { timeout: 10_000 });
    await page.waitForTimeout(800); // past its hold
    // the click that ends step 1 is the one that opens GEARS (the spotlight lets it through)
    await page.locator('[data-nav="gears"]:visible').first().click();
    await expect(page.locator('.rs-overlay')).toBeVisible();
    await page.waitForTimeout(2600); // past the tour's 1.2s gap: step 2 would have come up by now
    await expect(page.locator('.spotlight-overlay'), 'no menu-tour spotlight under the ROLL screen').toHaveCount(0);
    await expect(page.locator('.spotlight-caption-text')).toHaveCount(0);
    expect(await page.locator('.ut-overlay').count(), 'at most ONE spotlight (ROLL\'s own)').toBeLessThanOrEqual(1);
    if (await page.locator('.ut-overlay').count()) { await page.locator('.ut-overlay').click(); await expect(page.locator('.ut-overlay')).toHaveCount(0); } // ROLL's tip ends on a tap
    await page.locator('.rs-close').click(); // ← MENU
    await expect(page.locator('.rs-overlay')).toHaveCount(0);
    await expect(page.locator('.spotlight-caption-text')).toHaveText('PLAY GAMES = WINS', { timeout: 8_000 }); // resumes on the menu
  });
}
