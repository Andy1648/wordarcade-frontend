// cap-screens.mjs — reach every screen/dialog/overlay/game-over via the e2e mock
// and screenshot it (desktop + mobile). Usage: node cap-screens.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs'; import path from 'path';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173';
const ME = 'e2e-player';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 0 }];
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });

// each surface: {name, mobile?, reach(page, mock)}
const SURFACES = [
  { name: 'menu', reach: async (p) => { await p.goto('/?portal=1'); await waitImg(p); } },
  { name: 'shop', reach: async (p) => { await p.goto('/?portal=1'); await waitImg(p); await p.locator('.homepage-nav-btn.is-shop').click(); await p.locator('.shop-panel').waitFor(); } },
  { name: 'stats', reach: async (p) => { await p.goto('/?portal=1'); await waitImg(p); await p.locator('.homepage-nav-btn.is-stats').click(); await p.locator('.stats-panel').waitFor(); } },
  { name: 'collection', reach: async (p) => { await p.goto('/?portal=1'); await waitImg(p); await p.locator('.homepage-nav-btn.is-stats').click(); await p.locator('.stats-overlay').waitFor(); await p.getByRole('tab', { name: 'COLLECTION' }).click(); await p.waitForTimeout(300); } },
  { name: 'achievements', reach: async (p) => { await p.goto('/?portal=1'); await waitImg(p); await p.locator('.homepage-nav-btn.is-stats').click(); await p.locator('.stats-overlay').waitFor(); await p.getByRole('tab', { name: 'ACHIEVEMENTS' }).click(); await p.waitForTimeout(300); } },
  { name: 'wb-dialog', reach: async (p) => { await p.goto('/?portal=1'); await waitImg(p); await p.locator('.game-card-magnet[data-game="word-bomb"] .game-card').click({ force: true }); await p.locator('.mode-dialog-shell').waitFor(); } },
  { name: 'blitz-dialog-packpicker', reach: async (p) => { await p.goto('/?portal=1'); await waitImg(p); await p.locator('.game-card-magnet[data-game="category-blitz"] .game-card').click({ force: true }); await p.locator('.mode-dialog-shell').waitFor(); await p.waitForTimeout(300); } },
  { name: 'chain-locked', reach: async (p) => { await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 1, into: 0 })); } catch {} }); await p.goto('/?portal=1'); await waitImg(p); await p.locator('.game-card-magnet[data-game="chain"] .game-card').click({ force: true }); await p.waitForTimeout(400); } },
  { name: 'fuse-locked', reach: async (p) => { await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 1, into: 0 })); } catch {} }); await p.goto('/?portal=1'); await waitImg(p); await p.locator('.game-card-magnet[data-game="fuse"] .game-card').click({ force: true }); await p.waitForTimeout(400); } },
  { name: 'credits', reach: async (p) => { await p.goto('/?portal=1'); await waitImg(p); await p.locator('.homepage-credits-link').click(); await p.locator('.credits-wrap').waitFor(); } },
  { name: 'rooms-browser', reach: async (p) => { await p.goto('/?portal=1'); await waitImg(p); await p.locator('.homepage-btn-join').click(); await p.locator('.browser-wrap').waitFor(); } },
  { name: 'lobby', reach: async (p) => { await p.goto('/?portal=1'); await waitImg(p); await p.locator('.game-card-magnet[data-game="word-bomb"] .game-card').click({ force: true }); await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click(); await p.locator('.lobby-wrap').waitFor(); } },
  { name: 'room-waiting', reach: async (p, mock) => { await p.goto('/?portal=1'); await waitImg(p); mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: 'p1', difficultyKey: 'chill', players: [{ id: 'p1', name: 'YOU', lives: 3, isHost: true }] } }); await p.locator('.room-wrap').waitFor(); } },
  { name: 'wb-gameover', reach: async (p, mock) => {
      await p.goto('/?portal=1'); await waitImg(p);
      mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } }); await p.waitForTimeout(80);
      mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(80);
      mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 30 } }); await p.waitForTimeout(80);
      mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
      await p.locator('.game-over-overlay').waitFor(); await p.waitForTimeout(500); } },
  { name: 'blitz-gameover', reach: async (p, mock) => {
      const players = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
      await p.goto('/?portal=1'); await waitImg(p);
      mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players } }); await p.waitForTimeout(80);
      mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } }); await p.waitForTimeout(80);
      mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } }); await p.waitForTimeout(60);
      for (const a of ['APPLE', 'PEAR', 'PLUM']) { mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: a } }); await p.waitForTimeout(30); }
      mock.pushToClient({ type: 'game_over', payload: { winnerId: ME, finalScores: [{ id: ME, name: 'YOU', score: 30 }, { id: 'p2', name: 'RIVAL', score: 10 }] } });
      await p.locator('.game-over-overlay').waitFor(); await p.waitForTimeout(500); } },
  { name: 'chain-death', reach: async (p) => { await enterSolo(p, 'chain'); await p.locator('.solo-deathcard').waitFor({ timeout: 8000 }); await p.waitForTimeout(300); } },
  { name: 'fuse-death', reach: async (p) => { await enterSolo(p, 'fuse'); await p.locator('.solo-deathcard').waitFor({ timeout: 8000 }); await p.waitForTimeout(300); } },
  { name: 'sat-modeselect', reach: async (p) => { await p.goto('/?satRush=1&portal=1'); await waitImg(p); await p.locator('[data-game="sat-rush"]').click({ force: true }); await p.locator('.sr-modeselect').waitFor(); } },
];

async function enterSolo(page, id) {
  await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch {} });
  await page.goto('/?portal=1&soloms=350'); await waitImg(page); await page.waitForTimeout(400);
  await page.locator(`.game-card-magnet[data-game="${id}"] .game-card`).click({ force: true });
  await page.locator('.mode-dialog-shell').waitFor();
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor();
  const input = page.locator('.solo-root input').first();
  await input.waitFor(); await input.fill('a');
}

async function run(width, height, tag) {
  const browser = await chromium.launch();
  const log = [];
  for (const s of SURFACES) {
    if (tag === 'mobile' && s.mobileSkip) continue;
    const ctx = await browser.newContext({ baseURL: BASE, viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    let status = 'OK';
    try { const mock = await installBackendMock(page); await s.reach(page, mock); }
    catch (e) { status = 'REACH_FAIL: ' + String(e).split('\n')[0].slice(0, 80); }
    await page.waitForTimeout(250);
    try { await page.screenshot({ path: path.join(OUT, `${s.name}-${tag}.png`) }); } catch {}
    log.push(`${s.name.padEnd(24)} ${status}`);
    await ctx.close();
  }
  await browser.close();
  console.log(`\n[${tag} ${width}x${height}]`); log.forEach(l => console.log('  ' + l));
}

await run(1440, 900, 'desktop');
await run(390, 844, 'mobile');
console.log('\nshots ->', OUT);
