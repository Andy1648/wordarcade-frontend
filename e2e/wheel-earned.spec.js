// e2e/wheel-earned.spec.js — EARNED SPINS (Andy nov4: "dont have daily spin for free (people say its not fun bc its too
// free and should be functionality)"; 081_wheel_earned.sql). Today's spin unlocks after 15 GAME words since the last one:
//   1. not yet earned: the wheel opens LOCKED — a words bar ("6 / 15 GAME WORDS"; hidden on a short phone), PLAY (its line: "N MORE WORDS TO SPIN") back to the menu; no SPIN, the
//      hub disabled; the menu's wheel dot is gone once the need is known (honest dots: no dot until it pays).
//   2. earned: SPIN, it lands and pays as before.
//   3. the server refuses (its row lagged and never caught up): the wheel goes back to LOCKED, nothing paid.
// SHOTS=<dir> saves the locked state at 1366 / 390.
import { test, expect } from '@playwright/test';
import { boot } from './support/wheelBoot.js';

const SHOTS = process.env.SHOTS;

for (const [w, h] of [[1366, 768], [1920, 1080], [390, 844], [360, 640]]) {
  test(`${w}x${h}: not earned — LOCKED with the words bar, PLAY, no SPIN; the menu dot goes once the need is known`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const db = await boot(page, { gems: 200, slot: 2, streak: 2, earn: { words: 400, need: 409 } });
    await page.locator('[data-nav="wheel"]:visible').first().click();
    const wheel = page.getByTestId('daily-wheel');
    const locked = wheel.getByTestId('wheel-locked');
    await expect(locked).toBeVisible();
    await expect(locked).toContainText('9 MORE WORDS TO SPIN');
    await expect(wheel.getByTestId('wheel-spin')).toHaveCount(0);
    await expect(wheel.locator('.dw-hub')).toBeDisabled();
    await expect(wheel.locator('[data-state="today"]')).toHaveCount(1); // the streak row still shows today's step
    // the foot fits: bar + words + PLAY inside the panel, apart from each other, PLAY a real tap target
    const m = await page.evaluate(() => {
      const b = (s) => document.querySelector(s).getBoundingClientRect();
      const panel = b('.dw'); const bar = b('.dw-earn-bar'); const t = b('.dw-earn-t'); const play = b('[data-testid="wheel-play"]');
      const shown = bar.width > 0; // a short phone hides the bar: PLAY's line carries the count
      const inside = [...(shown ? [bar, t] : []), play].every((r) => r.left >= panel.left - 1 && r.right <= panel.right + 1 && r.bottom <= panel.bottom + 1);
      return { inside, apart: !shown || (t.left >= bar.left - 1 && t.right <= bar.right + 1 && bar.bottom <= play.top + 1), playH: play.height, fs: shown ? parseFloat(getComputedStyle(document.querySelector('.dw-earn-t')).fontSize) : 16 };
    });
    expect(m.inside, 'the locked foot inside the panel').toBe(true);
    expect(m.apart, 'the words inside their bar, PLAY under it').toBe(true);
    expect(m.playH).toBeGreaterThanOrEqual(44);
    expect(m.fs).toBeGreaterThanOrEqual(16);
    if (SHOTS) { await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth), null, { timeout: 6000 }).catch(() => {}); await page.screenshot({ path: `${SHOTS}/locked-${w}x${h}.png` }); }
    // PLAY closes the wheel back to the menu, where the tile wears no dot now (the need is known, the words aren't there)
    await wheel.getByTestId('wheel-play').click();
    await expect(wheel).toHaveCount(0);
    await expect(page.locator('[data-nav="wheel"] .kb-idot')).toHaveCount(0);
    expect(db.calls.spin).toBe(0);
  });
}

test('earned: SPIN lands and pays as before', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const db = await boot(page, { gems: 200, slot: 2, earn: { words: 420, need: 415 } });
  await page.locator('[data-nav="wheel"]:visible').first().click();
  const wheel = page.getByTestId('daily-wheel');
  await expect(wheel.getByTestId('wheel-locked')).toHaveCount(0);
  await wheel.getByTestId('wheel-spin').click();
  await expect(wheel.getByTestId('wheel-result')).toContainText('+60 GEMS', { timeout: 12000 });
  expect(db.calls.spin).toBe(1);
});

test('the server refuses (its count never caught up): back to LOCKED, nothing paid', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  // the state says earned (this browser's words are in), the spin says not yet — even after the forced submit
  const db = await boot(page, { gems: 200, slot: 2, earn: { words: 420, need: 415 } });
  await page.locator('[data-nav="wheel"]:visible').first().click();
  const wheel = page.getByTestId('daily-wheel');
  await expect(wheel.getByTestId('wheel-spin')).toBeVisible();
  db.earn.words = 410; // the row went backwards (a reset elsewhere): the server is the judge
  await wheel.getByTestId('wheel-spin').click();
  await expect(wheel.getByTestId('wheel-locked')).toBeVisible({ timeout: 8000 });
  await expect(wheel.getByTestId('wheel-locked')).toContainText('5 MORE WORDS TO SPIN');
  await expect(wheel.getByTestId('wheel-result')).toHaveCount(0);
  expect(db.calls.spin).toBe(2); // asked again once after pushing this browser's words
});
