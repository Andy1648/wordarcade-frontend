// e2e/run-payout.spec.js (fix/run-payout) — THE RUN pays out. Fresh storage: play the FREE
// first run, die, return to the menu. Afterwards (1) the menu wins chip equals the run-over
// "+N WINS" and (2) THE RUN card is NOT locked — the XP the run itself paid carries a fresh
// LV1 past the LV8 gate, so the freebie doesn't dead-end into a padlock.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

// ?rs=5 shortens rounds; ?seed=1 rolls SAT RUSH for round 1 (no chain/fuse constraint) so
// every word below is accepted. ?portal=1 skips the boot intro. Storage is otherwise FRESH.
const URL = '/?portal=1&rs=5&seed=1';
const WORDS = [
  'planet', 'garden', 'window', 'silver', 'orange', 'bottle', 'candle', 'jacket',
  'pencil', 'rabbit', 'forest', 'island', 'castle', 'bridge', 'monkey', 'yellow',
];

test('free run: wins banked == "+N WINS" shown, and THE RUN card stays unlocked', async ({ page }) => {
  await installBackendMock(page);
  await page.goto(URL);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });

  const runCard = page.locator('.game-card-magnet[data-game="run"] .game-card');
  await expect(runCard).toBeVisible();
  await expect(runCard).not.toHaveClass(/locked/); // free first run
  await runCard.click({ force: true });

  // Round 1: type enough real words to earn XP + a score, then let the clock run out.
  await expect(page.locator('.run-wall')).toBeVisible({ timeout: 15000 });
  await page.locator('.run-btn-go').click();
  await expect(page.locator('.run-round')).toBeVisible();
  const input = page.locator('.run-input');
  for (const w of WORDS) {
    await input.fill(w);
    await input.press('Enter');
  }
  await expect(page.locator('.run-draft, .run-over')).toBeVisible({ timeout: 10000 });

  // If the wall was cleared, draft anything and DIE on round 2 by typing nothing.
  if (await page.locator('.run-draft').isVisible()) {
    await page.locator('.run-offers .run-card').first().click();
    await expect(page.locator('.run-wall')).toBeVisible();
    await page.locator('.run-btn-go').click();
    await expect(page.locator('.run-over')).toBeVisible({ timeout: 12000 });
  }

  // The over screen's "+N WINS".
  const winsText = await page.locator('.run-over-stat-wins b').textContent();
  const shown = parseInt(winsText.replace(/[^0-9]/g, ''), 10);
  expect(Number.isFinite(shown)).toBe(true);
  expect(shown).toBeGreaterThan(0);

  // What was actually banked (before going home — the menu reads this on mount).
  const stored = await page.evaluate(() => Number(localStorage.getItem('taw.wins')));
  expect(stored).toBe(shown);

  // Back to the menu: the wins chip shows exactly the run's payout …
  await page.locator('.run-over .run-btn-leave').click();
  const chip = page.locator('.menu-wins-chip');
  await expect(chip).toBeVisible({ timeout: 15000 });
  await expect(chip).toHaveAttribute('aria-label', new RegExp(`^${shown} wins`));

  // … and THE RUN card is NOT locked, even though the free run is spent (LV8 reached in play).
  const lv = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.xp') || '{}').lv);
  expect(lv).toBeGreaterThanOrEqual(8);
  await expect(page.locator('.game-card-magnet[data-game="run"] .game-card')).not.toHaveClass(/locked/);
});
