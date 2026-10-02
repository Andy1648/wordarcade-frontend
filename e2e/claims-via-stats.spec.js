// e2e/claims-via-stats.spec.js — Andy oct2 A4: "Remove the separate star/claim icon. Claiming
// achievements happens via the STATS icon whenever it has a notification. Make notification dots
// clearly larger." Before: a yellow ★ REWARDS button led the nav; dots were 10x10, the count 22x22.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

const CLAIMS = [
  { id: 'ach-x', kind: 'ach', label: 'TEST A', amount: 100, at: 1 },
  { id: 'ach-y', kind: 'ach', label: 'TEST B', amount: 100, at: 2 },
];

async function menuWith(page, vp, claims) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript((claims) => {
    if (sessionStorage.getItem('cvs.seeded')) return;
    sessionStorage.setItem('cvs.seeded', '1');
    localStorage.clear();
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: claims.length ? 27 : 2, into: 0 }));
    localStorage.setItem('taw.wins', '5000'); // KEY POWER I affordable → a SHOP dot to measure
    localStorage.setItem('taw.claims', JSON.stringify(claims));
  }, claims);
  await page.goto('/?portal=1');
  await menuReady(page);
}

for (const vp of [{ width: 1280, height: 551 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`${vp.width}x${vp.height}: no REWARDS icon; STATS carries the count and opens the claims; dots are big`, async ({ page }) => {
    await menuWith(page, vp, CLAIMS);
    await expect(page.locator('.is-rewards')).toHaveCount(0);
    const stats = navControl(page, 'stats');
    // LV27 also queues the system reveals, so the count is >= the 2 seeded claims
    await expect(stats).toHaveAttribute('aria-label', /^Open stats — \d+ to claim$/);
    const count = stats.locator('.homepage-claim-count, .hp-m-count');
    await expect(count).toHaveText(/^\d+$/);
    const cb = await count.boundingBox();
    expect(cb.height, 'claim count height (was 22)').toBeGreaterThanOrEqual(28);
    const dot = navControl(page, 'shop').locator('.homepage-shop-dot, .hp-m-dot');
    const db = await dot.boundingBox();
    expect(db.width, 'notification dot (was 10x10)').toBeGreaterThanOrEqual(18);
    await stats.click();
    await page.locator('.claims-panel').waitFor({ state: 'visible' });
  });
}

test('with nothing to claim, STATS opens Stats and has no count', async ({ page }) => {
  await menuWith(page, { width: 1280, height: 800 }, []);
  const stats = navControl(page, 'stats');
  await expect(stats).toHaveAttribute('aria-label', 'Open stats');
  await expect(stats.locator('.homepage-claim-count')).toHaveCount(0);
  await stats.click();
  await expect(page.locator('.claims-panel')).toHaveCount(0);
});
