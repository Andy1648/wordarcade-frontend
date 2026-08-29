// e2e/_shots.spec.js — JOB 2 visual-audit screenshots. Reuses viewport-integrity's tested
// nav() functions to reach every screen/state, screenshots each at 3 viewports into claude/shots/.
import { test } from '@playwright/test';
import { installBackendMock, freezeAnimations } from './support/backendMock.js';
import fs from 'fs';

const VPS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '390x844', width: 390, height: 844 },
];

async function bootMenu(page, level = 40, query = '?portal=1') {
  await installBackendMock(page);
  if (level != null) {
    await page.addInitScript((lv) => {
      try { localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 })); localStorage.setItem('taw.wins', '999999'); localStorage.setItem('taw.winsLifetime', '999999'); } catch { /* */ }
    }, level);
  }
  await page.goto(`/${query}`);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
}
const card = (page, id) => page.locator(`.game-card-magnet[data-game="${id}"] .game-card`);
async function bootRoom(page, gameType, players) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType, hostId: 'me', difficultyKey: 'chill', players } });
  return mock;
}
async function enterSolo(page, id) {
  await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* */ } });
  await installBackendMock(page);
  await page.goto('/?portal=1&soloms=350');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  await card(page, id).click({ force: true });
  await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor({ state: 'visible' });
}
const ME = 'me';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 0 }];
const cbPlayers = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];

