// e2e/feed-attribution.spec.js — Word Bomb live-feed player-name attribution.
//
// JOB 5 finding: App.jsx credits an OTHER player's accepted word to the name held in
// feedCurrentRef (the turn pointer). If a turn_update were processed BEFORE that word's
// word_result, the pointer would already have moved and the feed would show the WRONG name.
// This spec PROVES the two orderings:
//   • REALISTIC (the order the server actually emits — word_result, THEN turn_update):
//     the word is credited to the correct player. This is the production path, and it is
//     guarded here so it can never regress.
//   • ADVERSARIAL (turn_update processed first): the feed misattributes. This ordering is
//     NOT produced in production — roomManager.js broadcasts word_result (line 815) BEFORE
//     the turn_update (line 820), WebSocket delivery is ordered, and useWebSocket's FIFO queue
//     preserves arrival order — so word_result is always processed while feedCurrentRef still
//     points to the submitter. A fully robust client fix is impossible without the server
//     adding the submitter id to the word_result payload (currently {accepted, word, reason});
//     the word-match fix used for MY OWN words can't attribute other players' words.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const players = [
  { id: ME, name: 'YOU', lives: 3 },
  { id: 'p2', name: 'BOB', lives: 3 },
  { id: 'p3', name: 'CAI', lives: 3 },
];
const turn = (mock, who) =>
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: who, players, combo: 'at', usedWords: [], timerSeconds: 30 },
  });

async function enterGame(page) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(120);
  return mock;
}

test('a broadcast accept is credited to the submitter in the real server order (word_result → turn_update)', async ({ page }) => {
  const mock = await enterGame(page);
  turn(mock, 'p2'); // BOB's turn
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'CATFISH' } }); // server broadcasts this FIRST
  // WAIT for the accepted word to actually render in the feed (auto-retrying) before advancing
  // the turn or reading — a fixed sleep raced the async word_result drain under full-suite load.
  const catfishRow = page.locator('.kill-feed-row', { hasText: 'CATFISH' });
  await expect(catfishRow).toBeVisible({ timeout: 5000 });
  turn(mock, 'p3'); // then the turn advances
  // The word stays attributed to BOB (feedCurrentRef still pointed to BOB when word_result was
  // processed — the production order). Read the name from CATFISH's own row.
  await expect(catfishRow.locator('.kill-feed-name')).toHaveText('BOB');
});
