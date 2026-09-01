// WB + Blitz in-game, captured AFTER the turn/round-start countdown fully clears (~4.5s).
import { chromium } from '@playwright/test';
import fs from 'fs'; import path from 'path';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const ME = 'e2e-player';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }];
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
const b = await chromium.launch();
for (const [w, h, tag] of [[390, 844, 'mobile'], [1440, 900, 'desktop']]) {
  // WORD BOMB
  {
    const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); const mock = await installBackendMock(p);
    await p.goto('/?portal=1'); await waitImg(p);
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } }); await p.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(80);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'str', usedWords: ['MONSTER', 'STRAP'], timerSeconds: 22 } });
    await p.waitForTimeout(4500);
    await p.screenshot({ path: path.join(OUT, `wb-play-settled-${tag}.png`) });
    console.log(`wb-play-settled-${tag} OK`);
    await ctx.close();
  }
  // CATEGORY BLITZ
  {
    const players = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
    const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); const mock = await installBackendMock(p);
    await p.goto('/?portal=1'); await waitImg(p);
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players } }); await p.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } }); await p.waitForTimeout(80);
    mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 45, category: 'CRYPTIDS & FOLKLORE MONSTERS', categoryId: 'cryptids', rerollsRemaining: 1 } });
    await p.waitForTimeout(300);
    mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: 'MOTHMAN' } });
    await p.waitForTimeout(4500);
    await p.screenshot({ path: path.join(OUT, `blitz-play-settled-${tag}.png`) });
    console.log(`blitz-play-settled-${tag} OK`);
    await ctx.close();
  }
}
await b.close();
