// re-capture wb-gameover after a long settle to distinguish transient countdown vs persistent dim
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const ME = 'e2e-player';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 0 }];
const b = await chromium.launch();
const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const p = await ctx.newPage(); const mock = await installBackendMock(p);
await p.goto('/?portal=1'); await p.getByRole('img', { name: 'Type a Word' }).waitFor();
mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } }); await p.waitForTimeout(80);
mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(80);
mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 30 } }); await p.waitForTimeout(80);
mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
await p.locator('.game-over-overlay').waitFor();
for (const ms of [500, 1500, 3000, 5000]) {
  await p.waitForTimeout(ms === 500 ? 500 : ms - (ms === 1500 ? 500 : ms === 3000 ? 1500 : 3000));
  await p.screenshot({ path: `claude/full-sweep/shots/wb-gameover-settle-${ms}.png` });
}
console.log('wb-gameover settle frames @ 500/1500/3000/5000ms');
await b.close();
