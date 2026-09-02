// JOB C reconcile verification: optimistic accept, then each server verdict.
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const ME = 'e2e-player';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }];
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor();

async function reach(p, mock) {
  await p.goto('/?portal=1'); await waitImg(p);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } }); await p.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(60);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 30 } });
  await p.waitForTimeout(3200);
}
async function fresh() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); const mock = await installBackendMock(p); await reach(p, mock);
  return { b, p, mock };
}
async function submitWord(p, mock, word) {
  const input = p.locator('.game-input'); await input.waitFor(); await input.fill(word);
  await input.press('Enter'); await mock.waitForSent('submit_word');
}

// Case A — not_a_word rollback
{
  const { b, p, mock } = await fresh();
  await submitWord(p, mock, 'cat');
  const optimistic = await p.locator('.wb-pending-accept').isVisible();
  mock.pushToClient({ type: 'word_result', payload: { accepted: false, word: 'cat', reason: 'not_a_word' } });
  await p.locator('.wb-pending-reject').waitFor({ timeout: 3000 }).catch(() => {});
  const tag = (await p.locator('.wb-pending-reject .wb-pending-tag').textContent().catch(() => '')) || '';
  const restored = await p.locator('.game-input').inputValue();
  console.log(`A not_a_word: optimisticAccept=${optimistic} -> rejectChip="${tag.trim()}" wordRestored="${restored}"`);
  await b.close();
}
// Case B — already_used race -> "SOMEONE ELSE JUST USED THAT"
{
  const { b, p, mock } = await fresh();
  await submitWord(p, mock, 'bat');
  const optimistic = await p.locator('.wb-pending-accept').isVisible();
  mock.pushToClient({ type: 'word_result', payload: { accepted: false, word: 'bat', reason: 'already_used' } });
  await p.locator('.wb-pending-reject').waitFor({ timeout: 3000 }).catch(() => {});
  const tag = (await p.locator('.wb-pending-reject .wb-pending-tag').textContent().catch(() => '')) || '';
  console.log(`B already_used(race): optimisticAccept=${optimistic} -> rejectChip="${tag.trim()}"`);
  await b.close();
}
// Case C — accept confirm stays accepted (no rollback, no crash)
{
  const { b, p, mock } = await fresh();
  await submitWord(p, mock, 'rat');
  const optimistic = await p.locator('.wb-pending-accept').isVisible();
  mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'rat' } });
  await p.waitForTimeout(400);
  const stillAccept = await p.locator('.wb-pending-accept').isVisible();
  const anyReject = await p.locator('.wb-pending-reject').count();
  const errs = await p.evaluate(() => window.__errs || 0);
  console.log(`C accept-confirm: optimisticAccept=${optimistic} stillAccept=${stillAccept} rejectChips=${anyReject} consoleErrs=${errs}`);
  await b.close();
}
