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
      const raw = localStorage.getItem('taw.xp');
      if (!raw) return 0;
      const v = JSON.parse(raw);
      return typeof v.into === 'number' ? v.into : 0;
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
    // The spotlight is up and nothing has been credited yet.
    await expect(page.locator('.spotlight-overlay')).toHaveCount(1);
    expect(await intoLevel(page)).toBe(0);

    // A single REAL keystroke (trusted key event), the way a first-time player starts typing.
    await page.keyboard.press('KeyH');

    // It must dismiss the coach mark…
    await expect(page.locator('.spotlight-overlay')).toHaveCount(0);
    // …and the same keystroke must have credited XP (the spotlight never swallowed it).
    await expect.poll(() => intoLevel(page)).toBeGreaterThan(0);
  });
});
