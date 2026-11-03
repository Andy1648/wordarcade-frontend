// e2e/wheel-gem-fly.spec.js — DESIGN RESEARCH MOVE 10 on the DAILY WHEEL: a gem prize is paid at once (the save) but the
// menu's GEMS pill holds it while the wheel's scrim covers it; closing the wheel flies the painted gems (pooled
// KitFlyLayer) from the WHEEL tile into the pill, which counts each one in. Real motion.
import { test, expect } from '@playwright/test';
import { boot } from './support/wheelBoot.js';

test.use({ reducedMotion: 'no-preference' });
test.describe.configure({ timeout: 60_000 });
const SHOTS = process.env.SHARD_SHOTS || '';
const gemBal = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0);

for (const [w, h] of [[1366, 768], [390, 844]]) {
  test(`${w}x${h}: closing the wheel flies its +60 gems into the GEMS pill, which counts them in`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page, { gems: 200, slot: 2 });
    const pill = page.locator('.menu-gems-chip:visible').first();
    await expect(pill).toContainText('200');
    await page.locator('[data-nav="wheel"]:visible').first().click();
    const wheel = page.getByTestId('daily-wheel');
    await wheel.getByTestId('wheel-spin').click();
    await expect(wheel.getByTestId('wheel-result')).toContainText('+60 GEMS', { timeout: 15_000 });
    expect(await gemBal(page)).toBe(260); // paid at once
    await expect(pill).toContainText('200'); // …but the pill under the scrim holds it
    await page.waitForTimeout(1600); // the landing has settled
    await page.locator('.dw-close').click();
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.kfl-s')].filter((n) => n.getAnimations().some((a) => a.playState === 'running')).length), { timeout: 3000, intervals: [30] }).toBeGreaterThan(0);
    if (SHOTS) { await page.waitForTimeout(420); await page.screenshot({ path: `${SHOTS}/wheelfly-${w}.png` }); }
    await expect(pill).toContainText('260', { timeout: 4000 });
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest('.kfl')).length)).toBe(0);
  });
}
