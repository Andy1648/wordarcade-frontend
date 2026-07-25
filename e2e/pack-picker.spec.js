// e2e/pack-picker.spec.js
//
// The Category Blitz pack picker (PackPicker), which only appears inside the
// Category Blitz dialog: it lists every pack, and selection state (toggle,
// SELECT ALL / CLEAR, the "N PACKS LOADED" count) behaves correctly. Selection
// is owned by App state and defaults to all packs on.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';
import PACKS from '../src/data/packs.js';

const PACK_COUNT = PACKS.length; // 15

test.describe('Category Blitz pack picker', () => {
  test.beforeEach(async ({ page }) => {
    await installBackendMock(page);
    await gotoMenu(page);
    await page.getByRole('button', { name: /CATEGORY BLITZ/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('.ppp-picker')).toBeVisible();
  });

  test('lists every pack, defaulting to all selected', async ({ page }) => {
    const pills = page.locator('.ppp-pill');
    await expect(pills).toHaveCount(PACK_COUNT);

    // Every pack label from the data source is present.
    for (const pack of PACKS) {
      await expect(page.getByRole('button', { name: pack.label, exact: true })).toBeVisible();
    }

    // Default: all packs on, count reflects it.
    await expect(page.locator('.ppp-pill.is-on')).toHaveCount(PACK_COUNT);
    await expect(page.locator('.ppp-count-num')).toHaveText(`${PACK_COUNT} PACKS LOADED`);
  });

  test('toggling a pack updates its pressed state and the count', async ({ page }) => {
    const movies = page.getByRole('button', { name: 'MOVIES', exact: true });
    await expect(movies).toHaveAttribute('aria-pressed', 'true');

    await movies.click();
    await expect(movies).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.ppp-pill.is-on')).toHaveCount(PACK_COUNT - 1);
    await expect(page.locator('.ppp-count-num')).toHaveText(`${PACK_COUNT - 1} PACKS LOADED`);

    // Toggling back on restores it.
    await movies.click();
    await expect(movies).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.ppp-count-num')).toHaveText(`${PACK_COUNT} PACKS LOADED`);
  });

  test('CLEAR leaves exactly one pack, then SELECT ALL restores every pack', async ({ page }) => {
    // With everything on, the control reads CLEAR.
    const setAll = page.locator('.ppp-selall');
    await expect(setAll).toHaveText('CLEAR');

    await setAll.click();
    // CLEAR intentionally keeps one pack selected (the "≥1 pack" invariant), and
    // the control flips to SELECT ALL.
    await expect(page.locator('.ppp-pill.is-on')).toHaveCount(1);
    await expect(page.locator('.ppp-count-num')).toHaveText('1 PACK LOADED');
    await expect(setAll).toHaveText('SELECT ALL');

    await setAll.click();
    await expect(page.locator('.ppp-pill.is-on')).toHaveCount(PACK_COUNT);
    await expect(page.locator('.ppp-count-num')).toHaveText(`${PACK_COUNT} PACKS LOADED`);
    await expect(setAll).toHaveText('CLEAR');
  });

  test('cannot deselect the last remaining pack (≥1 invariant holds)', async ({ page }) => {
    // Clear down to one pack.
    await page.locator('.ppp-selall').click(); // CLEAR -> 1 left
    await expect(page.locator('.ppp-pill.is-on')).toHaveCount(1);

    // Attempt to turn the last one off — the picker must refuse and keep it on.
    const lastOn = page.locator('.ppp-pill.is-on');
    await lastOn.click();
    await expect(page.locator('.ppp-pill.is-on')).toHaveCount(1);
    await expect(page.locator('.ppp-count-num')).toHaveText('1 PACK LOADED');
  });
});
