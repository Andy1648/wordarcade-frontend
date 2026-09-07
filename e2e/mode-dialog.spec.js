// e2e/mode-dialog.spec.js
//
// The card -> dialog expand (ModeDialog): clicking a mode card morphs it into a
// centered dialog, which must open with the right mode and close cleanly by
// every affordance (✕, Escape, scrim click) with no lingering overlay.
import { test, expect } from '@playwright/test';
import { GAMES } from '../src/gameData.js';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

test.describe('mode dialog', () => {
  test.beforeEach(async ({ page }) => {
    await installBackendMock(page);
    await gotoMenu(page);
  });

  async function openDialog(page, cardName) {
    await page.getByRole('button', { name: new RegExp(cardName, 'i') }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test('a card expands into its dialog with the matching mode + CREATE/JOIN', async ({ page }) => {
    const dialog = await openDialog(page, 'CATEGORY BLITZ');

    // The dialog shows the mode it was opened from and its two actions.
    await expect(dialog.locator('.mode-dialog-title')).toContainText('CATEGORY');
    await expect(dialog.locator('.mode-dialog-title')).toContainText('BLITZ');
    // On-ramp (fix/onramp): PLAY (solo-instant) leads; INVITE FRIENDS (create) + JOIN
    // are the deliberate multiplayer secondary row.
    await expect(dialog.locator('.mode-dialog-btn-play')).toBeVisible();
    await expect(dialog.locator('.mode-dialog-btn-create')).toBeVisible();
    await expect(dialog.locator('.mode-dialog-btn-join')).toBeVisible();
  });

  test('closes cleanly via the ✕ button', async ({ page }) => {
    await openDialog(page, 'WORD BOMB');
    await page.getByRole('button', { name: 'Close' }).click();

    // The morph-out is animated; the overlay must fully leave the DOM afterwards.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.mode-dialog-overlay')).toHaveCount(0);
    // …and the menu underneath is interactive again.
    await expect(page.locator('.game-card')).toHaveCount(GAMES.length);
  });

  test('closes cleanly via the Escape key', async ({ page }) => {
    await openDialog(page, 'WORD BOMB');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.mode-dialog-overlay')).toHaveCount(0);
  });

  test('closes cleanly via a scrim click', async ({ page }) => {
    await openDialog(page, 'CATEGORY BLITZ');
    // The scrim is the dimmed backdrop outside the dialog shell.
    await page.locator('.mode-dialog-scrim').click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.mode-dialog-overlay')).toHaveCount(0);
  });

  test('can reopen after closing (open -> close -> open again)', async ({ page }) => {
    await openDialog(page, 'WORD BOMB');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Reopening a different card must work — no stale overlay blocks the click.
    const dialog = await openDialog(page, 'CATEGORY BLITZ');
    await expect(dialog.locator('.mode-dialog-title')).toContainText('BLITZ');
  });
});

// The on-ramp (fix/onramp): a lone newcomer's PLAY must drop them straight into a live
// game against a bot — no room code, no waiting lobby, no "NEED 2+ PLAYERS". This is the
// blocker verdict-4 named. We assert the CLIENT provisions solo-vs-bot in order and lands
// on the game screen (never the room/lobby) once game_started arrives.
test('on-ramp: Word Bomb PLAY provisions solo-vs-bot and lands in-game (no lobby)', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await page.getByRole('button', { name: /WORD BOMB/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // PLAY is the primary, solo-instant CTA (not the create/lobby path).
  await page.locator('.mode-dialog-btn-play').click();

  // The client provisions a solo-vs-bot room and starts it, all in order on one socket.
  await mock.waitForSent('start_game');
  const types = mock.sentTypes();
  for (const t of ['create_room', 'set_game_type', 'add_bot', 'start_game']) {
    expect(types, `PLAY must send ${t}`).toContain(t);
  }
  // add_bot must precede start_game (the bot is the 2nd player before the game starts).
  expect(types.indexOf('add_bot')).toBeLessThan(types.indexOf('start_game'));

  // The server answers: a room_update lands FIRST (create_room/add_bot broadcasts) — the
  // solo-launch guard must NOT flash the lobby — then game_started drops us in-game.
  mock.pushToClient({ type: 'room_update', payload: { code: 'ZZZZ', gameType: 'word-bomb', hostId: 'e2e-player', difficultyKey: 'chill', players: [{ id: 'e2e-player', name: 'YOU', lives: 3, isHost: true }, { id: 'bot', name: 'BOT', lives: 3 }] } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: 'e2e-player', players: [{ id: 'e2e-player', name: 'YOU', lives: 3, isHost: true }, { id: 'bot', name: 'BOT', lives: 3 }], combo: 'str', usedWords: [], timerSeconds: 22 } });

  await expect(page.locator('.game-stage')).toBeVisible({ timeout: 5000 });
  // Never dumped into the waiting room / lobby on the way.
  await expect(page.locator('.room-wrap')).toHaveCount(0);
  await expect(page.locator('.lobby-wrap')).toHaveCount(0);
});
