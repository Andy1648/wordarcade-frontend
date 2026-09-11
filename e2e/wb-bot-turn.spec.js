// e2e/wb-bot-turn.spec.js — feat/wb-bot-turn: the bot's turn is VISIBLE play. Measured warm, a
// bot turn is 2.3-4.3s and used to show only a dimmed "..." in its card. Frontend-only (the bot's
// word still arrives in the turn_update usedWords / broadcast word_result exactly as today):
//   1) While it's the bot's turn its card reads THINKING + a 3-dot ellipsis that advances one
//      dot per 400ms (opacity swap on three spans from ONE setInterval — no keyframes).
//   2) When the bot's word lands (word_result + turn_update in the SAME tick, as the server sends
//      them) the word is typed into the bot's card letter by letter at 45ms/char (<=500ms total)
//      BEFORE its used-words chip appears — >=3 intermediate lengths are observed while the chip
//      is still hidden.
//   3) 2-human rooms: the current opponent's card reads THEIR TURN, then TYPING… once a
//      typing_update arrives. Never silent.
//   4) No infinite animations: the stage's infinite-animation count during a bot turn is ZERO
//      (feat/wb-ring stilled the eight idle loops; the fuse is a transition, not a loop) and
//      none of the new status / typing / chip nodes introduces one.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const BOT = 'bot-1';
// feat/wb-ring stilled the Word Bomb stage: the eight idle loops this baseline used to
// record (bomb idle/flame/rattle, danger + tension vignettes, active-card pulse, resting-
// card rock, prompt throb, label pulse) are gone, and the fuse - a stroke-dashoffset
// TRANSITION off the turn clock, not a keyframe loop - is the only continuous motion
// left. So the correct baseline is now ZERO looping animations during a bot turn.
const INFINITE_BASELINE = 0;

async function enterGame(page, players) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  return mock;
}
const turn = (mock, players, currentPlayerId, usedWords) =>
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId, players, combo: 'str', usedWords, timerSeconds: 22, maxLives: 3 } });

const infiniteAnims = (page) =>
  page.evaluate(() =>
    document.getAnimations()
      .filter((a) => a.effect && a.effect.getTiming && a.effect.getTiming().iterations === Infinity)
      .map((a) => {
        const t = a.effect.target;
        const inNew = !!(t && t.closest && t.closest('.player-status, .player-typing, .game-used-chip'));
        return { name: a.animationName || '', inNew };
      })
  );

