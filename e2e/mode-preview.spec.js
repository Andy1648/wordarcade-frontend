// e2e/mode-preview.spec.js — item 2 (real worked examples in the mode dialogs) and item 4
// (raised gates: CHAIN LV15, FUSE LV22, with the locked-card copy updated).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function menu(page, level) {
  await installBackendMock(page);
  if (level != null) {
    await page.addInitScript((lv) => {
      try { localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 })); } catch { /* ignore */ }
    }, level);
  }
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
}
const card = (page, id) => page.locator(`.game-card-magnet[data-game="${id}"] .game-card`);

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
    await menu(page, 20); // past LV15 → unlocked
    await card(page, 'chain').click();
    const ex = page.locator('.mode-dialog-shell .mode-ex');
    await expect(ex).toBeVisible();
    for (const w of ['EAGLE', 'ELEPHANT', 'TIGER']) await expect(ex).toContainText(w);
    await expect(ex.locator('.mode-ex-pay')).toContainText('WINS / WORD');
  });

  test('FUSE locked preview shows AIN → RAIN / AGAIN / MOUNTAIN', async ({ page }) => {
    await menu(page, 16); // below LV22 → FUSE locked → preview dialog
    await card(page, 'fuse').click({ force: true }); // locked card is aria-disabled but clickable
    const lp = page.locator('.lp-panel');
    await expect(lp).toBeVisible();
    const ex = lp.locator('.mode-ex');
    await expect(ex).toBeVisible();
    for (const w of ['RAIN', 'AGAIN', 'MOUNTAIN']) await expect(ex).toContainText(w);
  });
});

test.describe('item 4 — raised gates', () => {
  // Gates were raised again after this spec was written: gameData.js has CHAIN unlockLevel 20
  // (fix/qa-sweep §9, was 15) and FUSE unlockLevel 25 (fix/qa-sweep §10, was 22). Source of truth
  // is gameData.js — update these to match it, not the reverse.
  test('CHAIN gate is LV20: locked at 19, unlocked at 20', async ({ page }) => {
    await menu(page, 19);
    await expect(card(page, 'chain')).toHaveClass(/locked/);
    await expect(card(page, 'chain')).toContainText('UNLOCKS AT LV 20');
  });

  test('CHAIN unlocked at LV20', async ({ page }) => {
    await menu(page, 20);
    await expect(card(page, 'chain')).not.toHaveClass(/locked/);
  });

  test('FUSE gate is LV25: locked at 24 with updated copy, unlocked at 25', async ({ page }) => {
    await menu(page, 24);
    await expect(card(page, 'fuse')).toHaveClass(/locked/);
    await expect(card(page, 'fuse')).toContainText('UNLOCKS AT LV 25');
  });

  test('FUSE unlocked at LV25', async ({ page }) => {
    await menu(page, 25);
    await expect(card(page, 'fuse')).not.toHaveClass(/locked/);
  });
});
