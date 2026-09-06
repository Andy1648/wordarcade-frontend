import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const ME = 'e2e-player';
const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 0 }];
const b = await chromium.launch();
for (const [w,h,tag] of [[1440,900,'desktop'],[390,844,'mobile']]) {
  const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport:{width:w,height:h}, reducedMotion:'reduce' });
  const p = await ctx.newPage(); const mock = await installBackendMock(p);
  await p.goto('/?portal=1'); await p.getByRole('img',{name:'Type a Word'}).waitFor();
  mock.pushToClient({ type:'room_update', payload:{ code:'ABCD', gameType:'word-bomb', hostId:ME, difficultyKey:'chill', players } }); await p.waitForTimeout(80);
  mock.pushToClient({ type:'game_started', payload:{ gameType:'word-bomb' } }); await p.waitForTimeout(80);
  mock.pushToClient({ type:'turn_update', payload:{ currentPlayerId:ME, players, combo:'at', usedWords:['CAT','HAT'], timerSeconds:30 } }); await p.waitForTimeout(80);
  mock.pushToClient({ type:'game_over', payload:{ winnerId:ME } });
  await p.locator('.game-over-overlay').waitFor(); await p.waitForTimeout(2500);
  await p.screenshot({ path:`claude/_tools/shots-j4/wb-gameover-settled-${tag}.png` });
  console.log('captured', tag); await ctx.close();
}
await b.close();
