// RE-PINNED for the round-4 re-fit. WORD BOMB is back to x2 (the x2.1 of the previous round was
// only ever propping up the band FLOOR to reach SAT; SAT reaching parity removed the need). Every
// figure here is recomputed from the live table and then CONFIRMED by running the spec — never
// adjusted by hand, because bankWordWins snaps EACH per-word grant to a round 10 independently
// and the rounding residue does not follow the multiplier proportionally.
// ECONOMY v8 NOTE: wins are now the word's XP divided by ten, and the per-word BASE is the
// word's LETTERS at the player's key tier (T0 = 10 XP/letter) rather than a flat 100. So every
// figure here fell, and by DIFFERENT factors depending on how long the word is: a 3-letter Word
// Bomb word is 10 x 3 x mode2 / 10 = 6 wins, where v7 paid a flat 200. The WEIGHT arithmetic each
// test is actually about - the combo build, the lucky roll, the reset, the 3-word gate - is
// untouched; only the rate it multiplies. Each figure below is recomputed from the model and then
// CONFIRMED by running the spec, never adjusted by hand: bankWordWins rounds each grant
// independently, so the residue does not follow the multiplier proportionally.
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
  // Force the 1/40 lucky draw OFF so these exact-payout assertions stay deterministic. The combo
  // multiplier (parity: +0.1 per consecutive accept) IS live here, so payouts are the rarity ×
  // combo product — higher than the pre-parity rarity-only values, but still fully deterministic.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__TAW_LUCKY = 'off';
      window.__TAW_RARE_POP = 'off'; // the 1-in-750 MIDAS pop would land ~100 wins inside a delta
    });
  });

  test('3 accepted words pay out at game_over (25 @ T0/R0, combo-boosted)', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const before = await readWins(page);
    await startMyTurn(mock, page, { combo: 'at' });
    for (const w of ['CAT', 'BAT', 'HAT']) {
      mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w } });
      await page.waitForTimeout(40);
    }
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
    // Rarity × COMBO payout (parity: +0.1 combo per consecutive accept; lucky forced off above):
    //   CAT COMMON ×1.0 × combo1.1 + BAT UNCOMMON ×1.5 × combo1.2 + HAT COMMON ×1.0 × combo1.3
    //   = 4.2 weight × 6 perWordWins (T0 10 XP/letter × 3 letters × WB ×2 ÷ 10) = round(25.2) = 25
    // Poll for the payout instead of a fixed wait: each accepted word banks via bankWordWins →
    // localStorage on the async React drain, so a fixed sleep occasionally reads a pre-bank value.
    // ...plus the WINNER BONUS (O12): this player won, so game_over adds +50% of the game's 25 = 13.
    await expect.poll(async () => (await readWins(page)).wins - before.wins, { timeout: 5000 }).toBe(25 + 13);
    const after = await readWins(page);
    expect(after.lifetime - before.lifetime).toBe(25 + 13);
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
    //   combo 1.1..1.5 over the 5 accepts: CAT 1×1.1 + BAT 1.5×1.2 + HAT 1×1.3 + RAT 1.5×1.4 +
    //   MAT 1.5×1.5. All three-letter words, so 60 XP/word (10 XP/letter × 3 × WB ×2).
    //   WINS CARRY (PR #59): each grant is floor((XP + carried tenths) / 10), the rest carries:
    //     gate  4.2 × 60 = 252 XP        → +25, carry 2
    //     RAT   2.1 × 60 = 126 + 2 = 128 → +12, carry 8
    //     MAT  2.25 × 60 = 135 + 8 = 143 → +14, carry 3
    //   = 51 banked + 0.3 carried = 513 XP ÷ 10 exactly (the old per-grant rounding paid 52).
    await expect.poll(async () => (await readWins(page)).wins - before.wins, { timeout: 5000 }).toBe(51);
    expect(await page.evaluate(() => Number(localStorage.getItem('taw.winsCarry')) || 0)).toBe(3);
    expect((await readWins(page)).wb - before.wb).toBe(1);
    // H6 audit H1: the live HUD pill shows what was BANKED (51), not the plain-word estimate.
    await expect(page.locator('.wins-hud-plus')).toHaveText('+51');
    // Now the game ends for real — the words are NOT re-paid (no double-pay); the only addition is
    // the WINNER BONUS (O12), +50% of the 51 the game's words earned = 26.
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
    await page.waitForTimeout(250);
    const after = await readWins(page);
    expect(after.wins - before.wins).toBe(51 + 26); // banked per word + the winner bonus, nothing re-paid
    expect(after.lifetime - before.lifetime).toBe(51 + 26);
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
    // Same three words as the happy path, so the same rarity × combo total (combo is captured at
    // ACCEPT time, so it's unaffected by the rarity-index race): 4.2 × 6 = 25.
    // The point of THIS test is attribution under the turn_update race — all 3 must still score.
    // Poll for the payout (see the happy-path test): the fixed-wait read of the async game_over
    // payout was the intermittent-flake source, not the race logic itself.
    // ...plus the WINNER BONUS (O12), exactly as the happy path: game_over names ME the winner, so it
    // adds +50% of the game's 25 = 13. Expecting a bare 25 only ever passed when the poll happened to
    // read the balance in the instant BEFORE the bonus landed (CI flake on #129/#132/#133: received 38).
    await expect.poll(async () => (await readWins(page)).wins - before.wins, { timeout: 5000 }).toBe(25 + 13);
  });

  test('a server already_used rejection shows a visible, specific message', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    await startMyTurn(mock, page, { combo: 'at' });
    mock.pushToClient({ type: 'word_result', payload: { accepted: false, reason: 'already_used', word: 'CAT' } });
    await expect(page.getByText('ALREADY USED', { exact: true })).toBeVisible();
  });
});
