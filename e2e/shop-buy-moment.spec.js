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
    // catch the moment IN the page as it mounts (it lives ≤ 600 ms — a poll from outside can miss it on a busy box):
    // a MutationObserver armed before the click records the stamp's face against its card, and every BOUGHT! on screen
    await page.evaluate(() => {
      window.__bought = new Promise((done) => {
        const mo = new MutationObserver(() => {
          const face = document.querySelector('.sp2-card:has([data-stock="xp25"]) .kst[aria-label="BOUGHT!"] .kst-paint img');
          if (!face) return;
          mo.disconnect();
          // measured once the 400 ms slam has landed (it starts at ×2.9), still inside the 600 ms moment
          setTimeout(() => {
            const f = face.getBoundingClientRect();
            const c = face.closest('.sp2-card').getBoundingClientRect();
            done({ inside: f.left >= c.left - 2 && f.right <= c.right + 2, w: f.width, all: document.querySelectorAll('.sp2-card .kst[aria-label="BOUGHT!"]').length });
          }, 420);
        });
        mo.observe(document.querySelector('.sp2'), { childList: true, subtree: true });
      });
    });
    await xp.click();
    const mid = await page.evaluate(() => window.__bought);
    expect(mid.w, 'the BOUGHT! stamp is drawn').toBeGreaterThan(20);
    expect(mid.inside, 'the BOUGHT! stamp sits on its card').toBe(true);
    expect(mid.all, 'only the bought card is stamped').toBe(1);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/buy-${w}-mid.png` });
    const stamp = xp.locator('.kst[aria-label="BOUGHT!"]');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.gems')).bal)).toBe(955);
    // at rest: the stamp has lifted, the card is live again with one fewer left
    await expect(stamp).toHaveCount(0, { timeout: 1500 }); // the moment is ≤ 600 ms
    await expect(xp.locator('.sp2-left')).toContainText('×4');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/buy-${w}-rest.png` });
  });
}

test('the last unit: its SOLD OUT stamp slams and stays (no BOUGHT! over it)', async ({ page }) => {
  await boot(page, 1366, 768);
  const od = card(page, 'overdrive');
  await od.click();
  await od.click(); // the 2nd of 2, mid-moment: never blocked
  await expect(od.locator('.kst[aria-label="SOLD OUT"] .kst-sold-band')).toBeVisible();
  await expect(od.locator('.kst[aria-label="BOUGHT!"]')).toHaveCount(0);
  await page.waitForTimeout(1000);
  await expect(od.locator('.kst[aria-label="SOLD OUT"] .kst-sold-band')).toBeVisible();
});