const SCREENS = [
  { name: 'splash', nav: async (p) => { await installBackendMock(p); await p.goto('/'); await p.locator('.splash-screen').waitFor({ state: 'visible' }); await p.waitForTimeout(500); } },
  { name: 'menu', nav: async (p) => bootMenu(p, 40) },
  { name: 'dialog-word-bomb', nav: async (p) => { await bootMenu(p, 40); await card(p, 'word-bomb').click(); await p.locator('.mode-dialog-shell').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'dialog-category-blitz', nav: async (p) => { await bootMenu(p, 40); await card(p, 'category-blitz').click(); await p.locator('.ppp-picker').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'dialog-chain', nav: async (p) => { await bootMenu(p, 40); await card(p, 'chain').click(); await p.locator('.mode-dialog-shell').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'dialog-fuse', nav: async (p) => { await bootMenu(p, 40); await card(p, 'fuse').click(); await p.locator('.mode-dialog-shell').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'locked-chain', nav: async (p) => { await bootMenu(p, 1); await card(p, 'chain').click({ force: true }); await p.locator('.lp-panel').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'locked-fuse', nav: async (p) => { await bootMenu(p, 16); await card(p, 'fuse').click({ force: true }); await p.locator('.lp-panel').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'credits', nav: async (p) => { await bootMenu(p, 40); await p.locator('.homepage-credits-link').click(); await p.locator('.credits-wrap').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'shop', nav: async (p) => { await bootMenu(p, 40); await p.locator('.homepage-nav-btn.is-shop').click(); await p.locator('.shop-panel').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'shop-bottom', nav: async (p) => { await bootMenu(p, 40); await p.locator('.homepage-nav-btn.is-shop').click(); await p.locator('.shop-panel').waitFor({ state: 'visible' }); await p.locator('.shop-body').evaluate((e) => { e.scrollTop = e.scrollHeight; }); await p.waitForTimeout(350); } },
  { name: 'rebirth', nav: async (p) => { await bootMenu(p, 40); await p.locator('.homepage-nav-btn.is-rebirth').click(); await p.locator('.shop-panel').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'rebirth-confirm', nav: async (p) => { await bootMenu(p, 40); await p.locator('.homepage-nav-btn.is-rebirth').click(); await p.locator('.shop-panel').waitFor({ state: 'visible' }); const r = p.locator('.shop-rebirth'); if (await r.isEnabled().catch(() => false)) { await r.click(); } await p.waitForTimeout(350); } },
  { name: 'stats-1', nav: async (p) => { await bootMenu(p, 40); await p.locator('.homepage-nav-btn.is-stats').click(); await p.locator('.stats-panel').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'stats-2', nav: async (p) => { await bootMenu(p, 40); await p.locator('.homepage-nav-btn.is-stats').click(); await p.locator('.stats-panel').waitFor({ state: 'visible' }); await p.locator('.stats-tab').nth(1).click(); await p.waitForTimeout(350); } },
  { name: 'stats-3', nav: async (p) => { await bootMenu(p, 40); await p.locator('.homepage-nav-btn.is-stats').click(); await p.locator('.stats-panel').waitFor({ state: 'visible' }); await p.locator('.stats-tab').nth(2).click(); await p.waitForTimeout(350); } },
  { name: 'lobby', nav: async (p) => { await bootMenu(p, 40); await card(p, 'word-bomb').click(); await p.locator('.mode-dialog-btn-create').click(); await p.locator('.lobby-wrap').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'browser', nav: async (p) => { await bootMenu(p, 40); await p.locator('.homepage-btn-join').click(); await p.locator('.browser-wrap').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'room', nav: async (p) => { await bootRoom(p, 'word-bomb', wbPlayers); await p.locator('.room-wrap').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'ingame-word-bomb', nav: async (p) => { const m = await bootRoom(p, 'word-bomb', wbPlayers); await p.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(80); m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 30 } }); await p.locator('.game-wrap').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'ingame-category-blitz', nav: async (p) => { const m = await bootRoom(p, 'category-blitz', cbPlayers); await p.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } }); await p.waitForTimeout(80); m.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } }); await p.locator('.game-wrap').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'ingame-chain', nav: async (p) => { await enterSolo(p, 'chain'); await p.waitForTimeout(300); } },
  { name: 'ingame-fuse', nav: async (p) => { await enterSolo(p, 'fuse'); await p.waitForTimeout(300); } },
  { name: 'gameover-word-bomb', nav: async (p) => { const m = await bootRoom(p, 'word-bomb', wbPlayers); await p.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(80); m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 30 } }); await p.waitForTimeout(80); m.pushToClient({ type: 'game_over', payload: { winnerId: ME } }); await p.locator('.game-over-overlay').waitFor({ state: 'visible' }); await p.waitForTimeout(600); } },
  { name: 'gameover-category-blitz', nav: async (p) => { const m = await bootRoom(p, 'category-blitz', cbPlayers); await p.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } }); await p.waitForTimeout(80); m.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } }); await p.waitForTimeout(60); m.pushToClient({ type: 'game_over', payload: { winnerId: ME, finalScores: [{ id: ME, name: 'YOU', score: 30 }, { id: 'p2', name: 'RIVAL', score: 10 }] } }); await p.locator('.game-over-overlay').waitFor({ state: 'visible' }); await p.waitForTimeout(600); } },
  { name: 'gameover-chain', nav: async (p) => { await enterSolo(p, 'chain'); const i = p.locator('.solo-root input').first(); await i.waitFor({ state: 'visible' }); await i.fill('a'); await p.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 8000 }); await p.waitForTimeout(400); } },
  { name: 'gameover-fuse', nav: async (p) => { await enterSolo(p, 'fuse'); const i = p.locator('.solo-root input').first(); await i.waitFor({ state: 'visible' }); await i.fill('a'); await p.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 8000 }); await p.waitForTimeout(400); } },
  { name: 'sat-modeselect', nav: async (p) => { await installBackendMock(p); await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* */ } }); await p.goto('/?satRush=1&portal=1'); await p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' }); await p.waitForTimeout(400); await p.locator('[data-game="sat-rush"] .game-card').click(); await p.getByRole('button', { name: 'Play' }).click(); await p.locator('.sr-modeselect').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
  { name: 'sat-briefing', nav: async (p) => { await installBackendMock(p); await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* */ } }); await p.goto('/?satRush=1&portal=1'); await p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' }); await p.waitForTimeout(400); await p.locator('[data-game="sat-rush"] .game-card').click(); await p.getByRole('button', { name: 'Play' }).click(); await p.getByRole('button', { name: 'briefing' }).click(); await p.locator('.sr-brief-page').waitFor({ state: 'visible' }); await p.waitForTimeout(350); } },
];

for (const vp of VPS) {
  test.describe(`shots ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const s of SCREENS) {
      test(s.name, async ({ page }) => {
        test.setTimeout(45000);
        const dir = `claude/shots/${s.name}`;
        fs.mkdirSync(dir, { recursive: true });
        try {
          await s.nav(page);
          await freezeAnimations(page);
          await page.waitForTimeout(200);
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
          await page.screenshot({ path: `${dir}/${vp.name}.png` });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log(`SHOT FAIL ${s.name} @ ${vp.name}: ${String(e).split('\n')[0]}`);
          await page.screenshot({ path: `${dir}/${vp.name}_FAILED.png` }).catch(() => {});
        }
      });
    }
  });
}
