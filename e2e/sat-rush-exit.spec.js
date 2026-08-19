// e2e/sat-rush-exit.spec.js
//
// A SAT RUSH run now has an escape hatch: the HUD's exit ✕ abandons the run
// cleanly and returns to the menu (no death, no results screen). This drives the
// launch link straight into a live LINEUP run (no briefing study screen, so the
// HUD is up immediately), clicks the ✕, and asserts we land back on the menu with
// no app console errors.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

test.describe('SAT Rush run exit', () => {
  test('the HUD ✕ abandons a live run and returns to the menu, no console errors', async ({
    page,
  }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      // The backend mock aborts every non-localhost request (fonts, analytics), which
      // the browser reports as resource-load failures — not app errors. Ignore those;
      // count only real app/runtime errors.
      if (/Failed to load resource|ERR_FAILED|net::/i.test(text)) return;
      errors.push(text);
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    await installBackendMock(page);
    // The shareable deep link opens SAT Rush directly (skips intro + menu).
    await page.goto('/?satrush=1&ref=share');
    await expect(page.locator('.sr-cover')).toBeVisible();

    // Play → LINEUP drops straight into a live run (no briefing screen), so the HUD
    // — and its exit ✕ — is on screen.
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.locator('.sr-modeselect')).toBeVisible();
    await page.getByRole('button', { name: /LINEUP/ }).click();
    await expect(page.locator('.sr-slots')).toBeVisible();

    const exit = page.getByRole('button', { name: 'Exit run' });
    await expect(exit).toBeVisible();
    await exit.click();

    // Landed back on the menu (the homepage wordmark) — NOT the results page, and
    // the SAT Rush app is fully torn down.
    await expect(page.getByRole('img', { name: 'Type a Word' })).toBeVisible();
    await expect(page.locator('.sr-respage')).toHaveCount(0);
    await expect(page.locator('.sr-app')).toHaveCount(0);

    expect(errors, `unexpected console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
