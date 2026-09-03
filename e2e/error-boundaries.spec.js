// error-boundaries.spec.js — per-screen error boundaries (fix/error-boundaries). Forces a crash
// inside a boundary via the `?boom=<name>` test seam and asserts (a) the inline panel shows instead
// of a blank app, and (b) the rest of the app stays interactive / recovers. `?portal=1` skips the
// boot splash/intro so the underlying screen mounts directly.
import { test, expect } from '@playwright/test';

test('a crashed GAME SCREEN shows the inline panel and GO BACK recovers to a live menu', async ({ page }) => {
  await page.goto('/chain?portal=1&boom=chain');
  await expect(page.getByText('THIS SCREEN BROKE')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /GO BACK/ }).click();
  await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('THIS SCREEN BROKE')).toHaveCount(0);
});

test('a crashed MENU is caught inline (the app is not blanked)', async ({ page }) => {
  await page.goto('/?portal=1&boom=home');
  await expect(page.getByText('THIS SCREEN BROKE')).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: /GO BACK/ })).toBeVisible();
});

test('a crashed OVERLAY (mode dialog) shows the panel while the menu stays mounted behind it', async ({ page }) => {
  await page.goto('/?portal=1&boom=mode-dialog');
  await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 15000 });
  await page.locator('.game-card').first().click(); // open a mode dialog → its boundary catches the throw
  await expect(page.getByText('THIS SCREEN BROKE')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.game-card').first()).toBeAttached(); // the menu behind is still mounted
});
