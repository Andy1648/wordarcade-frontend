// e2e/word-bomb-scoring.spec.js
//
// Item-2 investigation harness: "a valid word didn't score." Drives a Word Bomb
// game over the mock WS the same way the real server would — game_started →
// turn_update (my turn, with the combo) → word_result(accepted) frames → game_over —
// and asserts the accepted words actually pay out. Also confirms a server rejection
// (already_used / not_a_word) surfaces a visible, specific message and never fails
// silently.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const ME = 'e2e-player'; // the id backendMock's `connected` frame assigns us

const readWins = (page) =>
  page.evaluate(() => {
    const num = (k) => Number(localStorage.getItem(k)) || 0;
    let wb = 0;
    try {
      wb = JSON.parse(localStorage.getItem('taw.rounds') || '{}').wordBomb || 0;
    } catch {
      wb = 0;
    }
    return { wins: num('taw.wins'), lifetime: num('taw.winsLifetime'), wb };
  });

// Drive into a Word Bomb game with it being MY turn.
async function startMyTurn(mock, page, { combo = 'at', usedWords = [] } = {}) {
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({
    type: 'turn_update',
    payload: {
      currentPlayerId: ME,
      players: [
        { id: ME, name: 'YOU', lives: 3, isHost: true },
        { id: 'p2', name: 'RIVAL', lives: 3 },
      ],
      combo,
      usedWords,
      timerSeconds: 30,
    },
  });
  await page.waitForTimeout(60);
}

test.describe('Word Bomb scoring (item 2)', () => {
  test('3 accepted words pay out at game_over (60 @ R0)', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const before = await readWins(page);
    await startMyTurn(mock, page, { combo: 'at' });
    for (const w of ['CAT', 'BAT', 'HAT']) {
      mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w } });
      await page.waitForTimeout(40);
    }
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
    await page.waitForTimeout(150);
    const after = await readWins(page);
    expect(after.wins - before.wins).toBe(60); // 3 × 20 per-word @ R0
    expect(after.lifetime - before.lifetime).toBe(60);
    expect(after.wb - before.wb).toBe(1);
  });

  // The race the task flagged: my accepted word_result arrives INTERLEAVED with a
  // turn_update that advances the turn. turn_update moves feedCurrentRef to the next
  // player, so counting by that pointer drops my word. Here we drive the REAL submit
  // path (so the app tracks my in-flight word), then push turn_update BEFORE my accept.
  // With the fix, the word is attributed to me by word-match and still scores.
  const input = (page) => page.locator('.game-input');
  async function typeSend(page, word) {
    await expect(input(page)).toBeEnabled({ timeout: 8000 }); // waits out the 3-2-1 countdown
    await input(page).fill(word);
    await page.locator('.game-send-btn').click();
  }
  const turnTo = (mock, who, used) => mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: who, players: [{ id: ME, name: 'YOU', lives: 3 }, { id: 'p2', name: 'RIVAL', lives: 3 }], combo: 'at', usedWords: used, timerSeconds: 30 },
  });

  test('RACE: turn_update just before my accepted word_result still scores', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const before = await readWins(page);
    await startMyTurn(mock, page, { combo: 'at' });
    // #1 CAT — submit for real, then a normal accept.
    await typeSend(page, 'CAT');
    await mock.waitForSent('submit_word');
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'CAT' } });
    await page.waitForTimeout(40);
    // #2 BAT — submit, then the ADVERSARIAL interleave: turn advances to p2 BEFORE my
    // accept for BAT lands. Pre-fix this dropped BAT (→ 2 words → under the 3-word gate → 0).
    await typeSend(page, 'BAT');
    turnTo(mock, 'p2', ['cat']);
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'BAT' } });
    await page.waitForTimeout(40);
    // #3 HAT — back to me.
    turnTo(mock, ME, ['cat', 'bat']);
    await typeSend(page, 'HAT');
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'HAT' } });
    await page.waitForTimeout(40);
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
    await page.waitForTimeout(150);
    const after = await readWins(page);
    expect(after.wins - before.wins).toBe(60); // all 3 mine → 60; pre-fix the race gave 0
  });

  test('a server already_used rejection shows a visible, specific message', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    await startMyTurn(mock, page, { combo: 'at' });
    mock.pushToClient({ type: 'word_result', payload: { accepted: false, reason: 'already_used', word: 'CAT' } });
    await expect(page.getByText('ALREADY USED — TRY AGAIN')).toBeVisible();
  });
});