test('bot turn: THINKING + advancing dots; the landed word types into the card before its chip appears', async ({ page }) => {
  const players = [
    { id: ME, name: 'YOU', lives: 3, isHost: true },
    { id: BOT, name: 'BOT', lives: 3, isBot: true, botDifficulty: 'medium' },
  ];
  const mock = await enterGame(page, players);
  turn(mock, players, BOT, []);
  const botCard = page.locator('.game-player-card').nth(1);
  await expect(botCard).toContainText('THINKING');
  await page.waitForTimeout(4600); // let the 3-2-1-GO! countdown clear
  await expect(botCard).toContainText('THINKING');

  // (1) the ellipsis advances: the lit-dot count changes across samples 300ms apart.
  const lit = () => botCard.locator('.player-status-dots .dot.is-on').count();
  const samples = [];
  for (let i = 0; i < 4; i++) { samples.push(await lit()); await page.waitForTimeout(300); }
  expect(new Set(samples).size, `lit-dot samples ${samples.join(',')}`).toBeGreaterThan(1);

  // (4) no new infinite animations during the bot's turn.
  const anims = await infiniteAnims(page);
  expect(anims.filter((a) => a.inNew), 'infinite animations on the new nodes').toHaveLength(0);
  expect(anims.length, `stage infinite animations: ${anims.map((a) => a.name).join(',')}`).toBe(INFINITE_BASELINE);

  // (2) recorder: sample the bot card's readout length + chip visibility every ~8ms.
  await page.evaluate(() => {
    window.__rec = [];
    const card = document.querySelectorAll('.game-player-card')[1];
    window.__recId = setInterval(() => {
      const t = card.querySelector('.player-typing-text');
      const len = t ? t.textContent.replace(/\|/g, '').length : -1;
      const chip = document.querySelector('.game-used-chip');
      const chipVisible = !!chip && !chip.classList.contains('is-pending') && getComputedStyle(chip).opacity !== '0';
      const status = (card.querySelector('.player-status') || {}).textContent || '';
      window.__rec.push({ len, chipVisible, status: status.replace(/\./g, '').trim() });
    }, 8);
  });
  // The server's real sequence: broadcast accept, then the next turn_update, same tick.
  mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'STRIDENT' } });
  turn(mock, players, ME, ['strident']);
  await page.waitForTimeout(1400);
  const rec = await page.evaluate(() => { clearInterval(window.__recId); return window.__rec; });

  const beforeChip = rec.filter((r) => !r.chipVisible && r.len >= 0);
  const lens = [...new Set(beforeChip.map((r) => r.len))].sort((a, b) => a - b);
  const maxLen = Math.max(...rec.map((r) => r.len));
  const chipShown = rec.some((r) => r.chipVisible);
  const typingStatus = rec.some((r) => r.status === 'TYPING…' || r.status === 'TYPING');
  // eslint-disable-next-line no-console
  console.log(`[wb-bot-turn] samples=${rec.length} lengths-before-chip=${lens.join(',')} maxLen=${maxLen} chipShown=${chipShown} typingStatus=${typingStatus}`);
  expect(lens.filter((l) => l > 0 && l < 8).length, `intermediate lengths before the chip: ${lens.join(',')}`).toBeGreaterThanOrEqual(3);
  expect(maxLen, 'the full word was shown on the card').toBe(8);
  expect(chipShown, 'the chip appeared once the word had landed').toBe(true);
  expect(typingStatus, 'the card read TYPING… while the word typed out').toBe(true);
  // The chip is visible now and the reveal has cleared; it's my turn (no THINKING anywhere).
  await expect(page.locator('.game-used-chip').first()).toBeVisible();
  await expect(page.locator('.game-used-chip').first()).not.toHaveClass(/is-pending/);
  await expect(botCard).not.toContainText('THINKING');
  await expect(botCard.locator('.player-typing-text')).toHaveCount(0);
  await expect(page.locator('.game-your-turn')).toBeVisible();
});

test('2-human room: opponent card reads THEIR TURN, then TYPING… on a typing signal; my card is unchanged', async ({ page }) => {
  const players = [
    { id: ME, name: 'YOU', lives: 3, isHost: true },
    { id: 'p2', name: 'RIVAL', lives: 3 },
  ];
  const mock = await enterGame(page, players);
  turn(mock, players, 'p2', []);
  const rival = page.locator('.game-player-card').nth(1);
  await expect(rival).toContainText('THEIR TURN');
  await expect(rival).not.toContainText('THINKING');
  await page.waitForTimeout(4600);
  mock.pushToClient({ type: 'typing_update', payload: { playerId: 'p2', text: 'stro' } });
  await expect(rival).toContainText('TYPING');
  await expect(rival.locator('.player-typing-text')).toContainText('STRO');
  await expect(rival).not.toContainText('THEIR TURN');
  const anims = await infiniteAnims(page);
  expect(anims.filter((a) => a.inNew && a.name !== 'blink'), 'status line adds no infinite animation').toHaveLength(0);

  // My turn: my own card keeps the draft mirror + "..." placeholder, no status line.
  turn(mock, players, ME, []);
  const me = page.locator('.game-player-card').nth(0);
  await expect(page.locator('.game-your-turn')).toBeVisible();
  await expect(me.locator('.player-status')).toHaveCount(0);
  await expect(me.locator('.player-typing-empty')).toHaveText('...');
  await expect(rival.locator('.player-status')).toHaveCount(0);
});
