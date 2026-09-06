// cap-pass.mjs — fix/ingame-pass before/after capture harness.
// Usage: node claude/_tools/cap-pass.mjs <outDir>   (e.g. claude/ingame-pass/shots/before)
// Requires the preview server on :4173 (vite build && vite preview --port 4173).
import { chromium } from '@playwright/test';
import fs from 'fs'; import path from 'path';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const OUT = process.argv[2]; if (!OUT) { console.error('need outDir'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173';
const ME = 'e2e-player';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }];
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });

async function shot(browser, w, h, name, fn, { reduce = false } = {}) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  let status = 'OK';
  try { const mock = await installBackendMock(page); await fn(page, mock); }
  catch (e) { status = 'FAIL: ' + String(e).split('\n')[0].slice(0, 110); }
  await page.waitForTimeout(150);
  try { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); } catch {}
  console.log(`${name.padEnd(26)} ${status}`);
  await ctx.close();
}

async function openSolo(p, game, extraQuery = '') {
  await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch {} });
  await p.goto(`/?portal=1&soloms=20000${extraQuery}`); await waitImg(p); await p.waitForTimeout(300);
  await p.locator(`.game-card-magnet[data-game="${game}"] .game-card`).click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
  await p.locator('.solo-root').waitFor();
}

const browser = await chromium.launch();
for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
  // CHAIN mid-play
  await shot(browser, w, h, `chain-play-${tag}`, async (p) => {
    await openSolo(p, 'chain');
    const i = p.locator('.solo-root input').first(); await i.waitFor(); await i.fill('e'); await p.waitForTimeout(700);
  });
  // FUSE mid-play
  await shot(browser, w, h, `fuse-play-${tag}`, async (p) => {
    await openSolo(p, 'fuse');
    const i = p.locator('.solo-root input').first(); await i.waitFor(); await i.fill('a'); await p.waitForTimeout(700);
  });
  // CHAIN game-over (die on first timeout; short clock)
  await shot(browser, w, h, `chain-over-${tag}`, async (p) => {
    await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch {} });
    await p.goto('/?portal=1&soloms=100'); await waitImg(p); await p.waitForTimeout(300);
    await p.locator('.game-card-magnet[data-game="chain"] .game-card').click({ force: true });
    await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
    const i = p.locator('.solo-root input').first(); await i.waitFor(); await i.fill('e'); // arm the clock
    await p.locator('.solo-over').waitFor({ timeout: 8000 }); await p.waitForTimeout(400);
  });
  // FUSE game-over (3 lives -> a few timeouts)
  await shot(browser, w, h, `fuse-over-${tag}`, async (p) => {
    await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch {} });
    await p.goto('/?portal=1&soloms=100'); await waitImg(p); await p.waitForTimeout(300);
    await p.locator('.game-card-magnet[data-game="fuse"] .game-card').click({ force: true });
    await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
    const i = p.locator('.solo-root input').first(); await i.waitFor(); await i.fill('a'); // arm the clock
    await p.locator('.solo-over').waitFor({ timeout: 12000 }); await p.waitForTimeout(400);
  });
  // WORD BOMB mid-play
  await shot(browser, w, h, `wb-play-${tag}`, async (p, mock) => {
    await p.goto('/?portal=1'); await waitImg(p);
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } }); await p.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(80);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'str', usedWords: ['MONSTER', 'STRAP'], timerSeconds: 22 } });
    await p.waitForTimeout(4600); // let the 3-2-1-GO! turn-start countdown fully clear
  });
}
// SAT surfaces (desktop only — keyboard mode)
await shot(browser, 1440, 900, 'sat-cover-desktop', async (p) => {
  await p.goto('/?satRush=1&portal=1'); await waitImg(p); await p.waitForTimeout(300);
  await p.locator('[data-game="sat-rush"] .game-card').click({ force: true }); await p.waitForTimeout(600);
  await p.locator('.sr-cover').waitFor({ timeout: 6000 }); await p.waitForTimeout(300);
});
await shot(browser, 1440, 900, 'sat-beat-desktop', async (p) => {
  await p.goto('/?satRush=1&portal=1'); await waitImg(p); await p.waitForTimeout(300);
  await p.locator('[data-game="sat-rush"] .game-card').click({ force: true }); await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Play' }).click(); await p.waitForTimeout(400);
  await p.locator('.sr-modeselect').waitFor({ timeout: 6000 }); await p.waitForTimeout(300);
});
await shot(browser, 1440, 900, 'sat-play-desktop', async (p) => {
  await p.goto('/?satRush=1&portal=1'); await waitImg(p); await p.waitForTimeout(300);
  await p.locator('[data-game="sat-rush"] .game-card').click({ force: true }); await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Play' }).click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /BRIEFING/ }).click(); await p.waitForTimeout(600);
  await p.locator('.sr-brief-page').waitFor({ timeout: 6000 });
  await p.getByRole('button', { name: 'Start the run' }).click();
  await p.locator('.sr-slots').waitFor({ timeout: 8000 }); await p.waitForTimeout(1500);
});
// WORD BOMB game-over under reduced motion — reproduce the "GO!" splash freeze over the win panel
for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
  await shot(browser, w, h, `wb-over-rm-${tag}`, async (p, mock) => {
    await p.goto('/?portal=1'); await waitImg(p);
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } }); await p.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(80);
    // turn_update fires the 3-2-1/GO! turn-start splash; game_over lands right on top of it.
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'str', usedWords: ['MONSTER', 'STRAP'], timerSeconds: 22 } }); await p.waitForTimeout(120);
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
    await p.locator('.game-over-overlay').waitFor({ timeout: 6000 }); await p.waitForTimeout(700);
  }, { reduce: true });
}
await browser.close();
console.log('\nshots ->', OUT);
