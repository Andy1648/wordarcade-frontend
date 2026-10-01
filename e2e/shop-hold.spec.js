// e2e/shop-hold.spec.js — STEP 21 (Andy A3, A4, A5, A12).
//   A5  no mashing: a TAP buys one; HOLDING keeps buying (accelerating) and plays ONE reveal for the
//       run; BUY MAX buys everything affordable in one press.
//   A4  STATS and SHOP swapped places in both menu trees.
//   A12 every theme card shows a miniature of the menu in its palette, not a swatch strip.
//   A3  marks are drawn badges with a RANK, a "next rank" line and a words-worn bar.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

async function boot(page, seed = {}) {
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  await page.addInitScript((s) => {
    try {
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    } catch { /* blocked */ }
  }, seed);
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.waitForTimeout(300);
}
async function openShop(page) {
  await page.locator('.homepage-nav-btn.is-shop').click();
  await page.locator('.shop-panel').waitFor({ state: 'visible' });
}
const keyTier = (page) => page.evaluate(() => Number(localStorage.getItem('taw.keytier') || 0));
const wins = (page) => page.evaluate(() => Number(localStorage.getItem('taw.wins') || 0));

test('KEY POWER: a tap buys exactly one', async ({ page }) => {
  await boot(page, { 'taw.wins': '999999999', 'taw.keytier': '0' });
  await openShop(page);
  await page.locator('.shop-keypower').first().locator('.shop-buy').click();
  await expect(page.locator('.sticker')).toBeVisible();
  expect(await keyTier(page)).toBe(1);
});

test('KEY POWER: holding keeps buying, accelerating, and reveals ONCE for the run', async ({ page }) => {
  await boot(page, { 'taw.wins': '999999999', 'taw.keytier': '0' });
  await openShop(page);
  const btn = page.locator('.shop-keypower').first().locator('.shop-buy');
  await expect(btn).toContainText('HOLD');
  const box = await btn.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1600);
  await page.mouse.up();
  const t = await keyTier(page);
  // 1 on press + repeats at 420, 660, 847, 993… ms — at least 5 in 1.6 s, and it must accelerate.
  expect(t, 'a 1.6 s hold buys several tiers').toBeGreaterThanOrEqual(5);
  await expect(page.locator('.sticker')).toHaveCount(1);
  await expect(page.locator('.sticker-name')).toContainText(`(+${t})`);
});

test('KEY POWER: BUY MAX spends down to below the next tier', async ({ page }) => {
  await boot(page, { 'taw.wins': '5000', 'taw.keytier': '0' });
  await openShop(page);
  const kp = page.locator('.shop-keypower').first();
  await kp.locator('.shop-buymax').click();
  const t = await keyTier(page);
  expect(t).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.sticker')).toHaveCount(1);
  // Whatever is left can't buy the next tier: no BUY MAX, no buy button.
  await page.locator('.sticker').click();
  await expect(kp.locator('.shop-buymax')).toHaveCount(0);
  expect(await wins(page)).toBeGreaterThanOrEqual(0);
});

test('STATS sits before SHOP in both menu trees (A4)', async ({ page }) => {
  await boot(page);
  const order = async () => page.evaluate(() => [...document.querySelectorAll('.homepage-nav-btn, .hp-m-navbtn')]
    .map((b) => (b.className.match(/is-(shop|stats|rebirth|board)/) || [])[1]).filter(Boolean));
  let o = await order();
  expect(o.indexOf('stats')).toBeLessThan(o.indexOf('shop'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  o = await order();
  expect(o.indexOf('stats')).toBeLessThan(o.indexOf('shop'));
});

test('every theme card shows a miniature menu in its own palette (A12)', async ({ page }) => {
  await boot(page, { 'taw.wins': '100' });
  await openShop(page);
  const previews = page.locator('.shop-theme-card .shop-theme-preview');
  const n = await page.locator('.shop-theme-card').count();
  expect(n).toBeGreaterThanOrEqual(5);
  await expect(previews).toHaveCount(n);
  const fills = await previews.evaluateAll((els) => els.map((e) => e.querySelector('rect').getAttribute('fill')));
  expect(new Set(fills).size, 'each preview is painted in a different background').toBe(n);
  const box = await previews.first().boundingBox();
  expect(box.width, 'big enough to read as a menu').toBeGreaterThanOrEqual(150);
});

test('marks: drawn badge, rank, next-rank line and words-worn bar (A3)', async ({ page }) => {
  await boot(page, {
    'taw.achievements': JSON.stringify(['m-wb-5', 'm-blitz-5']),
    'taw.mark': 'mk-bomber',
    'taw.markWords': JSON.stringify({ 'mk-bomber': 320 }),
  });
  const slot = page.locator('.menu-mark').first();
  await expect(slot.locator('svg.mark-badge')).toBeVisible();
  await slot.click();
  const card = page.locator('.mark-card.is-on');
  await expect(card.locator('svg.mark-badge')).toBeVisible();
  await expect(card.locator('.mark-rank')).toHaveText('RANK II');
  await expect(card.locator('.mark-blurb')).toHaveText('+29% wins in WORD BOMB.');
  await expect(card.locator('.mark-next')).toHaveText('RANK III: +32% wins in WORD BOMB.');
  await expect(card.locator('.mark-words')).toHaveText('170 / 350 WORDS WORN');
  // no emoji left in the picker
  const text = await page.locator('.marks-card').innerText();
  expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
});
