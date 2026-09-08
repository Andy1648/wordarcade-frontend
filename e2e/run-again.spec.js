// e2e/run-again.spec.js (feat/run-gameover-2) — RUN AGAIN on the run-over screen starts a
// FRESH run in place (round 1, empty stack) without going through the menu. It must keep
// working when the player is still below the LV8 gate with the free first run already spent:
// the gate is a menu-CARD concern (runGate.isRunLocked), never a run-screen one.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

test('die → RUN AGAIN → fresh run at START ROUND 1 with an empty stack (below LV8, freebie spent)', async ({ page }) => {
  await installBackendMock(page);
  // Fresh storage: LV1, free run available. ?rs=3 = 3-second rounds, ?portal=1 skips the intro.
  await page.goto('/?portal=1&rs=3');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.locator('.game-card-magnet[data-game="run"] .game-card').click({ force: true });

  // Round 1: type nothing and let the clock run out → RUN OVER (short of the wall).
  await expect(page.locator('.run-wall')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.run-stack-count')).toHaveText('0');
  await page.locator('.run-btn-go').click();
  await expect(page.locator('.run-round')).toBeVisible();
  await expect(page.locator('.run-over')).toBeVisible({ timeout: 10000 });

  // The freebie is spent and the player is still LV1 — the MENU card would now be locked.
  const gate = await page.evaluate(() => ({
    freeUsed: localStorage.getItem('taw.runFreeUsed'),
    lv: JSON.parse(localStorage.getItem('taw.xp') || '{"lv":1}').lv,
  }));
  expect(gate.freeUsed).toBe('1');
  expect(gate.lv).toBeLessThan(8);

  // RUN AGAIN: straight back to a fresh wall — round 1, empty stack, no menu round-trip.
  await page.locator('.run-over .run-btn-again').click();
  await expect(page.locator('.run-wall')).toBeVisible();
  await expect(page.locator('.run-over')).toHaveCount(0);
  await expect(page.locator('.run-btn-go')).toHaveText('START ROUND 1');
  await expect(page.locator('.run-stack-count')).toHaveText('0');
  await expect(page.locator('.run-banked b')).toHaveText('0');
  // We never touched the menu on the way here.
  await expect(page.locator('.game-card-magnet[data-game="run"]')).toHaveCount(0);

  // And the fresh run actually plays: START enters a live round.
  await page.locator('.run-btn-go').click();
  await expect(page.locator('.run-round')).toBeVisible();
});
