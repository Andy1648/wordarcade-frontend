// cap-gameover.mjs — screenshot all five game-over screens at desktop + mobile.
import { chromium } from '@playwright/test';
import fs from 'fs'; import path from 'path';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const OUT = process.argv[2] || 'claude/gameover-pass/shots'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173';
const ME = 'e2e-player';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 0 }];
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });

async function shot(browser, w, h, name, fn) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); let s = 'OK';
  try { const m = await installBackendMock(p); await fn(p, m); } catch (e) { s = 'FAIL ' + String(e).split('\n')[0].slice(0, 90); }
  await p.waitForTimeout(200);
  try { await p.screenshot({ path: path.join(OUT, `${name}.png`) }); } catch {}
  console.log(name.padEnd(22), s); await ctx.close();
}
const browser = await chromium.launch();
for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
  await shot(browser, w, h, `wb-over-${tag}`, async (p, m) => {
    await p.goto('/?portal=1'); await waitImg(p);
    m.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } }); await p.waitForTimeout(80);
    m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(80);
    m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: ['CAT', 'HAT'], timerSeconds: 30 } }); await p.waitForTimeout(80);
    m.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
    await p.locator('.game-over-overlay').waitFor({ timeout: 6000 }); await p.waitForTimeout(1400);
  });
  await shot(browser, w, h, `blitz-over-${tag}`, async (p, m) => {
    const players = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
    await p.goto('/?portal=1'); await waitImg(p);
    m.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players } }); await p.waitForTimeout(80);
    m.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } }); await p.waitForTimeout(80);
    m.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } }); await p.waitForTimeout(60);
    for (const a of ['APPLE', 'PEAR', 'PLUM']) { m.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: a } }); await p.waitForTimeout(30); }
    m.pushToClient({ type: 'game_over', payload: { winnerId: ME, finalScores: [{ id: ME, name: 'YOU', score: 30 }, { id: 'p2', name: 'RIVAL', score: 10 }] } });
    await p.locator('.game-over-overlay').waitFor({ timeout: 6000 }); await p.waitForTimeout(1400);
  });
  for (const g of ['chain', 'fuse']) {
    await shot(browser, w, h, `${g}-over-${tag}`, async (p) => {
      await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch {} });
      await p.goto('/?portal=1&soloms=100'); await waitImg(p); await p.waitForTimeout(300);
      await p.locator(`.game-card-magnet[data-game="${g}"] .game-card`).click({ force: true });
      await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
      const i = p.locator('.solo-root input').first(); await i.waitFor(); await i.fill(g === 'chain' ? 'e' : 'a');
      await p.locator('.solo-deathcard').waitFor({ timeout: 12000 }); await p.waitForTimeout(400);
    });
  }
}
// SAT results — desktop only; wait out three lives (no typing → spell-along walk-away misses).
await shot(browser, 1440, 900, 'sat-over-desktop', async (p) => {
  await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch {} });
  await p.goto('/?satRush=1&portal=1&stage=1200&spell=400'); await waitImg(p); await p.waitForTimeout(300);
  await p.locator('[data-game="sat-rush"] .game-card').click({ force: true }); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Play' }).click().catch(() => {});
  await p.getByRole('button', { name: /BRIEFING/ }).click().catch(() => {});
  await p.waitForTimeout(600);
  const start = p.getByRole('button', { name: 'Start the run' });
  if (await start.count()) await start.first().click().catch(() => {});
  // wait for results (3 lives to expire); poll up to ~40s
  try { await p.locator('.sr-respage').waitFor({ timeout: 45000 }); await p.waitForTimeout(600); }
  catch { /* leave whatever is on screen */ }
});
await browser.close();
