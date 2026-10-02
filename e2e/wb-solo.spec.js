// e2e/wb-solo.spec.js — feat/wb-solo: PLAY SOLO, menu to a live Word Bomb round vs a bot.
//
// Before: card → PLAY → name → CONTINUE → ADD BOT → pick bot → pick difficulty → START (8 taps).
// Now:    card → PLAY SOLO (2 taps). Counted here, not claimed: every click the spec makes between
// the menu and the live board goes through tap(), and the total is asserted.
//
// NO NEW PROTOCOL. The frames are the ones the server already handles (create_room / set_game_type
// / set_difficulty / add_bot / start_game), and start_game goes out only once a room_update shows
// the human AND the bot seated. The mock is the server here, so the spec plays its part: it answers
// the frames the way server.js does.
//
// NEVER PUBLIC. The server lists a room in `public_rooms` iff it was created with isPublic === true
// (server.js create_room → roomManager.listPublicRooms). The spec keeps that model: every room a
// page creates is recorded with the isPublic its create_room carried, and a SECOND player's JOIN
// browser is answered from it — alongside one genuinely public room, so an empty list cannot pass
// for a filtered one.
//
// At 1280x551, 1366x625 and 390x844: the PLAY SOLO button is fully on screen without scrolling,
// >= 44px tall, and no text inside it renders under 13px.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, modeEntry, joinControl } from './support/menu.js';

const VIEWPORTS = [
  { width: 1280, height: 551 },
  { width: 1366, height: 625 },
  { width: 390, height: 844 },
];

async function openMenu(page, { played }) {
  const mock = await installBackendMock(page);
  await page.addInitScript((wasPlayed) => {
    try {
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      if (wasPlayed) localStorage.setItem('wa_has_played', '1');
      else localStorage.removeItem('wa_has_played');
    } catch { /* storage blocked */ }
  }, played);
  await page.goto('/?portal=1');
  await menuReady(page);
  await expect.poll(() => mock.connectionAttempts(), { timeout: 15000 }).toBeGreaterThan(0);
  return mock;
}

for (const vp of VIEWPORTS) {
  for (const played of [false, true]) {
    const who = played ? 'returning player' : 'first-timer';
    test(`PLAY SOLO @ ${vp.width}x${vp.height}, ${who}: 2 taps to a live round, private, ${played ? 'MEDIUM' : 'CHILL'}`, async ({ page, browser }) => {
      await page.setViewportSize(vp);
      const mock = await openMenu(page, { played });
      let taps = 0;
      const tap = async (loc) => {
        taps += 1;
        await loc.click();
      };

      // TAP 1: the Word Bomb card / phone row → the mode dialog.
      await tap(modeEntry(page, 'word-bomb'));
      const solo = page.getByRole('button', { name: 'PLAY SOLO' });
      await expect(solo).toBeVisible();

      // The new entry: on screen with no scroll, a real touch target, readable text.
      const m = await solo.evaluate((btn) => {
        const r = btn.getBoundingClientRect();
        const small = [btn, ...btn.querySelectorAll('*')]
          .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
          .map((el) => parseFloat(getComputedStyle(el).fontSize))
          .filter((px) => px < 13);
        return {
          w: r.width, h: r.height,
          inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth,
          small,
        };
      });
      test.info().annotations.push({ type: 'solo-btn', description: JSON.stringify(m) });
      expect(m.h, 'PLAY SOLO height').toBeGreaterThanOrEqual(44);
      expect(m.w, 'PLAY SOLO width').toBeGreaterThanOrEqual(44);
      expect(m.inView, 'PLAY SOLO fully on screen without scrolling').toBe(true);
      expect(m.small, 'text under 13px inside PLAY SOLO').toEqual([]);

      // TAP 2: PLAY SOLO. No name screen, no lobby clicks follow.
      await tap(solo);
      const create = await mock.waitForSent('create_room', 10000);
      expect(create.payload.isPublic, 'create_room is PRIVATE').toBe(false);
      expect(typeof create.payload.name === 'string' && create.payload.name.length > 0, 'a saved/generated name, no prompt').toBe(true);
      await expect.poll(() => mock.sentTypes().filter((t) => ['create_room', 'set_game_type', 'set_difficulty', 'add_bot'].includes(t)))
        .toEqual(['create_room', 'set_game_type', 'set_difficulty', 'add_bot']);
      const frames = mock.sentFrames();
      expect(frames.find((f) => f.type === 'set_game_type').payload.gameType).toBe('word-bomb');
      expect(frames.find((f) => f.type === 'set_difficulty').payload.difficultyKey).toBe(played ? 'easy' : 'chill');
      expect(frames.find((f) => f.type === 'add_bot').payload.difficulty).toBe('medium');
      expect(mock.sentTypes(), 'no start_game before the bot is seated').not.toContain('start_game');

      // The server's replies, in the order server.js sends them.
      const code = 'SOLOX';
      const human = { id: 'e2e-player', name: create.payload.name, lives: 3, isHost: true };
      const bot = { id: 'bot-1', name: 'BOTTY', lives: 3, isBot: true };
      mock.pushToClient({ type: 'room_created', payload: { code } });
      mock.pushToClient({ type: 'room_update', payload: { code, gameType: 'word-bomb', hostId: human.id, difficultyKey: played ? 'easy' : 'chill', players: [human] } });
      await page.waitForTimeout(150);
      expect(mock.sentTypes(), 'still no start_game with only the human seated').not.toContain('start_game');
      mock.pushToClient({ type: 'room_update', payload: { code, gameType: 'word-bomb', hostId: human.id, difficultyKey: played ? 'easy' : 'chill', players: [human, bot] } });
      await mock.waitForSent('start_game', 10000);
      expect(mock.sentTypes().filter((t) => t === 'start_game'), 'start_game exactly once').toHaveLength(1);

      mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
      mock.pushToClient({
        type: 'turn_update',
        payload: { currentPlayerId: human.id, players: [human, bot], combo: 'ing', timerSeconds: 20, maxLives: 3, round: 1, difficultyKey: played ? 'easy' : 'chill', usedWords: [], usedAnswers: [] },
      });
      await expect(page.locator('.game-stage--wb')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.game-input')).toBeVisible();
      expect(taps, 'taps from the menu to a live round').toBe(2);

      // NEVER PUBLIC: a second player's JOIN browser, answered the way listPublicRooms answers.
      const rooms = [
        { code, isPublic: create.payload.isPublic === true, gameType: 'word-bomb', playerCount: 2 },
        { code: 'PUBLC', isPublic: true, gameType: 'word-bomb', playerCount: 1 }, // a real public room
      ];
      const ctx2 = await browser.newContext({ viewport: vp });
      const other = await ctx2.newPage();
      const mock2 = await openMenu(other, { played: true });
      await joinControl(other).click();
      await mock2.waitForSent('list_public_rooms', 10000);
      mock2.pushToClient({
        type: 'public_rooms',
        payload: {
          rooms: rooms.filter((r) => r.isPublic).map((r) => ({ code: r.code, gameType: r.gameType, playerCount: r.playerCount, maxPlayers: 8, status: 'waiting' })),
        },
      });
      await expect(other.locator('.browser-row')).toHaveCount(1);
      await expect(other.locator('body')).not.toContainText(code);
      await ctx2.close();
    });
  }
}
