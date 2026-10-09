// e2e/menu.spec.js
//
// The menu (Homepage): the mode cards render with their labels, and the
// menu's navigation entries always lead somewhere with a way back (no dead-end).
import { test, expect } from '@playwright/test';
import { GAMES, FEATURED_GAME } from '../src/gameData.js';
import { installBackendMock, gotoMenu } from './support/backendMock.js';
import { joinControl, menuMark, menuMarkAll, revealMode } from './support/menu.js';



// The shipped mode cards, derived from the single source of truth (src/gameData.js)
// so adding a mode never silently breaks this. Names render across two lines
// ("WORD\nBOMB"); we normalize the newline to a space for the label assertions.
// `cardName` is the label the CARD shows when it differs from the mode's full title — Category
// Blitz's card says BLITZ, because "CATEGORY" is eight letters and could not be set at the
// size every other card's name gets. `name` is still the accessible name (aria-label) and
// still what the mode dialog shows, so the getByRole lookup below is unchanged.
const CARDS = GAMES.map((g) => ({
  id: g.id,
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

    for (const { id, name, cardName, badge } of CARDS) {
      // Each card is a role="button" whose accessible name combines its title and
      // badge, e.g. "WORD BOMB - SOLO · MULTI".
      const card = page.getByRole('button', { name: new RegExp(`${name}\\b`, 'i'), includeHidden: true });
      // feat/menu-centre: every desktop pages the row (3 a page) — flip to the card's page before looking
      await revealMode(page, id);
      await expect(card).toBeVisible();
      // The name renders across two lines ("WORD\nBOMB"); toHaveText normalizes
      // whitespace, so the single-spaced label matches.
      await expect(card.locator('.game-card-name')).toHaveText(cardName);
      await expect(card.locator('.game-card-badge')).toHaveText(badge);
    }
  });

  // v2 menu: no JOIN ROOM button on the menu — joining is the mode dialog's JOIN WITH CODE.
  test('JOIN WITH CODE (mode dialog) navigates to the room browser and back (no dead-end)', async ({ page }) => {
    await (await joinControl(page)).click();

    // We leave the menu for the JOIN ROOM / public-rooms browser…
    const back = page.getByRole('button', { name: /←\s*BACK/ });
    await expect(back).toBeVisible();
    await expect(menuMarkAll(page)).toHaveCount(0);

    // …and the BACK control returns us to the menu — the path is reversible.
    await back.click();
    await expect(menuMark(page)).toBeVisible();
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
    await expect(menuMark(page)).toBeVisible();
  });

  // THE PER-LETTER LINE (v2 menu) quotes BASE 10 XP / LETTER on a fresh profile (T0, R0, no mark) — the
  // one XP rate there is, menu or game; words pay WINS only, so the featured card quotes no XP line.
  test('no rate line under the bar, and the featured card quotes no XP', async ({ page }) => {
    const m = await page.evaluate(() => {
      const read = (e) => (e ? e.innerText.replace(/\s+/g, ' ').trim() : null);
      const ribbon = document.querySelector('.game-card-ribbon.is-featured');
      const card = ribbon ? ribbon.closest('.game-card') : null;
      return {
        per: document.querySelector('.hp-per, .hp-rate'),
        cardName: read(card && card.querySelector('.game-card-name')),
        cardXp: read(card && card.querySelector('.game-card-xp')),
      };
    });
    expect(await page.locator('.game-card-ribbon.is-featured').count()).toBe(1);
    expect(m.cardName).toBe((FEATURED_GAME.cardName || FEATURED_GAME.name).split(String.fromCharCode(10)).join(' '));
    // no rate line under the bar (Andy oct9: "thats not always the case") — season 1 too
    expect(m.per).toBeNull();
    expect(m.cardXp).toBeNull();
  });

});

// SEASON 2: NO rate line under the bar (Andy oct9: "no need to write how much xp/key below the progression bar bc thats
// not always the case"), desktop and phone — a fresh save (T0, R0, no mark) still pays +1 XP a key.
for (const vp of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`season 2 @${vp.width}: no XP / KEY line under the bar; a key still pays +1`, async ({ page }) => {
    await page.setViewportSize(vp);
    await installBackendMock(page);
    await page.addInitScript(() => {
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
    });
    await page.goto('/?portal=1&season2=1');
    await page.locator('.menu-xp-bar:visible').first().waitFor();
    await expect(page.locator('.hp-per, .hp-rate')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('XP / KEY');
    for (const k of 'qwe') { await page.keyboard.press(k); await page.waitForTimeout(80); } // 3 keys: a 1% CRIT pop is filtered out
    await expect.poll(() => page.evaluate(() => Number(([...document.querySelectorAll('.menu-xp-pop-plus')].map((n) => n.textContent).filter((t) => t && !/CRIT/.test(t)).pop() || '').replace(/[^\d.]/g, '')))).toBe(1);
  });
}
