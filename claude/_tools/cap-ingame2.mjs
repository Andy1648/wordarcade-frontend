import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const OUT = 'claude/_tools/shots-j6';
const BASE = 'http://localhost:4173';
const ME = 'e2e-player';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }];
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
const b = await chromium.launch();
async function shot(w, h, name, fn) {
  const ctx = await b.newContext({ baseURL: BASE, viewport: { width: w, height: h } });
  const p = await ctx.newPage(); let s = 'OK';
  try { const m = await installBackendMock(p); await fn(p, m); } catch (e) { s = 'FAIL ' + String(e).split('\n')[0].slice(0, 80); }
  try { await p.screenshot({ path: `${OUT}/${name}.png` }); } catch {}
  console.log(name.padEnd(22), s); await ctx.close();
}
// WB — wait out the 3-2-1-GO countdown
await shot(1440, 900, 'wb-play-desktop', async (p, m) => {
  await p.goto('/?portal=1'); await waitImg(p);
  m.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } }); await p.waitForTimeout(80);
  m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(80);
  m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'str', usedWords: ['MONSTER', 'STRAP'], timerSeconds: 22 } });
  await p.waitForTimeout(5000);
});
// BLITZ — wait out countdown
await shot(1440, 900, 'blitz-play-desktop', async (p, m) => {
  const players = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
  await p.goto('/?portal=1'); await waitImg(p);
  m.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players } }); await p.waitForTimeout(80);
  m.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } }); await p.waitForTimeout(80);
  m.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 45, category: 'CRYPTIDS & FOLKLORE MONSTERS', categoryId: 'cryptids', rerollsRemaining: 1 } });
  await p.waitForTimeout(600);
  m.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: 'MOTHMAN' } }); await p.waitForTimeout(4500);
});
// SAT — card → PICK YOUR BEAT → BRIEFING → play
await shot(1440, 900, 'sat-play-desktop', async (p) => {
  await p.goto('/?satRush=1&portal=1'); await waitImg(p); await p.waitForTimeout(300);
  await p.locator('[data-game="sat-rush"]').click({ force: true }); await p.waitForTimeout(600);
  await p.getByText('BRIEFING', { exact: false }).first().click().catch(() => {});
  await p.waitForTimeout(7000); // study window then into play
  await p.screenshot({ path: `${OUT}/sat-brief-desktop.png` }).catch(() => {});
  await p.waitForTimeout(4000);
});
await b.close();
