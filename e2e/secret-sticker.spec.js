// e2e/secret-sticker.spec.js — the MENU SECRET sticker (feat/secret-sticker).
//
// Two things only a real browser can prove: (1) typing a palindrome on the menu and then
// PAUSING (the word boundary) raises the sticker with the story — found count, the matched
// word, the wins; (2) clicking it away is SWALLOWED. The old .secret-stamp was
// pointer-events:none, so the dismiss click fell through to the card beneath and opened
// SAT RUSH. Now the click lands on the sticker/backdrop: the menu is intact, no dialog.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

// Seed LV31 (every mode unlocked, so a fallen-through click WOULD open a card — the regression
// this guards), mark the first-run spotlight seen so the coach mark never takes the opening
// keystroke, and opt out of the on-load achievement grant (same as shop.spec) so the seeded
// level can't credit surprise wins that would corrupt the +250 assertion.
async function seedMenu(page) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 31, into: 0 }));
      localStorage.setItem('taw.seenMenuSpotlight', '1');
    } catch { /* ignore */ }
  });
  // ?portal=1 skips the boot splash/intro (the app's own shipped skip path).
  await gotoMenu(page);
  await expect(page.locator('.game-card').first()).toBeVisible();
  await expect(page.locator('.secret-sticker')).toHaveCount(0);
}
const winsBanked = (page) => page.evaluate(() => Number(localStorage.getItem('taw.wins')) || 0);

test.describe('menu secret sticker', () => {
  test('typing "racecar" raises the sticker; a click dismisses it without opening a card', async ({ page }) => {
    await seedMenu(page);
    const before = await winsBanked(page);

    // Real keystrokes (trusted key events), then the ~700ms idle closes the word.
    await page.keyboard.type('racecar');
    const sticker = page.locator('.secret-sticker');
    await expect(sticker).toBeVisible();
    await expect(sticker).toContainText('SECRET FOUND · 1 / 5');
    await expect(sticker).toContainText('BOTH WAYS');
    await expect(sticker.locator('.secret-sticker-blurb b')).toHaveText('RACECAR');
    await expect(sticker).toContainText('+250 WINS');
    // the +250 was banked (on top of whatever the seed/menu had already credited)
    expect((await winsBanked(page)) - before).toBe(250);

    // Click at the viewport centre — where the sticker sits, over the mode cards. The click
    // must be eaten by the sticker/backdrop: sticker gone, cards still there, no dialog.
    const vp = page.viewportSize();
    await page.mouse.click(Math.round(vp.width / 2), Math.round(vp.height / 2));
    await expect(sticker).toHaveCount(0);
    await expect(page.locator('.secret-backdrop')).toHaveCount(0);
    await expect(page.locator('.game-card').first()).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the palindrome is judged at the word boundary — not mid-word', async ({ page }) => {
    await seedMenu(page);
    // "raceca" contains the palindrome run "aceca" — the old detector fired on it halfway
    // through RACECAR. Typed as one unbroken word (well inside the 700ms idle window) the
    // secret must wait for the boundary and report the WHOLE word. A secret fires once, so
    // the bolded detail reading exactly RACECAR (not ACECA) proves it did not fire mid-word.
    await page.keyboard.type('racecar', { delay: 30 });
    expect(await page.locator('.secret-sticker').count()).toBe(0); // no boundary yet
    const sticker = page.locator('.secret-sticker');
    await expect(sticker).toBeVisible(); // the idle closes the word
    await expect(sticker.locator('.secret-sticker-blurb b')).toHaveText('RACECAR');
  });
});
