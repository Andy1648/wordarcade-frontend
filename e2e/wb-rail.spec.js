// e2e/wb-rail.spec.js (fix/visual-batch-1) — WORD BOMB standings rail with ≤2 players:
//   1. the USED WORDS block sits in the rail column (under the player cards) as a dashed
//      container, not under the prompt — and the bomb fills ≥55% of its grid cell at 1366×768;
//   2. with 3+ players nothing moves: the used row stays under the prompt in the centre column.
// The game is driven through the WebSocket mock exactly as game-fill.spec.js does.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
async function enterWordBomb(page, players) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: ['MONSTER', 'STRIDE'], timerSeconds: 22 } });
  await page.locator('.game-stage--wb').waitFor({ state: 'visible' });
  await page.waitForTimeout(4600); // let the 3-2-1-GO! countdown clear
}

const rect = (page, sel) => page.locator(sel).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
});

test.describe('word bomb rail @ 1366×768', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('≤2 players: used words live in the rail (dashed), the bomb fills ≥55% of its cell', async ({ page }) => {
    await enterWordBomb(page, [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }]);
    const [bar, used, combo, input, bomb] = await Promise.all([
      rect(page, '.game-player-bar'), rect(page, '.game-used'), rect(page, '.game-combo-box'),
      rect(page, '.game-input-row'), rect(page, '.bomb-svg'),
    ]);
    // In the rail column: same left edge as the player cards, no wider than the rail, below them.
    expect(Math.abs(used.left - bar.left)).toBeLessThan(2);
    expect(used.right).toBeLessThanOrEqual(bar.right + 2);
    expect(used.top).toBeGreaterThanOrEqual(bar.bottom - 1);
    // Not under the prompt any more — the prompt column starts to the right of the rail.
    expect(used.right).toBeLessThan(combo.left);
    // Dashed container that grows to the rail's foot (level with the input's bottom edge).
    const border = await page.locator('.game-used').evaluate((el) => getComputedStyle(el).borderTopStyle);
    expect(border).toBe('dashed');
    expect(Math.abs(used.bottom - input.bottom)).toBeLessThan(3);
    // The bomb's cell is the flexible row between the prompt and the input; ≥55% of it is bomb.
    const cell = input.top - combo.bottom;
    expect(bomb.height / cell, `bomb ${bomb.height}px of a ${cell}px cell`).toBeGreaterThanOrEqual(0.55);
    // And the bomb sits inside that cell (no overlap with the prompt or the input).
    expect(bomb.top).toBeGreaterThanOrEqual(combo.bottom - 1);
    expect(bomb.bottom).toBeLessThanOrEqual(input.top + 1);
  });

  test('3+ players: the used row stays under the prompt (unchanged)', async ({ page }) => {
    await enterWordBomb(page, [
      { id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }, { id: 'p3', name: 'THIRD', lives: 3 },
    ]);
    const [bar, used, combo, input] = await Promise.all([
      rect(page, '.game-player-bar'), rect(page, '.game-used'), rect(page, '.game-combo-box'), rect(page, '.game-input-row'),
    ]);
    expect(used.left).toBeGreaterThanOrEqual(bar.right); // centre column, not the rail
    expect(used.top).toBeGreaterThanOrEqual(combo.bottom); // under the prompt …
    expect(used.bottom).toBeLessThanOrEqual(input.top + 1); // … above the input
    const border = await page.locator('.game-used').evaluate((el) => getComputedStyle(el).borderTopStyle);
    expect(border).not.toBe('dashed');
  });
});
