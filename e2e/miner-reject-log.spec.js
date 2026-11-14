// e2e/miner-reject-log.spec.js — MINER's refused answers join THE REJECT LOG (Andy nov12: "use the reject_log, add
// MINER"). MINER judges with the Blitz lists, so a NOT ON THE LIST answer is logged as mode 'blitz' with the round's
// list name as ctx — the same rows the accept lists already grow from. Accepted answers and other refusals are not.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

test('a MINER answer refused as not on the list is logged against its list; nothing else is', async ({ page }) => {
  const calls = [];
  const mock = await installBackendMock(page);
  // after the mock: Playwright tries the LAST route first, and the mock's own catch-all would swallow it
  await page.route('**/rpc/log_rejects', async (route) => {
    calls.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 204, body: '' });
  });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  const miners = [{ id: 'e2e-player', name: 'ME', isBot: false, depth: 0, lives: 3 }, { id: 'p2', name: 'BOT', isBot: true, depth: 0, lives: 3 }];
  mock.pushToClient({ type: 'room_update', payload: { code: 'MINES', gameType: 'miner', hostId: 'e2e-player', players: miners.map((m) => ({ id: m.id, name: m.name })) } });
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'miner' } });
  const now = Date.now();
  mock.pushToClient({ type: 'miner_start', payload: { miners, target: 500, lives: 3, serverNow: now, goAt: now } });
  mock.pushToClient({ type: 'miner_round', payload: { round: 1, prompt: 'Famous athletes', ask: 'FAMOUS ATHLETE', endsAt: now + 15000, roundMs: 15000, serverNow: now } });
  await page.locator('.mn-run').first().waitFor({ timeout: 15000 });
  mock.pushToClient({ type: 'miner_result', payload: { accepted: false, answer: 'zorbo flimwick', reason: 'not_on_list' } });
  mock.pushToClient({ type: 'miner_result', payload: { accepted: false, answer: 'ab', reason: 'too_short' } });
  mock.pushToClient({ type: 'miner_result', payload: { accepted: true, answer: 'lebron james', ore: 'dirt', depth: 1 } });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect.poll(() => calls.length, { timeout: 10000 }).toBeGreaterThan(0);
  expect(calls).toEqual([{ p_mode: 'blitz', p_words: ['zorbo flimwick'], p_ctx: 'Famous athletes' }]);
});
