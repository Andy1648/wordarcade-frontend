// rr-moments.spec.js — Rebirth Rush moments (PROGRESSION FINAL, Andy oct3 20:08).
//   1. OVERDRIVE: a live taw.overdrive (until in the future) shows the big "OVERDRIVE ×10 · m:ss" pill in the
//      menu's existing boost slot (desktop XP row / phone top row), and it is gone once OVERDRIVE has ended.
//   2. "YOUR LEVELS BECAME +N REBIRTHS": an old save whose level passed the new gate is converted at boot
//      (econMigrate, stamp 11 → 12) and the menu names it ONCE on the level-up card; a reload never repeats it.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

async function boot(page, seed) {
  await installBackendMock(page);
  await page.addInitScript(seed);
  await page.goto('/?portal=1');
  await menuReady(page);
}

for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`OVERDRIVE: a live taw.overdrive shows the OVERDRIVE ×10 pill with its clock @ ${vp.width}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await boot(page, () => {
      if (sessionStorage.getItem('rr.seeded')) return;
      sessionStorage.setItem('rr.seeded', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.overdrive', JSON.stringify({ playMs: 0, nextMs: 30 * 60000, until: Date.now() + 4 * 60000 + 30000 }));
    });
    const pill = page.getByTestId('overdrive-pill');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('OVERDRIVE ×10');
    await expect(pill.locator('.boost-pill-clock')).toHaveText(/^[34]:\d\d$/);
    // a code BOOST is not running, so only the OVERDRIVE pill is in the slot
    await expect(page.locator('.boost-pill:not(.od-pill)')).toHaveCount(0);
  });

  test(`OVERDRIVE: an ended taw.overdrive shows no pill @ ${vp.width}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await boot(page, () => {
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.overdrive', JSON.stringify({ playMs: 0, nextMs: 30 * 60000, until: Date.now() - 1000 }));
    });
    await expect(page.getByTestId('overdrive-pill')).toHaveCount(0);
  });
}

test('+N REBIRTHS: an old LV40 save converts and the menu names it exactly once', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, () => {
    if (sessionStorage.getItem('rr.seeded')) return;
    sessionStorage.setItem('rr.seeded', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    // a pre-Rebirth-Rush save (stamp 11): LV40, no rebirths → gate 15 → +floor((40 − 15) / 18) + 1 = +2
    localStorage.setItem('taw.econ', '11');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, f: 0, rc: 0, v: 10 }));
  });
  const sub = page.locator('.menu-xp-levelup-sub');
  await expect(sub).toHaveText('YOUR LEVELS BECAME +2 REBIRTHS', { timeout: 10000 });
  await expect(page.locator('.menu-xp-levelup-title')).toHaveText('REBIRTH 2');
  await expect(page.locator('.menu-xp-levelup-detail')).toHaveText('×25 XP & WINS');
  // played → cleared, so it is a one-time moment
  await expect.poll(() => page.evaluate(() => localStorage.getItem('taw.rrnotice'))).toBeNull();

  await page.reload();
  await menuReady(page);
  // give the queue the time it took the first time; the card must not come back
  await page.waitForTimeout(4000);
  await expect(sub).not.toHaveText(/REBIRTHS/);
});
