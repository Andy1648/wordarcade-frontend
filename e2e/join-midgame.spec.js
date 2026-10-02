// e2e/join-midgame.spec.js — STEP 54: the room code is on screen during a Word Bomb game, and a
// player who joins a round in progress by code lands IN the game as a spectator ("WATCHING —
// YOU'RE DEALT IN NEXT TURN") and is dealt in when the server's next turn lists them as a player.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player'; // the mock's `connected` id
const players = [{ id: 'host', name: 'HOST', lives: 3 }, { id: 'p2', name: 'TWO', lives: 3 }];

for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
  test(`${vp.width}: a late joiner watches, then is dealt in; the room code is on screen`, async ({ page }) => {
    await page.setViewportSize(vp);
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
  });
}
