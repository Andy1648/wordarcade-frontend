// e2e/failure-states.spec.js — Batch A (Andy oct2): failure states lose NO wins.
//   WS DROP mid-game  — words already accepted are banked PER WORD (the 3-word gate releases them), so
//                       a socket that dies before game_over takes nothing with it; the app shows its
//                       reconnect state, never NaN, and the balance survives a reload.
//   OFFLINE           — a whole solo run (CHAIN) with the network OFF banks its wins locally; nothing
//                       network-bound (leaderboard, cloud save, analytics) can break or roll it back.
//   COLD START        — covered by server-waking.spec.js (queued intent fires on open) and
//                       cold-submit.spec.js (a word with no reply shows WAKING SERVER, never vanishes).
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const ME = 'e2e-player';
const wins = (page) => page.evaluate(() => Number(localStorage.getItem('taw.wins')) || 0);

test('WS drop mid-game: the words already accepted stay banked, through the drop and a reload', async ({ page }) => {
  await page.addInitScript(() => { window.__TAW_LUCKY = 'off'; window.__TAW_RARE_POP = 'off'; });
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  const before = await wins(page);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 3 }];
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'at', usedWords: [], timerSeconds: 30 } });
  await page.waitForTimeout(60);
  for (const w of ['CAT', 'BAT', 'HAT', 'RAT']) {
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w } });
    await page.waitForTimeout(40);
  }
  await expect.poll(async () => (await wins(page)) - before, { timeout: 5000 }).toBeGreaterThan(0);
  // Let every accepted word finish banking (rarity-gated scoring can land a word a beat later) —
  // the claim is "nothing is LOST", so snapshot only once the balance has settled.
  let banked = await wins(page);
  for (let stable = 0; stable < 3;) {
    await page.waitForTimeout(300);
    const now = await wins(page);
    stable = now === banked ? stable + 1 : 0;
    banked = now;
  }
  // The socket dies (school-wifi blip / server restart) before any game_over.
  mock.dropClient();
  await page.waitForTimeout(1500);
  expect(await wins(page), 'nothing un-banked by the drop').toBeGreaterThanOrEqual(banked);
  expect(await page.locator('body').innerText()).not.toMatch(/NaN|undefined|Infinity/);
  await page.reload();
  await page.waitForTimeout(1500);
  expect(await wins(page), 'the banked wins survive a reload').toBeGreaterThanOrEqual(banked);
});

const OPENER = { a: 'above', b: 'before', c: 'change', d: 'double', e: 'engine', f: 'future', g: 'generate', h: 'handle', i: 'include', l: 'large', m: 'manage', n: 'notice', o: 'office', p: 'people', r: 'remove', s: 'service', t: 'there', w: 'where' };

test('OFFLINE: a whole CHAIN run with the network off banks its wins and throws nothing', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('off.seeded')) return;
    sessionStorage.setItem('off.seeded', '1');
    for (const [k, v] of Object.entries({ 'taw.chain.runs': '5', 'taw.seenMenuSpotlight': '1', 'taw.seenGameSpotlight': '1', 'taw.seenMenu': '1', wa_has_played: '1', 'taw.lb.profile': JSON.stringify({ id: 'x', username: 'Off_Line' }) })) localStorage.setItem(k, v);
  });
  await page.goto('/?chain=1&portal=1');
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });
  await context.setOffline(true);
  const before = await wins(page);
  const pool = ['estate', 'elite', 'escape', 'expense'];
  for (let i = 0; i < 4; i += 1) {
    const letter = ((await page.locator('.solo-center').first().innerText()).trim()).toLowerCase().slice(0, 1);
    const input = page.locator('.solo-input');
    await input.fill(i === 0 ? OPENER[letter] : pool.shift());
    await input.press('Enter');
    await expect(input).toHaveValue('', { timeout: 5000 });
  }
  await page.locator('.solo-over').waitFor({ state: 'visible', timeout: 45000 });
  await expect.poll(async () => (await wins(page)) - before, { timeout: 5000 }).toBeGreaterThan(0);
  const banked = await wins(page);
  await page.waitForTimeout(1500); // anything network-bound (board submit, cloud backup) fails now
  expect(await wins(page), 'no network failure rolls the run back').toBe(banked);
  expect(errors, 'no uncaught errors offline').toEqual([]);
  await context.setOffline(false);
});
