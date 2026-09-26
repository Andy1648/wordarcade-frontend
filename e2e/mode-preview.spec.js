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
    await menu(page, 20); // well past the LV2 gate → unlocked
    await card(page, 'chain').click();
    const ex = page.locator('.mode-dialog-shell .mode-ex');
    await expect(ex).toBeVisible();
    for (const w of ['EAGLE', 'ELEPHANT', 'TIGER']) await expect(ex).toContainText(w);
    await expect(ex.locator('.mode-ex-pay')).toContainText('WINS / WORD');
  });

  test('FUSE locked preview shows AIN → RAIN / AGAIN / MOUNTAIN', async ({ page }) => {
    await menu(page, 2); // below LV3 → FUSE locked → preview dialog
    await card(page, 'fuse').click({ force: true }); // locked card is aria-disabled but clickable
    const lp = page.locator('.lp-panel');
    await expect(lp).toBeVisible();
    const ex = lp.locator('.mode-ex');
    await expect(ex).toBeVisible();
    for (const w of ['RAIN', 'AGAIN', 'MOUNTAIN']) await expect(ex).toContainText(w);
  });
});

test.describe('item 4 — the CHAIN / FUSE gates', () => {
  // Gates were LOWERED (CHAIN 20 -> 2, FUSE 25 -> 3): the raised values were pacing set by
  // feel with no players to pace against, and a gate measured in thousands of typed letters
  // is a wall in front of a first session. Source of truth is gameData.js — update these to
  // match it, not the reverse.
  test('CHAIN gate is LV2: locked at 1', async ({ page }) => {
    await menu(page, 1);
    await expect(card(page, 'chain')).toHaveClass(/locked/);
    await expect(card(page, 'chain')).toContainText('UNLOCKS AT LV 2');
    await expect(card(page, 'chain')).toContainText('1 TO GO'); // reachable, not "20 TO GO"
  });

  test('CHAIN unlocked at LV2', async ({ page }) => {
    await menu(page, 2);
    await expect(card(page, 'chain')).not.toHaveClass(/locked/);
  });

  test('FUSE gate is LV3: locked at 2', async ({ page }) => {
    await menu(page, 2);
    await expect(card(page, 'fuse')).toHaveClass(/locked/);
    await expect(card(page, 'fuse')).toContainText('UNLOCKS AT LV 3');
  });

  test('FUSE unlocked at LV3', async ({ page }) => {
    await menu(page, 3);
    await expect(card(page, 'fuse')).not.toHaveClass(/locked/);
  });

  // LV1 is the floor, not 0 (progress/xp.js clamps with Math.max(1, ...)), so this is literally
  // what a fresh player sees on their first look at the menu.
  test('a brand-new player sees a one-and-two-level path, not a wall', async ({ page }) => {
    await menu(page, 0); // clamped to LV1 by the store
    await expect(card(page, 'chain')).toContainText("YOU'RE LV 1 · 1 TO GO");
    await expect(card(page, 'fuse')).toContainText("YOU'RE LV 1 · 2 TO GO");
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
