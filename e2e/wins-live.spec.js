// e2e/wins-live.spec.js — W (Andy oct2 22:28, BUG): "Claiming a reward from the STATS menu doesn't update
// the WINS counter on the main menu until you open the shop and come back." The chip snapshotted the
// balance on mount; nothing on the menu heard a claim. Now every saveWins tells useWinsBalance.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

const CLAIMS = [
  { id: 'ach-x', kind: 'achievement', label: 'TEST A', amount: 100, at: 1 },
  { id: 'ach-y', kind: 'achievement', label: 'TEST B', amount: 250, at: 2 },
];

// (the phone menu has no wins figure — the chip is desktop-only)
for (const vp of [{ width: 1280, height: 551 }, { width: 1366, height: 625 }]) {
  test(`${vp.width}x${vp.height}: claim from STATS → the menu wins chip shows the new total without navigating`, async ({ page }) => {
    await page.setViewportSize(vp);
    await installBackendMock(page);
    await page.addInitScript((claims) => {
      if (sessionStorage.getItem('wl.seeded')) return;
      sessionStorage.setItem('wl.seeded', '1');
      localStorage.clear();
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 27, into: 0 }));
      localStorage.setItem('taw.wins', '5000');
      localStorage.setItem('taw.claims', JSON.stringify(claims));
    }, CLAIMS);
    await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
    await page.goto('/?portal=1');
    await menuReady(page);
    const chip = page.locator('.menu-wins-chip:visible').first();
    await expect(chip).toHaveAttribute('data-wins', '5000'); // exact (the label is formatNum'd: "5,000 wins")
    await navControl(page, 'stats').click();
    await page.locator('.claims-panel').waitFor({ state: 'visible' });
    const before = await page.evaluate(() => Number(localStorage.getItem('taw.wins')));
    await page.locator('.claims-all').click();
    await expect.poll(() => page.evaluate(() => Number(localStorage.getItem('taw.wins')))).toBeGreaterThan(before);
    const after = await page.evaluate(() => Number(localStorage.getItem('taw.wins')));
    await page.locator('.claims-close').click();
    await expect(page.locator('.claims-panel')).toHaveCount(0);
    // no shop round-trip, no reload: the chip already says the new total
    await expect(chip).toHaveAttribute('data-wins', String(after));
  });
}
