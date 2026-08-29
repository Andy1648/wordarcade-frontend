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
  test('3 accepted words pay out at game_over (140 @ R0)', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const before = await readWins(page);
    await startMyTurn(mock, page, { combo: 'at' });
    for (const w of ['CAT', 'BAT', 'HAT']) {
      mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w } });
      await page.waitForTimeout(40);
    }
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
    // Rarity-weighted payout (unified economy, Job 1 — a rarer word pays more). Wins ride the rarity
    // WEIGHT, not a flat per-word count:
    //   CAT COMMON ×1.0 + BAT UNCOMMON ×1.5 + HAT COMMON ×1.0 = 3.5 weight
    //   × 40 perWordWins (base 20 × WB 2 × chill 1 × R0 1 × wordSense T0 1) = round10(140) = 140
    // (Was 70 pre-rebalance at WB ×1; sim/rebalance-2 raised Word Bomb to ×2. BAT is genuinely UNCOMMON.)
    // Poll for the payout instead of a fixed wait: each accepted word banks via bankWordWins →
    // localStorage on the async React drain, so a fixed sleep occasionally reads a pre-bank value.
    await expect.poll(async () => (await readWins(page)).wins - before.wins, { timeout: 5000 }).toBe(140);
    const after = await readWins(page);
    expect(after.lifetime - before.lifetime).toBe(140);
    expect(after.wb - before.wb).toBe(1);
  });

  // §2: wins must BANK PER ACCEPTED WORD so leaving mid-game never forfeits them, and the
  // (now removed) end-of-game payout must not double-pay when game_over does arrive.
  test('LEAVE MID-GAME: 5 words bank per-word without game_over, and game_over does not double-pay', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const before = await readWins(page);
    await startMyTurn(mock, page, { combo: 'at' });
    for (const w of ['CAT', 'BAT', 'HAT', 'RAT', 'MAT']) {
      mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w } });
      await page.waitForTimeout(40);
    }
    // NO game_over — the player just walks away. The 5 words are already banked, rarity-weighted
    // (unified economy, Job 1 — not a flat 5 × 20):
    //   CAT ×1.0 + BAT UNCOMMON ×1.5 + HAT ×1.0 + RAT UNCOMMON ×1.5 + MAT UNCOMMON ×1.5 = 6.5 weight
    //   × 40 perWordWins (base 20 × WB 2 × chill 1 × R0 1 × wordSense T0 1) = round10(260) = 260
    // (Was 130 pre-rebalance at WB ×1; three of these five 3-letter words are UNCOMMON in the recall corpus.)
    await expect.poll(async () => (await readWins(page)).wins - before.wins, { timeout: 5000 }).toBe(260);
    expect((await readWins(page)).wb - before.wb).toBe(1);
    // Now the game ends for real — the removed end payout must add NOTHING (no double-pay).
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
    await page.waitForTimeout(250);
    const after = await readWins(page);
    expect(after.wins - before.wins).toBe(260); // still 260, not 520
    expect(after.lifetime - before.lifetime).toBe(260);
    expect(after.wb - before.wb).toBe(1); // still one round counted
  });

  test('a 2-word Word Bomb run banks NOTHING (under the 3-word gate)', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const before = await readWins(page);
    await startMyTurn(mock, page, { combo: 'at' });
    for (const w of ['CAT', 'BAT']) {
      mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w } });
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(250);
    const after = await readWins(page);
    expect(after.wins - before.wins).toBe(0);
    expect(after.lifetime - before.lifetime).toBe(0);
    expect(after.wb - before.wb).toBe(0);
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
    // Same three words as the happy path, so the same rarity-weighted total:
    //   CAT COMMON ×1.0 + BAT UNCOMMON ×1.5 + HAT COMMON ×1.0 = 3.5 weight × 40 = round10(140) = 140.
    // The point of THIS test is attribution under the turn_update race — all 3 must still score.
    // Poll for the payout (see the happy-path test): the fixed-wait read of the async game_over
    // payout was the intermittent-flake source, not the race logic itself.
    await expect.poll(async () => (await readWins(page)).wins - before.wins, { timeout: 5000 }).toBe(140);
  });

  test('a server already_used rejection shows a visible, specific message', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    await startMyTurn(mock, page, { combo: 'at' });
    mock.pushToClient({ type: 'word_result', payload: { accepted: false, reason: 'already_used', word: 'CAT' } });
    await expect(page.getByText('ALREADY USED — TRY AGAIN')).toBeVisible();
  });
});
