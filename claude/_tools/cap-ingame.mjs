// cap-ingame.mjs — Job 6: capture all five modes MID-PLAY (and SAT results) via the mock.
// Real motion (no reducedMotion) so turn-start splashes clear; screenshot after they settle.
// Usage: node cap-ingame.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs'; import path from 'path';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173';
const ME = 'e2e-player';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }];
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });

async function shot(browser, w, h, name, fn) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  let status = 'OK';
  try { const mock = await installBackendMock(page); await fn(page, mock); }
  catch (e) { status = 'FAIL: ' + String(e).split('\n')[0].slice(0, 90); }
  await page.waitForTimeout(200);
  try { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); } catch {}
  console.log(`${name.padEnd(22)} ${status}`);
  await ctx.close();
}

const browser = await chromium.launch();
for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
  // WORD BOMB mid-play
  await shot(browser, w, h, `wb-play-${tag}`, async (p, mock) => {
    await p.goto('/?portal=1'); await waitImg(p);
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } }); await p.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(80);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'str', usedWords: ['MONSTER', 'STRAP'], timerSeconds: 22 } });
    await p.waitForTimeout(1700); // let the GO! turn-start splash clear
  });
  // CATEGORY BLITZ mid-play
  await shot(browser, w, h, `blitz-play-${tag}`, async (p, mock) => {
    const players = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
    await p.goto('/?portal=1'); await waitImg(p);
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players } }); await p.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } }); await p.waitForTimeout(80);
    mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 45, category: 'CRYPTIDS & FOLKLORE MONSTERS', categoryId: 'cryptids', rerollsRemaining: 1 } });
    await p.waitForTimeout(300);
    mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: 'MOTHMAN' } }); await p.waitForTimeout(1400);
  });
  // CHAIN mid-play (long clock so it doesn't die; arm it)
  await shot(browser, w, h, `chain-play-${tag}`, async (p) => {
    await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch {} });
    await p.goto('/?portal=1&soloms=20000'); await waitImg(p); await p.waitForTimeout(300);
    await p.locator('.game-card-magnet[data-game="chain"] .game-card').click({ force: true });
    await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
    await p.locator('.solo-root').waitFor();
    const i = p.locator('.solo-root input').first(); await i.waitFor(); await i.fill('e'); await p.waitForTimeout(700);
  });
  // FUSE mid-play
  await shot(browser, w, h, `fuse-play-${tag}`, async (p) => {
    await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch {} });
    await p.goto('/?portal=1&soloms=20000'); await waitImg(p); await p.waitForTimeout(300);
    await p.locator('.game-card-magnet[data-game="fuse"] .game-card').click({ force: true });
    await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
    await p.locator('.solo-root').waitFor();
    const i = p.locator('.solo-root input').first(); await i.waitFor(); await i.fill('a'); await p.waitForTimeout(700);
  });
  // SAT RUSH mid-play — best-effort through card → (dialog?) → modeselect/briefing → play
  await shot(browser, w, h, `sat-play-${tag}`, async (p) => {
    await p.goto('/?satRush=1&portal=1'); await waitImg(p); await p.waitForTimeout(300);
    await p.locator('[data-game="sat-rush"]').click({ force: true }); await p.waitForTimeout(500);
    // If a mode-dialog gates it, CREATE through it.
    const dlg = p.locator('.mode-dialog-btn-create');
    if (await dlg.count()) { await dlg.first().click().catch(() => {}); await p.waitForTimeout(400); }
    // If a SAT mode-select appears, pick the first mode.
    const ms = p.locator('.sr-modeselect .sr-mode, .sr-modeselect button');
    if (await ms.count()) { await ms.first().click().catch(() => {}); await p.waitForTimeout(400); }
    // If a briefing appears, advance it.
    const go = p.getByRole('button', { name: /START|BEGIN|GO|PLAY|READY/i });
    if (await go.count()) { await go.first().click().catch(() => {}); }
    await p.waitForTimeout(1500);
  });
}
await browser.close();
console.log('\nshots ->', OUT);
