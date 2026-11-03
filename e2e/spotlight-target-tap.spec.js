// e2e/spotlight-target-tap.spec.js — a spotlight tip never eats the tap on the very thing it lights (nov3). The menu's
// "YOUR FIRST GEAR ROLL IS READY." tip lit the GEARS tile but swallowed the first tap on it (the whole screen was the
// tip's tap-anywhere layer), so a new player tapped GEARS twice — and marks.spec E4 timed out clicking GEARS under it.
// Now: a tap ON the lit target opens it AND ends the tip in one; a tap anywhere else still just ends the tip.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function boot(page, vp) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  // a LV12 player with a gear roll ready and the menu's first-run tips seen: the GEARS tip is due
  await page.addInitScript(() => {
    if (sessionStorage.getItem('st.seeded')) return;
    sessionStorage.setItem('st.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 12, into: 0 }));
    localStorage.setItem('taw.achievements', JSON.stringify(['m-sat-5']));
    localStorage.setItem('taw.marksOwned', '[]');
    localStorage.setItem('taw.tut.markRolls', '1');
  });
  await page.goto('/?portal=1');
  const tip = page.locator('.ut-overlay[data-tut="gears"]');
  await expect(tip).toBeVisible({ timeout: 20_000 });
  return tip;
}

for (const [vn, vp] of [['1366', { width: 1366, height: 768 }], ['390', { width: 390, height: 844 }]]) {
  test(`@${vn} tapping the lit GEARS tile opens GEARS and ends the tip, in one tap`, async ({ page }) => {
    const tip = await boot(page, vp);
    await page.locator('[data-nav="gears"]:visible').first().click({ timeout: 5000 }); // no force: nothing may cover it
    await expect(tip).toHaveCount(0);
    await expect(page.locator('[data-testid="roll-index"]')).toBeVisible({ timeout: 10_000 });
  });

  test(`@${vn} tapping anywhere else just ends the tip`, async ({ page }) => {
    const tip = await boot(page, vp);
    await page.mouse.click(8, Math.round(vp.height / 2));
    await expect(tip).toHaveCount(0);
    await expect(page.locator('[data-testid="roll-index"]')).toHaveCount(0);
  });
}
