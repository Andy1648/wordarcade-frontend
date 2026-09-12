// e2e/sound-control.spec.js — EXACTLY ONE SOUND CONTROL, ON EVERY SCREEN.
//
// WHY THIS EXISTS. The app's one corner sound control is `position: fixed` at right:16/bottom:16,
// and on the Word Bomb board that is exactly where SEND and SKIP are — measured 20px of a
// decorative control on top of the button that costs a life, at 390x844 and 320x640. The fix was
// the one CLAUDE.md prescribes and the menu already uses: on the board, the fixed control is
// suppressed and the same component goes INLINE into the header cluster.
//
// That fix has two failure modes and they point in opposite directions, which is why this file
// counts rather than asserts presence:
//
//   TWO  — the board used to carry a SECOND speaker button of its own (`.game-mute-btn`) that
//          muted only the SFX engine, so two glyphs controlled two different sound systems. Its
//          toggle is now a row inside the one panel.
//   ZERO — the first version of the suppression keyed on `view === 'game'` for the whole view,
//          and three screens in that view render with NO header to host the inline control: the
//          "STARTING GAME..." placeholder, the multiplayer game-over scoreboard, and the solo
//          results card. All three lost their sound control entirely, and a player can sit on any
//          of them indefinitely. The suppression now keys on the BOARD being up (a game state,
//          not over), which is the only screen that actually has no room.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const players = [
  { id: ME, name: 'ANDY', lives: 3, isHost: true },
  { id: 'p1', name: 'RIVAL', lives: 3, isHost: false },
];

// Every sound control on the page, fixed or inline. One component, one class.
const countControls = (page) => page.locator('.audio-ctrl').count();

async function bootMenu(page) {
  const mock = await installBackendMock(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.seenGameSpotlight', '1'); } catch { /* blocked */ }
  });
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  return mock;
}

async function intoRoom(page, mock) {
  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players },
  });
  await page.waitForTimeout(80);
}

test('the MENU has exactly one, and it is the inline one in the corner nav', async ({ page }) => {
  await bootMenu(page);
  expect(await countControls(page)).toBe(1);
  expect(await page.locator('.audio-ctrl--inline').count()).toBe(1);
});

test('the ROOM screen has exactly one', async ({ page }) => {
  const mock = await bootMenu(page);
  await intoRoom(page, mock);
  expect(await countControls(page)).toBe(1);
});

test('the BOARD has exactly one, and it is INLINE in the header — not over SEND/SKIP', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = await bootMenu(page);
  await intoRoom(page, mock);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [], timerSeconds: 20, maxLives: 3 },
  });
  await page.waitForTimeout(4700);

  expect(await countControls(page)).toBe(1);
  expect(await page.locator('.game-header-actions .audio-ctrl--inline').count()).toBe(1);

  // ...and it is nowhere near the buttons it used to sit on.
  const hit = await page.evaluate(() => {
    const a = document.querySelector('.audio-ctrl');
    const px = (x, sel) => {
      const e = document.querySelector(sel);
      if (!e || !x) return 0;
      const p = x.getBoundingClientRect();
      const q = e.getBoundingClientRect();
      const ox = Math.min(p.right, q.right) - Math.max(p.left, q.left);
      const oy = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
      return ox > 0 && oy > 0 ? Math.round(Math.min(ox, oy)) : 0;
    };
    return {
      send: px(a, '.game-send-btn'),
      skip: px(a, '.game-skip-btn'),
      input: px(a, '.game-input'),
      leave: px(a, '.game-leave-btn'),
    };
  });
  expect(hit, 'the sound control overlaps a board control').toEqual({ send: 0, skip: 0, input: 0, leave: 0 });
});

test('the "STARTING GAME" placeholder still has one', async ({ page }) => {
  const mock = await bootMenu(page);
  await intoRoom(page, mock);
  // game_started with no turn_update yet: GameScreen renders the placeholder, which has no header.
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.locator('.game-loading').waitFor({ state: 'visible' });
  expect(await countControls(page)).toBe(1);
});

test('the GAME OVER scoreboard still has one', async ({ page }) => {
  const mock = await bootMenu(page);
  await intoRoom(page, mock);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [], timerSeconds: 20, maxLives: 3 },
  });
  await page.waitForTimeout(200);
  mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
  await page.locator('.game-over-overlay').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  expect(await countControls(page)).toBe(1);
});

test('the sound panel carries the GAME SFX toggle that the deleted header button owned', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const mock = await bootMenu(page);
  await intoRoom(page, mock);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [], timerSeconds: 20, maxLives: 3 },
  });
  await page.waitForTimeout(4700);
  await page.locator('.game-header-actions .audio-btn').click();
  const panel = page.locator('.audio-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('GAME SFX');
  await expect(panel).toContainText('MUSIC');
  // The panel opens DOWNWARD from a button at the top of the board and must stay on screen.
  const box = await panel.boundingBox();
  expect(box.y, 'the panel opens off the top').toBeGreaterThanOrEqual(0);
  expect(box.x, 'the panel opens off the left').toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, 'the panel opens off the right').toBeLessThanOrEqual(1366);
  expect(box.y + box.height, 'the panel opens off the bottom').toBeLessThanOrEqual(768);
});
