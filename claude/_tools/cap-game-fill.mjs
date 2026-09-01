// cap-game-fill.mjs — screenshot WB / BLITZ / SAT at the fill viewports + report stage fill + overflow.
import { chromium } from '@playwright/test';
import fs from 'fs'; import path from 'path';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const OUT = process.argv[2] || 'claude/ingame-pass/shots/fill-after'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173';
const ME = 'e2e-player';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }];
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
const VPS = [[1920, 1080], [1568, 675], [1366, 768], [1280, 551], [390, 844]];
async function openWB(p, mock, type) {
  const players = type === 'word-bomb' ? wbPlayers : [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
  await p.goto('/?portal=1'); await waitImg(p);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: type, hostId: ME, difficultyKey: 'chill', players } }); await p.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: type } }); await p.waitForTimeout(60);
  if (type === 'word-bomb') mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: ['MONSTER'], timerSeconds: 22 } });
  else mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 45, category: 'CRYPTIDS & FOLKLORE MONSTERS', categoryId: 'cryptids', rerollsRemaining: 1 } });
  await p.waitForTimeout(4600);
}
async function openSAT(p) {
  await p.goto('/?satRush=1&portal=1'); await waitImg(p); await p.waitForTimeout(250);
  await p.locator('[data-game="sat-rush"] .game-card').click({ force: true }); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Play' }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /BRIEFING/ }).click(); await p.waitForTimeout(400);
  await p.locator('.sr-brief-page').waitFor({ timeout: 6000 });
  await p.getByRole('button', { name: 'Start the run' }).click();
  await p.locator('.sr-slots').waitFor({ timeout: 8000 }); await p.waitForTimeout(600);
}
const SCREENS = [
  ['word-bomb', '.game-stage', (p, m) => openWB(p, m, 'word-bomb')],
  ['blitz', '.game-stage', (p, m) => openWB(p, m, 'category-blitz')],
  ['sat', '.sr-stage', (p) => openSAT(p)],
];
const b = await chromium.launch();
for (const [w, h] of VPS) {
  for (const [name, sel, nav] of SCREENS) {
    const ctx = await b.newContext({ baseURL: BASE, viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); const mock = await installBackendMock(p);
    let info = '?';
    try {
      await nav(p, mock);
      info = await p.evaluate((sel) => {
        const el = document.querySelector(sel); const r = el.getBoundingClientRect();
        const de = document.documentElement;
        const vOver = Math.max(de.scrollHeight, document.body.scrollHeight) > de.clientHeight + 2;
        return { fw: +(r.width / innerWidth * 100).toFixed(1), fh: +(r.height / innerHeight * 100).toFixed(1), w: Math.round(r.width), vScroll: vOver };
      }, sel);
      await p.screenshot({ path: path.join(OUT, `${name}-${w}x${h}.png`) });
    } catch (e) { info = 'ERR ' + String(e).split('\n')[0].slice(0, 60); }
    console.log(`${name}-${w}x${h}`.padEnd(20), JSON.stringify(info));
    await ctx.close();
  }
}
await b.close();
