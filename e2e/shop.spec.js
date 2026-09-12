// e2e/shop.spec.js — the SHOP and REBIRTH overlays, now reached by TWO separate top-corner
// icons (no in-panel tabs). SHOP: locked items visible-but-dimmed, buying deducts wins (not
// winsLifetime) and enables equip. REBIRTH: its own icon opens straight into the rebirth view,
// gated on level, and (when eligible) zeroes xp while preserving wins + purchases.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function openVia(page, seed, selector) {
  await installBackendMock(page);
  // Opt out of the on-load achievement grant so a seeded wins/level state isn't inflated by
  // checkAchievements crediting achievement wins on mount (would corrupt the exact-wins assertions).
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  await page.addInitScript((s) => {
    try {
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  }, seed);
  await page.goto('/?portal=1');
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
  await page.locator(selector).click();
  await page.locator('.shop-panel').waitFor({ state: 'visible' });
}
const openShop = (page, seed) => openVia(page, seed, '.homepage-nav-btn.is-shop');
const openRebirth = (page, seed) => openVia(page, seed, '.homepage-nav-btn.is-rebirth');

test.describe('shop', () => {
  test('SHOP icon: no tabs; locked items visible+dimmed; buying deducts wins only and enables equip', async ({ page }) => {
    // ECONOMY v7: the cosmetic prices are an exponential x5 ladder (CHROME 600, INFERNO 3000,
    // VOID 15000, PRISM 75000) rather than v6's near-linear 150/400/900/2000, which the raised
    // per-word base would have cleared inside the first hour. The purse is seeded off the catalog
    // so the ladder can be retuned without editing this spec again.
    await openShop(page, { 'taw.wins': '950', 'taw.winsLifetime': '900', 'taw.xp': '0' });

    // The tabs are gone (two icons, two destinations) and the shop view shows no rebirth action.
    await expect(page.locator('.shop-tab')).toHaveCount(0);
    await expect(page.locator('.shop-rebirth')).toHaveCount(0);
    await expect(page.locator('.shop-title')).toHaveText('SHOP');

    // All catalog cards render; unaffordable ones are visible-but-dimmed (not hidden).
    // 16 cards = 5 POP STYLES + 6 SOUND PACKS (the original 11 cosmetics) + 5 THEMES
    // (default/midnight/inferno/toxic/prism — themes render as .shop-card too via .shop-theme-card;
    // feat/themes added them). KEY POWER + WORD SENSE are upgrade TRACKS, not .shop-card, so not counted.
    await expect(page.locator('.shop-card')).toHaveCount(16);
    expect(await page.locator('.shop-card.is-locked').count()).toBeGreaterThan(0);

    const chrome = page.locator('.shop-card', { hasText: 'CHROME' });
    // BUY (600) — a plain click (fix/shop-click-buy replaced the unlabelled hold-to-buy gate).
    await chrome.locator('.shop-buy').click();
    await expect(page.evaluate(() => Number(localStorage.getItem('taw.wins')))).resolves.toBe(350);
    expect(await page.evaluate(() => Number(localStorage.getItem('taw.winsLifetime')))).toBe(900); // untouched
    // feat/shop-reveal-sticker: the purchase reveal is a MODAL sticker (its backdrop swallows
    // clicks), so dismiss it before touching the card underneath.
    await page.locator('.sticker').click();
    await expect(page.locator('.sticker')).toHaveCount(0);
    await chrome.locator('.shop-card-btn').click(); // now EQUIP (owned → a plain click button again)
    await expect(chrome.locator('.shop-card-tag')).toHaveText('EQUIPPED');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('taw.equipped')).popStyle)).toBe('chrome');
  });

  test('REBIRTH icon: hidden for a brand-new level-1 player (nothing to reset)', async ({ page }) => {
    // fix/firstrun #1: a prestige-RESET mechanic is noise to a fresh account. With no wins ever
    // earned, no rebirths, and level 1, the top-nav REBIRTH icon is not rendered at all.
    await installBackendMock(page);
    await page.goto('/?portal=1');
    await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
    await expect(page.locator('.homepage-nav-btn.is-rebirth')).toHaveCount(0);
  });

  test('REBIRTH icon: reappears once wins are earned; opens the view, disabled at level 1', async ({ page }) => {
    // Any lifetime wins (or reaching the first rebirth level) brings the icon back. Opening it
    // lands straight on the rebirth view, still disabled at level 1 (below the first gate).
    await openRebirth(page, { 'taw.wins': '400', 'taw.winsLifetime': '400', 'taw.xp': '0' });
    await expect(page.locator('.shop-title')).toHaveText('REBIRTH');
    await expect(page.locator('.shop-tab')).toHaveCount(0);
    await expect(page.locator('.shop-rebirth')).toBeDisabled(); // level 1 → not eligible
  });

  test('REBIRTH icon: eligible past the gate — confirms, zeroes xp, keeps wins + purchases', async ({ page }) => {
    // ECONOMY v7: the level curve starts at a base of 2000 rather than 100, so the old 60,000
    // cumulative-XP seed lands well BELOW the LV15 rebirth gate it used to clear. Seeded through
    // the v5 {lv, into} shape instead of a cumulative total - it says what it means ("this player
    // is level 15") and cannot be invalidated by another curve retune.
    await openRebirth(page, { 'taw.xp': JSON.stringify({ lv: 15, into: 0 }), 'taw.wins': '400', 'taw.owned': JSON.stringify(['classic', 'thock', 'clack', 'cream', 'inferno']) });
    const rebirth = page.locator('.shop-rebirth');
    await expect(rebirth).toBeEnabled(); // past the level gate → eligible

    const detail = page.locator('.shop-confirm-detail');
    await expect(detail).toContainText('LOSE');
    await expect(detail).toContainText('KEEP');
    await expect(detail).toContainText('GAIN');

    await rebirth.click(); // arm the confirmation
    await page.locator('.shop-confirm-actions .shop-card-btn.danger').click(); // CONFIRM
    await page.locator('.menu-xp-bar').waitFor({ state: 'visible' }); // returned to menu

    const after = await page.evaluate(() => {
      let xp = {};
      try {
        xp = JSON.parse(localStorage.getItem('taw.xp') || '{}') || {};
      } catch {
        xp = {};
      }
      return {
        lv: xp.lv,
        into: xp.into,
        rebirths: Number(localStorage.getItem('taw.rebirths')),
        wins: Number(localStorage.getItem('taw.wins')),
        keepsInferno: JSON.parse(localStorage.getItem('taw.owned') || '[]').includes('inferno'),
        celeb: document.querySelector('.menu-xp-levelup-title')?.textContent,
      };
    });
    expect(after.lv).toBe(1);
    expect(after.into).toBe(0);
    expect(after.rebirths).toBe(1);
    expect(after.wins).toBe(400);
    expect(after.keepsInferno).toBe(true);
    expect(after.celeb).toBe('REBIRTH 1');
  });
});
