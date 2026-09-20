// e2e/menu.spec.js
//
// The menu (Homepage): the mode cards render with their labels, and the
// menu's navigation entries always lead somewhere with a way back (no dead-end).
import { test, expect } from '@playwright/test';
import { GAMES, FEATURED_GAME } from '../src/gameData.js';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const MENU = { name: 'Type a Word' };

// The shipped mode cards, derived from the single source of truth (src/gameData.js)
// so adding a mode never silently breaks this. Names render across two lines
// ("WORD\nBOMB"); we normalize the newline to a space for the label assertions.
// `cardName` is the label the CARD shows when it differs from the mode's full title — Category
// Blitz's card says BLITZ, because "CATEGORY" is eight letters and could not be set at the
// size every other card's name gets. `name` is still the accessible name (aria-label) and
// still what the mode dialog shows, so the getByRole lookup below is unchanged.
const CARDS = GAMES.map((g) => ({
  name: g.name.replace('\n', ' '),
  cardName: (g.cardName || g.name).replace('\n', ' '),
  badge: g.badgeText,
}));

test.describe('menu', () => {
  test.beforeEach(async ({ page }) => {
    await installBackendMock(page);
    await gotoMenu(page);
  });

  test('renders all mode cards with correct name + badge labels', async ({ page }) => {
    const cards = page.locator('.game-card');
    await expect(cards).toHaveCount(CARDS.length);

    for (const { name, cardName, badge } of CARDS) {
      // Each card is a role="button" whose accessible name combines its title and
      // badge, e.g. "WORD BOMB - SOLO · MULTI".
      const card = page.getByRole('button', { name: new RegExp(`${name}\\b`, 'i') });
      await expect(card).toBeVisible();
      // The name renders across two lines ("WORD\nBOMB"); toHaveText normalizes
      // whitespace, so the single-spaced label matches.
      await expect(card.locator('.game-card-name')).toHaveText(cardName);
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

  // THE HINT AND THE CARD MUST QUOTE THE SAME RATE, and this compares the two RENDERED strings
  // rather than the code behind them — which is the only way the original defect was visible.
  // The hint divided by the MENU's x1 rate and printed "12 WORDS TO LEVEL 2" directly above a
  // FEATURED card printing "100 XP / WORD": both numbers correct, the pair incoherent.
  test('the XP hint quotes the FEATURED card rate, not the menu rate', async ({ page }) => {
    const m = await page.evaluate(() => {
      const read = (e) => (e ? e.innerText.replace(/\s+/g, ' ').trim() : null);
      const ribbon = document.querySelector('.game-card-ribbon.is-featured');
      const card = ribbon ? ribbon.closest('.game-card') : null;
      return {
        hint: read(document.querySelector('.menu-xp-hint-text')),
        cardName: read(card && card.querySelector('.game-card-name')),
        cardXp: read(card && card.querySelector('.game-card-xp')),
        cost: read(document.querySelector('.menu-xp-readout-need')),
      };
    });
    // Exactly one card carries the ribbon, and it is the one gameData marks.
    expect(await page.locator('.game-card-ribbon.is-featured').count()).toBe(1);
    expect(m.cardName).toBe((FEATURED_GAME.cardName || FEATURED_GAME.name).split('\n').join(' '));

    const words = Number((m.hint.match(/(\d[\d,]*)\s+WORDS?/) || [])[1].replace(/,/g, ''));
    const perWord = Number(m.cardXp.replace(/,/g, '').match(/(\d+)\s*XP/)[1]);
    const cost = Number(m.cost.replace(/[^0-9]/g, ''));
    expect(words, `hint "${m.hint}" vs card "${m.cardXp}" over ${cost}`).toBe(Math.ceil(cost / perWord));
    // And it is NOT the menu's own rate, which is the featured mode's divided by its multiplier.
    expect(words).toBeLessThan(Math.ceil(cost / (perWord / 2)));
  });

});
