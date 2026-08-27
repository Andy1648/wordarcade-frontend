// e2e/cold-submit.spec.js — fix/qa-sweep §5. Reproduces a COLD Word Bomb submit
// (server asleep ~20s → no word_result) via the mock-WS harness and proves the
// word shows a visible pending state: the in-flight chip appears immediately and,
// after 400ms of silence, escalates to a "WAKING SERVER…" state — never looking
// ignored. The mock simply NEVER sends word_result, standing in for the 20s wake.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player'; // matches the mock's auto `connected` id, so it's genuinely MY turn
const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 3 }];

test('cold submit: the word shows a pending → WAKING SERVER state (no response)', async ({ page }) => {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  // My turn, fragment "at".
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'at', usedWords: [], timerSeconds: 30 } });
  await expect(page.locator('.game-wrap')).toBeVisible();

  // Type a locally-valid word (>=3, contains "at", unused) and submit. The mock
  // NEVER replies — the cold wake.
  const input = page.locator('.game-input-row input').first();
  await input.waitFor({ state: 'visible' });
  await input.fill('cat');
  await input.press('Enter');

  // The in-flight chip shows the word immediately (well under 400ms).
  const chip = page.locator('.wb-pending');
  await expect(chip).toBeVisible({ timeout: 400 });
  await expect(page.locator('.wb-pending-word')).toHaveText('CAT');

  // After 400ms of silence it must escalate to the visible WAKING state (the fix).
  await expect(page.locator('.wb-pending-waiting')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('.wb-pending-waking')).toContainText('WAKING SERVER');

  // And it stays pending (never silently dropped) while the server is still asleep.
  await page.waitForTimeout(600);
  await expect(page.locator('.wb-pending-waiting')).toBeVisible();
});
