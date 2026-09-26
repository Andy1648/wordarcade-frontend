// e2e/sat-rush-exit.spec.js
//
// A SAT RUSH run now has an escape hatch: the HUD's exit ✕ abandons the run
// cleanly and returns to the menu (no death, no results screen). This drives the
// launch link straight into a live LINEUP run (no briefing study screen, so the
// HUD is up immediately), clicks the ✕, and asserts we land back on the menu with
// no app console errors.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

test.describe('SAT Rush run exit', () => {
  test('the HUD exit abandons a live run and returns to the menu, no console errors', async ({
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
    // The shareable deep link opens a LIVE RUN directly (skips intro, menu and cover), so the HUD
    // — and its exit — is on screen on the first frame.
    await page.goto('/?satrush=1&ref=share');
    await expect(page.locator('.sr-slots')).toBeVisible({ timeout: 20000 });

    // The exit is now labelled with its DESTINATION (← MENU) rather than a bare ✕ — see
    // satRush/Hud.jsx. Same control, same behaviour; it just says where it goes now.
    const exit = page.getByRole('button', { name: 'Exit to menu' });
    await expect(exit).toBeVisible();
    await exit.click();

    // Landed back on the menu (the homepage wordmark) — NOT the results page, and
    // the SAT Rush app is fully torn down.
    await menuReady(page);
    await expect(page.locator('.sr-respage')).toHaveCount(0);
    await expect(page.locator('.sr-app')).toHaveCount(0);

    expect(errors, `unexpected console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
