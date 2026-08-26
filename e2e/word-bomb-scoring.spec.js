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
    // Poll for the payout instead of a fixed wait: game_over → recordRound → localStorage is an
    // async React drain, so a fixed sleep occasionally reads the pre-payout value (the flake).
    await expect.poll(async () => (await readWins(page)).wins - before.wins, { timeout: 5000 }).toBe(60);
    const after = await readWins(page);
    expect(after.lifetime - before.lifetime).toBe(60);
    expect(after.wb - before.wb).toBe(1);
  });

  // The race the task flagged: my accepted word_result arrives INTERLEAVED with a
  // turn_update that advances the turn. turn_update moves feedCurrentRef to the next
  // player, so counting by that pointer drops my word. Here we drive the REAL submit
  // path (so the app tracks my in-flight word), then push turn_update BEFORE my accept.
  // With the fix, the word is attributed to me by word-match and still scores.
  const input = (page) => page.locator('.game-input');
  // Type a word and submit it, then WAIT until the app has actually sent that word's submit_word
  // frame. That send is the moment handleSubmitWord runs, which is also when the word lands in
  // myOutstandingWordsRef — so blocking on it guarantees the word is in the outstanding queue
  // BEFORE the test pushes its word_result. (Not doing this for BAT/HAT was the flake: the
  // word_result could beat the submit registration, so the word wasn't matched and got dropped
  // under the 3-word gate → an intermittent 0/40 instead of 60.)
  async function typeSend(page, mock, word) {
    await expect(input(page)).toBeEnabled({ timeout: 8000 }); // waits out the 3-2-1 countdown
    await input(page).fill(word);
    await page.locator('.game-send-btn').click();
    await expect
      .poll(() => mock.sentFrames().some((f) => f && f.type === 'submit_word' && f.payload && f.payload.word === word), { timeout: 8000 })
      .toBe(true);
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
    // #1 CAT — submit for real (typeSend blocks until the submit is sent), then a normal accept.
    await typeSend(page, mock, 'CAT');
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'CAT' } });
    await page.waitForTimeout(40);
    // #2 BAT — submit (now guaranteed registered), THEN the ADVERSARIAL interleave: the turn
    // advances to p2 BEFORE my accept for BAT lands. The fix must still attribute BAT to me.
    await typeSend(page, mock, 'BAT');
    turnTo(mock, 'p2', ['cat']);
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'BAT' } });
    await page.waitForTimeout(40);
    // #3 HAT — back to me.
    turnTo(mock, ME, ['cat', 'bat']);
    await typeSend(page, mock, 'HAT');
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'HAT' } });
    await page.waitForTimeout(40);
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
    // Poll for the payout (see the happy-path test): the fixed-wait read of the async game_over
    // payout was the intermittent-flake source, not the race logic itself.
    await expect.poll(async () => (await readWins(page)).wins - before.wins, { timeout: 5000 }).toBe(60);
  });

  test('a server already_used rejection shows a visible, specific message', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    await startMyTurn(mock, page, { combo: 'at' });
    mock.pushToClient({ type: 'word_result', payload: { accepted: false, reason: 'already_used', word: 'CAT' } });
    await expect(page.getByText('ALREADY USED — TRY AGAIN')).toBeVisible();
  });
});
