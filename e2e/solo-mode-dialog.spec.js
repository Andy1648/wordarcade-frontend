// e2e/solo-mode-dialog.spec.js — item 3: unlocked CHAIN / FUSE open the SAME mode dialog as
// Word Bomb / Blitz (a solo variant) — name, one-line rule, per-word wins, and a PLAY button —
// instead of jumping straight into the game.
import { test, expect } from '@playwright/test';
import { gotoMenu } from './support/backendMock.js';

// Seed a high level before first paint so CHAIN (LV10) and FUSE (LV20) are unlocked.
async function gotoUnlockedMenu(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.xp', '5000000'); } catch { /* ignore */ }
  });
  await gotoMenu(page);
}

for (const mode of [
  { id: 'chain', name: 'CHAIN', rule: 'starts where the last one ended' },
  { id: 'fuse', name: 'FUSE', rule: 'contains the piece' },
]) {
  test(`${mode.name}: unlocked card opens a PLAY mode dialog (name, rule, per-word wins)`, async ({ page }) => {
    await gotoUnlockedMenu(page);

    const card = page.locator(`.game-card-magnet[data-game="${mode.id}"] .game-card`);
    await expect(card).toBeVisible();
    // It must NOT be locked (level is high enough).
    await expect(card).not.toHaveClass(/locked/);
    await card.click();

    // The shared mode dialog opens (portaled to body).
    const dialog = page.locator('.mode-dialog-shell');
    await expect(dialog).toBeVisible();
    // Name, one-line rule, per-word wins line, and a single PLAY button.
    await expect(dialog.locator('.mode-dialog-title')).toContainText(mode.name);
    await expect(dialog.locator('.mode-dialog-liner')).toContainText(mode.rule, { ignoreCase: true });
    await expect(dialog.locator('.mode-dialog-pay')).toContainText('WINS / WORD');
    const play = dialog.locator('.mode-dialog-btn', { hasText: 'PLAY' });
    await expect(play).toBeVisible();
    // Solo dialog shows no CREATE/JOIN.
    await expect(dialog.locator('.mode-dialog-btn-join')).toHaveCount(0);
  });
}
