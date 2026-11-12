// e2e/join-midgame.spec.js — STEP 54: the room code is on screen during a Word Bomb game, and a
// player who joins a round in progress by code lands IN the game as a spectator ("WATCHING —
// YOU'RE DEALT IN NEXT TURN") and is dealt in when the server's next turn lists them as a player.
// nov12 (Andy: "spectating a word bomb game gives that countdown as well"): a LIVE join (game_started.spectator, or a
// SPECTATE watch) never mounts the 3-2-1 - not on arrival, not when dealt in. A normal start still does (the control).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player'; // the mock's `connected` id
// count every mount of the countdown from the first paint (a point-in-time check could miss a 2.8 s overlay)
async function watchCountdown(page) {
  await page.addInitScript(() => {
    window.__countdownSeen = 0;
    const go = () => new MutationObserver(() => {
      if (document.querySelector('.countdown-overlay')) window.__countdownSeen += 1;
    }).observe(document.documentElement, { childList: true, subtree: true });
    if (document.documentElement) go(); else document.addEventListener('DOMContentLoaded', go);
  });
}
const seen = (page) => page.evaluate(() => window.__countdownSeen);

const players = [{ id: 'host', name: 'HOST', lives: 3 }, { id: 'p2', name: 'TWO', lives: 3 }];

for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
  test(`${vp.width}: a late joiner watches, then is dealt in; the room code is on screen`, async ({ page }) => {
    await page.setViewportSize(vp);
    await watchCountdown(page);
    const m = await installBackendMock(page);
    await page.goto('/?portal=1');
    await menuReady(page);
    // what the server sends a code-joiner mid-round (be: server.js join_room, STEP 54)
    m.pushToClient({ type: 'room_joined', payload: { code: 'WXYZ' } });
    m.pushToClient({ type: 'room_update', payload: { code: 'WXYZ', gameType: 'word-bomb', hostId: 'host', difficultyKey: 'chill', players: [...players, { id: ME, name: 'YOU' }] } });
    m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb', difficultyKey: 'chill', spectator: true } });
    m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: 'host', players, spectators: [{ id: ME, name: 'YOU' }], combo: 'er', timerSeconds: 20, maxLives: 3, usedWords: [] } });
    await page.locator('.game-wrap').waitFor({ state: 'visible' });
    await expect(page.locator('.game-spectating')).toContainText('DEALT IN NEXT TURN');
    await expect(page.locator('.game-room-code')).toContainText('WXYZ');
    // the next turn deals me in
    m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: 'p2', players: [...players, { id: ME, name: 'YOU', lives: 3 }], spectators: [], combo: 'in', timerSeconds: 20, maxLives: 3, usedWords: [] } });
    await expect(page.locator('.game-spectating')).toHaveCount(0);
    await page.waitForTimeout(800);
    expect(await seen(page), 'a live joiner never gets the 3-2-1').toBe(0);
  });
}

test('SPECTATE (watchOnly) Word Bomb: the board shows with no countdown; a normal start still counts down', async ({ page }) => {
  await watchCountdown(page);
  const m = await installBackendMock(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  m.pushToClient({ type: 'room_spectating', payload: { code: 'WXYZ' } });
  m.pushToClient({ type: 'room_update', payload: { code: 'WXYZ', gameType: 'word-bomb', hostId: 'host', difficultyKey: 'chill', players } });
  m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb', difficultyKey: 'chill', spectator: true, watchOnly: true } });
  m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: 'host', players, combo: 'er', timerSeconds: 20, maxLives: 3, usedWords: [] } });
  await expect(page.getByTestId('watch-chip')).toBeVisible();
  await page.waitForTimeout(800);
  expect(await seen(page), 'a watcher never gets the 3-2-1').toBe(0);
});

test("control: a player's own game_started (no spectator flag) still plays the 3-2-1", async ({ page }) => {
  await watchCountdown(page);
  const m = await installBackendMock(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  const seated = [...players, { id: ME, name: 'YOU', lives: 3 }];
  m.pushToClient({ type: 'room_joined', payload: { code: 'WXYZ' } });
  m.pushToClient({ type: 'room_update', payload: { code: 'WXYZ', gameType: 'word-bomb', hostId: 'host', difficultyKey: 'chill', players: seated } });
  m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb', difficultyKey: 'chill' } });
  m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: 'host', players: seated, combo: 'er', timerSeconds: 20, maxLives: 3, usedWords: [] } });
  await expect.poll(() => seen(page), { timeout: 5000 }).toBeGreaterThan(0);
});
