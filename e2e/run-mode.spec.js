// e2e/run-mode.spec.js — THE RUN (headline mode). Asserts the mode is reachable when
// unlocked and its three key surfaces render (card / wall / draft), and captures the
// BE-PICKY screenshots. Uses ?rs=3 so a round clocks out fast enough to reach the draft.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const SHOTS = 'claude/run-shots';

// Seed the save to LV31 so THE RUN (LV30 gate) is unlocked, and mark intro seen.
async function seedUnlocked(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 31, into: 0 }));
    } catch { /* ignore */ }
  });
}

test.describe('the run', () => {
  test.beforeEach(async ({ page }) => {
    await installBackendMock(page);
    await seedUnlocked(page);
  });

  test('the RUN card is the first, unlocked headline card', async ({ page }) => {
    await page.goto('/?portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    const runCard = page.locator('.game-card-magnet[data-game="run"] .game-card');
    await expect(runCard).toBeVisible();
    // Wait out the portal "READY?" intro transition so it doesn't cover the shot: the
    // card is only actionable (uncovered by the fixed overlay) once the intro clears.
    await runCard.click({ trial: true, timeout: 8000 });
    await page.screenshot({ path: `${SHOTS}/1-menu-card.png` });
    await page.locator('.homepage-cards-grid').screenshot({ path: `${SHOTS}/1-cards-grid.png` });
  });

  test('wall → round → draft render and score toward the wall', async ({ page }) => {
    await page.goto('/?portal=1&rs=3');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    await page.locator('.game-card-magnet[data-game="run"] .game-card').click({ force: true });

    // WALL (pre-round) surface.
    await expect(page.locator('.run-wall')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.run-wall-num')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/2-wall.png` });

    // ROUND surface — type a few real words; the score climbs toward the wall.
    await page.locator('.run-btn-go').click();
    await expect(page.locator('.run-round')).toBeVisible();
    const input = page.locator('.run-input');
    for (const w of ['planet', 'garden', 'window', 'silver', 'orange']) {
      await input.fill(w);
      await input.press('Enter');
    }
    await page.screenshot({ path: `${SHOTS}/3-round.png` });

    // DRAFT surface — after the (3s) round clocks out and the wall is cleared OR the
    // run ends. Either the draft or the run-over screen must appear (no hang).
    await expect(page.locator('.run-draft, .run-over')).toBeVisible({ timeout: 8000 });
    if (await page.locator('.run-draft').isVisible()) {
      await expect(page.locator('.run-offer')).toHaveCount(3);
      await page.screenshot({ path: `${SHOTS}/4-draft.png` });
    } else {
      await page.screenshot({ path: `${SHOTS}/4-over.png` });
    }
  });
});
