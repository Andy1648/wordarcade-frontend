// e2e/shop-tab-dots.spec.js — Andy oct28: "add notification dot not just on menu screen for shop but inside as well (boost,
// looks)". The shelf tabs carry the NEW dot (v3/shopDots.js), from the same reads as the menu's UPGRADES dot: an unseen
// hourly restock with something payable (BOOSTS), a newly affordable look (LOOKS). Opening a shelf marks it seen, and the
// menu dot goes out with it. Seeded: 100 gems (CHROME 75, an XP BOOST 45), 0 wins (POWER out of reach), today's chest claimed.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl, navDot } from './support/menu.js';

async function boot(page, gems) {
  await installBackendMock(page);
  await page.addInitScript((gems) => {
    if (sessionStorage.getItem('sd.seeded')) return;
    sessionStorage.setItem('sd.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 0, v: 10 }));
    localStorage.setItem('taw.s2.wins', '0');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: gems, mig: 1 }));
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('taw.s2.drop', JSON.stringify({ day, claimed: true, tier: 'rare' }));
  }, gems);
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
}
const tabDot = (page, k) => page.getByTestId(`shop-tab-dot-${k}`);

for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`@${vp.width}: a new restock + an affordable look light UPGRADES; COSMETICS carries its own dot until its looks are seen`, async ({ page }) => {
    await page.setViewportSize(vp);
    await boot(page, 100);
    await expect(navDot(page, 'shop')).toHaveCount(1);
    await navControl(page, 'shop').click();
    await page.locator('.sp2').waitFor({ state: 'visible' });
    await expect(tabDot(page, 'cosmetics')).toBeVisible();
    await expect(tabDot(page, 'boosts')).toHaveCount(0); // the shelf you're on is seen
    // oct28: COSMETICS opens the profile's CUSTOMIZE menu on POP STYLE — showing the looks marks them seen
    await page.locator('.sp2-tab[data-shelf="cosmetics"]').click();
    await page.getByTestId('customize').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.getByTestId('profile-popup').waitFor({ state: 'detached' });
    await expect(page.locator('.sp2')).toBeVisible(); // Escape closed CUSTOMIZE, not the shop
    await expect(tabDot(page, 'cosmetics')).toHaveCount(0); // seen stays seen
    await page.reload();
    await menuReady(page);
    await expect(navDot(page, 'shop')).toHaveCount(0); // both shelves seen: the menu dot is out too
  });
}

test('nothing affordable, chest claimed: no dot on the menu or any shelf tab', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page, 0);
  await expect(navDot(page, 'shop')).toHaveCount(0);
  await navControl(page, 'shop').click();
  await page.locator('.sp2').waitFor({ state: 'visible' });
  await expect(page.locator('.sp2-tab-dot')).toHaveCount(0);
});
