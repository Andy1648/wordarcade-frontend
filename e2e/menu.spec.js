// e2e/menu.spec.js
//
// The menu (Homepage): the three mode cards render with their labels, and the
// menu's navigation entries always lead somewhere with a way back (no dead-end).
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const MENU = { name: 'Type a Word' };

// The shipped mode cards (src/gameData.js). THREE modes now ship: two social
// games plus SAT RUSH (the solo vocab mode). We verify all three so the
// label check is faithful to what actually ships.
const CARDS = [
  { name: 'WORD BOMB', badge: 'SOLO · MULTI' },
  { name: 'CATEGORY BLITZ', badge: 'SOLO / MULTI' },
  { name: 'SAT RUSH', badge: 'SOLO' },
];

test.describe('menu', () => {
  test.beforeEach(async ({ page }) => {
    await installBackendMock(page);
    await gotoMenu(page);
  });

  test('renders all three mode cards with correct name + badge labels', async ({ page }) => {
    const cards = page.locator('.game-card');
    await expect(cards).toHaveCount(CARDS.length);

    for (const { name, badge } of CARDS) {
      // Each card is a role="button" whose accessible name combines its title and
      // badge, e.g. "WORD BOMB - SOLO · MULTI".
      const card = page.getByRole('button', { name: new RegExp(`${name}\\b`, 'i') });
      await expect(card).toBeVisible();
      // The name renders across two lines ("WORD\nBOMB"); toHaveText normalizes
      // whitespace, so the single-spaced label matches.
      await expect(card.locator('.game-card-name')).toHaveText(name);
      await expect(card.locator('.game-card-badge')).toHaveText(badge);
    }
  });

  test('the JOIN ROOM entry navigates to the room browser and back (no dead-end)', async ({ page }) => {
    await page.getByRole('button', { name: 'JOIN ROOM' }).click();

    // We leave the menu for the JOIN ROOM / public-rooms browser…
    const back = page.getByRole('button', { name: /←\s*BACK/ });
    await expect(back).toBeVisible();
    await expect(page.getByRole('img', MENU)).toHaveCount(0);

    // …and the BACK control returns us to the menu — the path is reversible.
    await back.click();
    await expect(page.getByRole('img', MENU)).toBeVisible();
    await expect(page.locator('.game-card')).toHaveCount(CARDS.length);
  });

  test('a mode card CREATE reaches the lobby and back returns to the menu', async ({ page }) => {
    // Open a card's dialog, pick CREATE — that routes into the lobby form.
    await page.getByRole('button', { name: /WORD BOMB/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('.mode-dialog-btn-create').click();

    // The lobby is a real screen with its own BACK — never a dead-end.
    const back = page.getByRole('button', { name: /←\s*BACK/ });
    await expect(back).toBeVisible();
    await expect(page.locator('#player-name-input')).toBeVisible();

    await back.click();
    await expect(page.getByRole('img', MENU)).toBeVisible();
  });
});
