// e2e/sat-rush.spec.js
//
// A full SAT RUSH run, end to end: the menu card navigates in, Play starts the
// run, and giving up three words (Escape) ends it on the results screen. The
// mode is solo (no WebSocket) but the shared backend mock is still installed so
// the app-level socket never touches production.
//
// `?satRush=1` enables the mode flag so the fourth card renders (the ship flag is
// off by default); `?portal=1` skips the intro straight to the menu; `?stage=500`
// speeds the stage clock so the run is quick.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

test.describe('SAT Rush', () => {
  test('menu card → play → death → results', async ({ page }) => {
    await installBackendMock(page);
    await page.goto('/?satRush=1&portal=1&stage=500');

    // The fourth card is on the menu; clicking it navigates straight into the
    // solo mode (no CREATE/JOIN dialog).
    const card = page.locator('[data-game="sat-rush"]');
    await expect(card).toBeVisible();
    await card.locator('.game-card').click();

    // Start screen → Play.
    const play = page.getByRole('button', { name: 'Play' });
    await expect(play).toBeVisible();
    await play.click();

    // Playing: the ante multiplier and the letter slots are up.
    await expect(page.locator('.sr-mult')).toBeVisible();
    await expect(page.locator('.sr-slots')).toBeVisible();

    // A rejected key must not crash or strand the field.
    await page.keyboard.press('z');
    await expect(page.locator('.sr-mult')).toBeVisible();

    // Out of lives: give up three words. Wait out each between-word pause so the
    // next Escape isn't swallowed while a miss is still resolving.
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1800);
    }

    // Results: the DEAD stamp, the AVG ANTE headline, and the share bar.
    await expect(page.locator('.sr-dead')).toBeVisible();
    await expect(page.locator('.sr-ante-hero')).toBeVisible();
    await expect(page.getByRole('button', { name: /SHARE/ })).toBeVisible();

    // Play again returns to the run.
    await page.getByRole('button', { name: 'Again' }).click();
    await expect(page.locator('.sr-slots')).toBeVisible();
  });
});
