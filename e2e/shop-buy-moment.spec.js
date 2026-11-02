// e2e/shop-buy-moment.spec.js — THE PURCHASE MOMENT (nov2 design audit #7: "hold-to-buy just changes a number"). A boost buy
// slams a BOUGHT! stamp onto its card mid-moment, the gems pill counts the price off, and at rest the stamp has lifted and
// the card is back (×N LEFT one less); the last unit's buy leaves the SOLD OUT stamp instead. POWER: every buy flashes the
// plate. Sampled mid-flight and at rest, at 1366 and 390. SHOTS=<dir> saves the frames.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { navControl } from './support/menu.js';

const SHOTS = process.env.SHOTS;
// a fixed hour whose DEAL is WINS (v3/stock.js dealOf): XP is at its shelf price 45
const T = 1796085000000;

async function boot(page, w, h) {
  await page.clock.setFixedTime(T);
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('bm.seeded')) return;
    sessionStorage.setItem('bm.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 1, v: 10 }));
    localStorage.setItem('taw.s2.wins', '5000');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 1000, mig: 1 }));
  });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'shop').click();
  await page.locator('.sp2').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
}
const card = (page, id) => page.locator(`.sp2-card:has([data-stock="${id}"])`);

for (const [w, h] of [[1366, 768], [390, 844]]) {
  test(`${w}x${h}: a boost buy stamps BOUGHT! mid-moment, counts the gems off, and settles back`, async ({ page }) => {
    await boot(page, w, h);
    const xp = card(page, 'xp25');
    await xp.scrollIntoViewIfNeeded();
    await xp.click();
    // mid-moment: the stamp is up on THIS card, its face inside the card
    const stamp = xp.locator('.kst[aria-label="BOUGHT!"]');
    await expect(stamp).toBeVisible();
    if (SHOTS) { await page.waitForTimeout(150); await page.screenshot({ path: `${SHOTS}/buy-${w}-mid.png` }); }
    const inside = await xp.evaluate((c) => { const k = c.querySelector('.kst-center').getBoundingClientRect(); const f = c.getBoundingClientRect(); return k.left >= f.left - 2 && k.right <= f.right + 2; });
    expect(inside, 'the BOUGHT! stamp sits on its card').toBe(true);
    await expect(page.locator('.sp2-card .kst[aria-label="BOUGHT!"]')).toHaveCount(1); // only the bought card
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.gems')).bal)).toBe(955);
    // at rest: the stamp has lifted, the card is live again with one fewer left
    await expect(stamp).toHaveCount(0, { timeout: 3000 });
    await expect(xp.locator('.sp2-left')).toContainText('×4');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/buy-${w}-rest.png` });
  });
}

test('the last unit: its SOLD OUT stamp slams and stays (no BOUGHT! over it)', async ({ page }) => {
  await boot(page, 1366, 768);
  const od = card(page, 'overdrive');
  await od.click();
  await expect(od.locator('.kst[aria-label="BOUGHT!"]')).toHaveCount(0, { timeout: 3000 });
  await od.click(); // the 2nd of 2
  await expect(od.locator('.kst[aria-label="SOLD OUT"]')).toBeVisible();
  await expect(od.locator('.kst[aria-label="BOUGHT!"]')).toHaveCount(0);
  await page.waitForTimeout(1600);
  await expect(od.locator('.kst[aria-label="SOLD OUT"]')).toBeVisible();
});
