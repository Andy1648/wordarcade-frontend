import { test } from '@playwright/test';
import fs from 'fs';
import { installBackendMock, freezeAnimations } from './support/backendMock.js';

const AXE = 'node_modules/axe-core/axe.min.js';
test.use({ viewport: { width: 390, height: 844 } });

async function bootMenu(page, level = 40) {
  await installBackendMock(page);
  await page.addInitScript((lv) => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 })); localStorage.setItem('taw.wins', '999999'); localStorage.setItem('taw.winsLifetime', '999999'); } catch { /* */ } }, level);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
}
const card = (page, id) => page.locator(`.game-card-magnet[data-game="${id}"] .game-card`);
const ME = 'me';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 0 }];
async function bootRoom(page, gameType, players) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType, hostId: 'me', difficultyKey: 'chill', players } });
  return mock;
}

const SCREENS = [
  { name: 'menu', nav: (p) => bootMenu(p) },
  { name: 'dialog-word-bomb', nav: async (p) => { await bootMenu(p); await card(p, 'word-bomb').click(); await p.locator('.mode-dialog-shell').waitFor({ state: 'visible' }); } },
  { name: 'shop', nav: async (p) => { await bootMenu(p); await p.locator('.homepage-nav-btn.is-shop').click(); await p.locator('.shop-panel').waitFor({ state: 'visible' }); } },
  { name: 'stats', nav: async (p) => { await bootMenu(p); await p.locator('.homepage-nav-btn.is-stats').click(); await p.locator('.stats-panel').waitFor({ state: 'visible' }); } },
  { name: 'credits', nav: async (p) => { await bootMenu(p); await p.locator('.homepage-credits-link').click(); await p.locator('.credits-wrap').waitFor({ state: 'visible' }); } },
  { name: 'browser', nav: async (p) => { await bootMenu(p); await p.locator('.homepage-btn-join').click(); await p.locator('.browser-wrap').waitFor({ state: 'visible' }); } },
  { name: 'room', nav: async (p) => { await bootRoom(p, 'word-bomb', wbPlayers); await p.locator('.room-wrap').waitFor({ state: 'visible' }); } },
  { name: 'ingame-word-bomb', nav: async (p) => { const m = await bootRoom(p, 'word-bomb', wbPlayers); await p.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(80); m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 30 } }); await p.locator('.game-wrap').waitFor({ state: 'visible' }); } },
];

const all = { byScreen: {}, contrastByScreen: {} };

for (const s of SCREENS) {
  test(`axe ${s.name}`, async ({ page }) => {
    test.setTimeout(45000);
    await s.nav(page);
    await freezeAnimations(page);
    await page.waitForTimeout(200);
    await page.addScriptTag({ path: AXE });
    const res = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, { resultTypes: ['violations'] });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help }));
    });
    const contrast = res.filter((v) => v.id === 'color-contrast');
    const other = res.filter((v) => v.id !== 'color-contrast');
    // Keyboard/focus probe: count tabbable + any positive tabindex (a11y smell).
    const kb = await page.evaluate(() => {
      const tabbables = [...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]')].filter((e) => e.tabIndex >= 0 && e.offsetParent !== null);
      const positiveTab = [...document.querySelectorAll('[tabindex]')].filter((e) => Number(e.getAttribute('tabindex')) > 0).length;
      return { tabbable: tabbables.length, positiveTabindex: positiveTab };
    });
    all.byScreen[s.name] = other;
    all.contrastByScreen[s.name] = contrast.reduce((a, c) => a + c.n, 0);
    // eslint-disable-next-line no-console
    console.log(`AXE ${s.name} | non-contrast violations: ${JSON.stringify(other)} | contrast nodes: ${contrast.reduce((a, c) => a + c.n, 0)} | tabbable: ${kb.tabbable} positiveTabindex: ${kb.positiveTabindex}`);
    try { fs.writeFileSync('claude/_a11y-raw.json', JSON.stringify(all, null, 2)); } catch { /* */ }
  });
}
