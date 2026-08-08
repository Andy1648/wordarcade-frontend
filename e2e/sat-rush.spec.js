// e2e/sat-rush.spec.js
//
// SAT RUSH end to end: the mode opens from its menu card, a word can be CLEARED,
// and running out of lives lands on the retro-print results PAGE. Solo mode (no
// WebSocket), but the shared backend mock is installed so the app-level socket
// never touches production.
//
// `?satRush=1` enables the mode flag so the third card renders; `?portal=1` skips
// the intro straight to the menu.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

test.describe('SAT Rush', () => {
  test('menu card → play → clear a word → death → results page', async ({ page }) => {
    await installBackendMock(page);
    await page.goto('/?satRush=1&portal=1');

    // The mode opens straight from its menu card (solo — no CREATE/JOIN dialog).
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

    // A word can be CLEARED without knowing the answer: mashing a wrong key reveals
    // one letter every 3rd press (engine wrongKeystrokeRevealEvery), so enough
    // presses reveal the whole word and complete it — a full-credit clear.
    const scoreCell = page.locator('.sr-hud .sr-hcell').first().locator('.sr-hval');
    await expect(scoreCell).toHaveText('000000');
    for (let i = 0; i < 72; i++) await page.keyboard.press('q');
    await expect(scoreCell).not.toHaveText('000000'); // a clear banked points

    // Let the between-word pause settle onto a fresh, idle word.
    await page.waitForTimeout(1000);

    // Out of lives: give up three words (Escape). Wait out each miss pause so the
    // next Escape isn't swallowed while one is still resolving.
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1800);
    }

    // Results: the retro-print PAGE, the DEAD stamp, the AVG ANTE hero, the share
    // bar, and the paper actions.
    await expect(page.locator('.sr-respage')).toBeVisible();
    await expect(page.locator('.sr-dead')).toBeVisible();
    await expect(page.locator('.sr-ante-value')).toBeVisible();
    await expect(page.getByRole('button', { name: /SHARE/ })).toBeVisible();
    const runItBack = page.getByRole('button', { name: 'Run it back' });
    await expect(runItBack).toBeVisible();

    // Run it back returns to a fresh run.
    await runItBack.click();
    await expect(page.locator('.sr-slots')).toBeVisible();
  });
});
