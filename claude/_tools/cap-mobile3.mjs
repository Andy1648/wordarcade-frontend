// Verify the WB player-name fix at 360 + 390, and capture a couple menu screens at 360 to scan.
import { chromium } from '@playwright/test';
import fs from 'fs'; import path from 'path';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const OUT = process.argv[2] || 'claude/mobile-3/shots'; fs.mkdirSync(OUT, { recursive: true });
const ME = 'e2e-player';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVALPLAYER', lives: 2 }];
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
const b = await chromium.launch();
for (const [w, h] of [[360, 640], [390, 844]]) {
  // WB in-game (settled) — check the name row
  const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const mock = await installBackendMock(p);
  await p.goto('/?portal=1'); await waitImg(p);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } }); await p.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'str', usedWords: ['MONSTER', 'STRAP'], timerSeconds: 22 } });
  await p.waitForTimeout(4500);
  const names = await p.evaluate(() => Array.from(document.querySelectorAll('.game-player-name-text')).map(e => { const r = e.getBoundingClientRect(); return { text: e.textContent, h: Math.round(r.height), lineH: Math.round(parseFloat(getComputedStyle(e).lineHeight)) }; }));
  console.log(`[${w}x${h}] names=${JSON.stringify(names)}`);
  await p.locator('.game-player-bar').screenshot({ path: path.join(OUT, `wb-playerbar-${w}.png`) }).catch(() => {});
  await ctx.close();
}
await b.close();
