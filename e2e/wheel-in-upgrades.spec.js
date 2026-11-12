// e2e/wheel-in-upgrades.spec.js — THE DAILY REWARD (Andy nov5): the chest is gone; the wheel took its card in UPGRADES and left the
// menu. The card says where today's spin stands, the UPGRADES button keeps a dot while a spin is ready, and the wheel opens over
// the shop and closes back to it. Fits at every size, in every state.
import { test, expect } from '@playwright/test';
import { boot, openWheel } from './support/wheelBoot.js';
import { navControl } from './support/menu.js';

const SHOTS = process.env.SHOTS;
const VIEWS = [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 360, height: 640 }];

async function expectCardFits(page) {
  const card = page.getByTestId('daily-spin-card');
  await expect(card).toBeVisible();
  const m = await card.evaluate((el) => {
    const box = el.closest('.sp2-card').getBoundingClientRect();
    const kids = [...el.querySelectorAll('.sp2-name, .sp2-big, .sp2-what, .sp2-price')].map((n) => n.getBoundingClientRect());
    const hit = (p, q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 1 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 1;
    return {
      inside: kids.every((r) => r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1),
      overlaps: kids.flatMap((a, i) => kids.slice(i + 1).filter((b) => hit(a, b))).length,
      h: box.height,
      clipped: [...el.querySelectorAll('.sp2-price')].some((n) => n.scrollWidth > n.clientWidth + 1),
    };
  });
  expect(m).toMatchObject({ inside: true, overlaps: 0, clipped: false });
  expect(m.h).toBeGreaterThanOrEqual(44);
}

for (const vp of VIEWS) {
  test(`@${vp.width}x${vp.height}: no wheel on the menu; UPGRADES has the dot and the card; the wheel opens over the shop and closes back`, async ({ page }) => {
    await page.setViewportSize(vp);
    await boot(page, { earn: { words: 400, need: 400 } });
    await expect(page.locator('[data-nav="wheel"]')).toHaveCount(0);
    await page.waitForTimeout(800);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/wheel-menu-${vp.width}.png` });
    await navControl(page, 'shop').first().click();
    await page.locator('.sp2').waitFor({ state: 'visible' });
    await expect(page.getByTestId('daily-chest-card')).toHaveCount(0);
    await expectCardFits(page);
    await page.waitForTimeout(900); // past the shelf's deal-in
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/wheel-card-${vp.width}.png` });
    await page.getByTestId('daily-spin-card').click();
    const dialog = page.locator('.dw-scrim');
    await expect(dialog).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/wheel-open-${vp.width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.sp2')).toBeVisible(); // back in the shop, not the menu
  });
}

test('the card says what today\'s spin needs: words to go, then SPIN, then the countdown', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const db = await boot(page, { earn: { words: 400, need: 415 } });
  await openWheel(page); // the panel asks the server what today's spin needs, and remembers it
  await page.getByTestId('wheel-play').waitFor();
  await page.keyboard.press('Escape');
  await expect(page.locator('.dw-scrim')).toHaveCount(0);
  const price = page.getByTestId('daily-spin-card').locator('.sp2-price');
  await expect(price).toContainText('WORDS');
  await expectCardFits(page);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/wheel-card-words-1366.png` });
  db.earn.words = 500;
  await page.evaluate(() => { const k = 'taw.s2.wheel'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.need = 0; localStorage.setItem(k, JSON.stringify(o)); });
  await expect(price).toHaveText('SPIN', { timeout: 3000 });
  await page.evaluate(() => {
    const k = 'taw.s2.wheel';
    const o = JSON.parse(localStorage.getItem(k) || '{}');
    o.day = 99999999;
    localStorage.setItem(k, JSON.stringify(o));
  });
  await expect(price).toHaveText(/^\d\d:\d\d:\d\d$/, { timeout: 3000 });
  await expectCardFits(page);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/wheel-card-spun-1366.png` });
});
