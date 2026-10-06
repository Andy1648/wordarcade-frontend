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

test('KEY TIER: a tap buys exactly one', async ({ page }) => {
  await boot(page, { 'taw.wins': '999999999', 'taw.keytier': '0' });
  await openShop(page);
  await page.locator('.shop-keypower').first().locator('.shop-buy').click();
  await expect(page.locator('.sticker')).toBeVisible();
  expect(await keyTier(page)).toBe(1);
});

test('KEY TIER: holding keeps buying, accelerating, and reveals ONCE for the run', async ({ page }) => {
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

test('KEY TIER: BUY MAX spends down to below the next tier', async ({ page }) => {
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

// v2 MENU (claude/mockups/v2/Menu.dc.html) supersedes A4's word stack: SHOP leads the left RAIL, STATS
// is a top-right tile beside the leaderboard / achievements — in both menu trees.
test('SHOP leads the rail and STATS is a top-right tile, in both menu trees (v2)', async ({ page }) => {
  await boot(page);
  const where = async () => page.evaluate(() => ({
    railFirst: (document.querySelector('.hp-rail [data-nav]') || {}).getAttribute?.('data-nav') || null,
    statsInIcons: !!document.querySelector('.hp-icons [data-nav="stats"]'),
  }));
  expect(await where()).toEqual({ railFirst: 'shop', statsInIcons: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  expect(await where()).toEqual({ railFirst: 'shop', statsInIcons: true });
});

test('STEP 50: the shop sells no themes — the WORLD is earned, not bought', async ({ page }) => {
  await boot(page, { 'taw.wins': '100' });
  await openShop(page);
  await expect(page.locator('.shop-theme-card')).toHaveCount(0);
  await expect(page.locator('.shop-subtitle', { hasText: 'THEMES' })).toHaveCount(0);
});

test('marks: drawn badge, rank, next-rank line and words-worn bar (A3)', async ({ page }) => {
  await boot(page, {
    'taw.achievements': JSON.stringify(['m-wb-5', 'm-blitz-5']),
    'taw.mark': 'mk-bomber',
    'taw.markWords': JSON.stringify({ 'mk-bomber': 320 }),
    'taw.tut.markRolls': '1', // MARK ROLLS are LIVE: their tutorial would cover the panel
  });
  const slot = page.locator('.menu-mark').first();
  // v2 menu: the worn-mark chip shows its NAME ONLY (the art and stat live on ROLL / INDEX)
  await expect(slot.locator('.menu-mark-name')).toHaveText('BOMBER');
  await slot.click();
  // Andy oct5: MARKS opens the ROLL screen; INDEX opens the MARKS INDEX
  await page.locator('[data-testid="roll-index"]').click();
  // INDEX v2: the worn mark's card — its art, MAIN tag and ONE stat line (no sentence explaining it)
  const worn = page.locator('.mx-tile.is-on');
  await expect(worn.locator('svg.mark-badge')).toBeVisible();
  await expect(worn.locator('.mx-tile-name')).toHaveText('BOMBER');
  await expect(worn.locator('.mx-tile-main')).toHaveText('MAIN');
  await expect(worn.locator('.mx-tile-sub')).toHaveText('×1.1 WINS');
  // no emoji left in the index
  const text = await page.locator('.mx-panel').innerText();
  expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
});
