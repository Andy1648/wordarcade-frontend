// e2e/mode-dialog.spec.js
//
// The card -> dialog expand (ModeDialog): clicking a mode card morphs it into a
// centered dialog, which must open with the right mode and close cleanly by
// every affordance (✕, Escape, scrim click) with no lingering overlay.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

test.describe('mode dialog', () => {
  test.beforeEach(async ({ page }) => {
    await installBackendMock(page);
    await gotoMenu(page);
  });

  async function openDialog(page, cardName) {
    await page.getByRole('button', { name: new RegExp(cardName, 'i') }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test('a card expands into its dialog with the matching mode + actions', async ({ page }) => {
    const dialog = await openDialog(page, 'CATEGORY BLITZ');

    // The dialog shows the mode it was opened from. Category Blitz now offers a
    // direct PLAY SOLO shortcut alongside CREATE ROOM / JOIN (#P2).
    await expect(dialog.locator('.mode-dialog-title')).toContainText('CATEGORY');
    await expect(dialog.locator('.mode-dialog-title')).toContainText('BLITZ');
    await expect(dialog.getByRole('button', { name: 'PLAY SOLO' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'CREATE ROOM' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'JOIN' })).toBeVisible();
  });

  test('closes cleanly via the ✕ button', async ({ page }) => {
    await openDialog(page, 'WORD BOMB');
    await page.getByRole('button', { name: 'Close' }).click();

    // The morph-out is animated; the overlay must fully leave the DOM afterwards.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.mode-dialog-overlay')).toHaveCount(0);
    // …and the menu underneath is interactive again.
    await expect(page.locator('.game-card')).toHaveCount(3);
  });

  test('closes cleanly via the Escape key', async ({ page }) => {
    await openDialog(page, 'WORD BOMB');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.mode-dialog-overlay')).toHaveCount(0);
  });

  test('closes cleanly via a scrim click', async ({ page }) => {
    await openDialog(page, 'IMPOSTER WORD');
    // The scrim is the dimmed backdrop outside the dialog shell.
    await page.locator('.mode-dialog-scrim').click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.mode-dialog-overlay')).toHaveCount(0);
  });

  test('can reopen after closing (open -> close -> open again)', async ({ page }) => {
    await openDialog(page, 'WORD BOMB');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Reopening a different card must work — no stale overlay blocks the click.
    const dialog = await openDialog(page, 'CATEGORY BLITZ');
    await expect(dialog.locator('.mode-dialog-title')).toContainText('BLITZ');
  });
});
