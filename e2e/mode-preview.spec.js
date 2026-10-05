// e2e/mode-preview.spec.js — item 2 (real worked examples in the mode dialogs) and item 4
// (the CHAIN / FUSE level gates, plus the play-based bypass).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, modeEntry } from './support/menu.js';

async function menu(page, level) {
  await installBackendMock(page);
  if (level != null) {
    await page.addInitScript((lv) => {
      try { localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 })); } catch { /* ignore */ }
    }, level);
  }
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.waitForTimeout(400);
}
// THE MODE ENTRY POINT, at either width — the desktop card or the phone row. Both call the
// same Homepage handler, so only the object you press differs (support/menu.js).
const card = (page, id) => modeEntry(page, id);

test.describe('item 2 — worked examples', () => {
  test('WORD BOMB dialog shows TRA → TRAIN, wins rate, and round length', async ({ page }) => {
    await menu(page);
    await card(page, 'word-bomb').click();
    const ex = page.locator('.mode-dialog-shell .mode-ex');
    await expect(ex).toBeVisible();
    await expect(ex).toContainText('TRAIN');
    await expect(ex.locator('.mode-ex-pay')).toContainText('WINS / WORD');
    await expect(ex.locator('.mode-ex-round')).toContainText('TURN-BASED');
  });

  test('CHAIN dialog shows the E → EAGLE → ELEPHANT → TIGER chain', async ({ page }) => {
    await menu(page, 60); // past the LV50 gate → unlocked
    await card(page, 'chain').click();
    const ex = page.locator('.mode-dialog-shell .mode-ex');
    await expect(ex).toBeVisible();
    for (const w of ['EAGLE', 'ELEPHANT', 'TIGER']) await expect(ex).toContainText(w);
    await expect(ex.locator('.mode-ex-pay')).toContainText('WINS / WORD');
  });

  test('FUSE locked preview shows AIN → RAIN / AGAIN / MOUNTAIN', async ({ page }) => {
    await menu(page, 60); // below LV100 → FUSE locked → preview dialog
    await card(page, 'fuse').click({ force: true }); // locked card is aria-disabled but clickable
    const lp = page.locator('.lp-panel');
    await expect(lp).toBeVisible();
    const ex = lp.locator('.mode-ex');
    await expect(ex).toBeVisible();
    for (const w of ['RAIN', 'AGAIN', 'MOUNTAIN']) await expect(ex).toContainText(w);
  });
});

test.describe('item 4 — the CHAIN / FUSE gates', () => {
  // N1 (Andy oct2): CHAIN unlocks at EXACTLY LV50, FUSE at EXACTLY LV100 — Andy's numbers. Source of
  // truth is gameData.js; a played mode is never locked (the bypass block below).
  test('CHAIN gate is LV50: locked at 49', async ({ page }) => {
    await menu(page, 49);
    await expect(card(page, 'chain')).toHaveClass(/locked/);
    await expect(card(page, 'chain')).toContainText('UNLOCKS AT LV 50');
    await expect(card(page, 'chain')).toContainText('1 TO GO');
  });

  test('CHAIN unlocked at LV50', async ({ page }) => {
    await menu(page, 50);
    await expect(card(page, 'chain')).not.toHaveClass(/locked/);
  });

  test('FUSE gate is LV100: locked at 99', async ({ page }) => {
    await menu(page, 99);
    await expect(card(page, 'fuse')).toHaveClass(/locked/);
    await expect(card(page, 'fuse')).toContainText('UNLOCKS AT LV 100');
  });

  test('FUSE unlocked at LV100', async ({ page }) => {
    await menu(page, 100);
    await expect(card(page, 'fuse')).not.toHaveClass(/locked/);
  });

  // LV1 is the floor, not 0 (progress/xp.js clamps with Math.max(1, ...)).
  test('a brand-new player sees how far each gate is', async ({ page }) => {
    await menu(page, 0); // clamped to LV1 by the store
    await expect(card(page, 'chain')).toContainText('49 TO GO'); // clutter pass: no "YOU'RE LV 1 ·" — the menu bar shows the level
    await expect(card(page, 'fuse')).toContainText('99 TO GO');
  });
});

// The contradiction fix: a deep link (/chain/play, ?chain=1) opens a gated mode with NO level
// check, so a level-0 visitor can play a full run — the menu must not then call that mode
// locked. The run counters (taw.chain.runs / taw.fuse.runs, bumped on run start) are the
// "has played" fact; see src/progress/modeAccess.js.
test.describe('play-based bypass', () => {
  for (const [id, key] of [['chain', 'taw.chain.runs'], ['fuse', 'taw.fuse.runs']]) {
    test(`${id}: a played mode is never locked, even at LV0`, async ({ page }) => {
      await installBackendMock(page);
      await page.addInitScript((k) => {
        try {
          localStorage.setItem('taw.xp', JSON.stringify({ lv: 0, into: 0 }));
          localStorage.setItem(k, '1'); // one run started via the deep link
        } catch { /* ignore */ }
      }, key);
      await page.goto('/?portal=1');
      await menuReady(page);
      await page.waitForTimeout(400);
      await expect(card(page, id)).not.toHaveClass(/locked/);
    });
  }

  test('an unplayed gated mode at LV0 is still locked (the bypass is not a blanket unlock)', async ({ page }) => {
    await menu(page, 0);
    await expect(card(page, 'chain')).toHaveClass(/locked/);
    await expect(card(page, 'fuse')).toHaveClass(/locked/);
  });
});
