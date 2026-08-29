import { test } from '@playwright/test';
import { installBackendMock, freezeAnimations } from './support/backendMock.js';

const PORTRAIT = [
  { w: 320, h: 568 }, { w: 360, h: 640 }, { w: 375, h: 667 },
  { w: 390, h: 844 }, { w: 412, h: 915 }, { w: 430, h: 932 },
];
const LANDSCAPE = [{ w: 568, h: 320 }, { w: 667, h: 375 }, { w: 844, h: 390 }];

async function bootMenu(page, level = 40) {
  await installBackendMock(page);
  await page.addInitScript((lv) => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 })); localStorage.setItem('taw.wins', '999999'); localStorage.setItem('taw.winsLifetime', '999999'); } catch { /* */ } }, level);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
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
  { name: 'dialog-wb', nav: async (p) => { await bootMenu(p); await card(p, 'word-bomb').click(); await p.locator('.mode-dialog-shell').waitFor({ state: 'visible' }); } },
  { name: 'shop', nav: async (p) => { await bootMenu(p); await p.locator('.homepage-nav-btn.is-shop').click(); await p.locator('.shop-panel').waitFor({ state: 'visible' }); } },
  { name: 'stats', nav: async (p) => { await bootMenu(p); await p.locator('.homepage-nav-btn.is-stats').click(); await p.locator('.stats-panel').waitFor({ state: 'visible' }); } },
  { name: 'room', nav: async (p) => { await bootRoom(p, 'word-bomb', wbPlayers); await p.locator('.room-wrap').waitFor({ state: 'visible' }); } },
  { name: 'ingame-wb', nav: async (p) => { const m = await bootRoom(p, 'word-bomb', wbPlayers); await p.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await p.waitForTimeout(80); m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 30 } }); await p.locator('.game-wrap').waitFor({ state: 'visible' }); } },
];

async function probe(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const hscroll = Math.max(document.body.scrollWidth, de.scrollWidth) - de.clientWidth;
    const vscroll = de.scrollHeight - de.clientHeight;
    // Tap targets < 44px (interactive, visible). Report count + up to 3 worst.
    const sel = 'button,a[href],input,select,textarea,[role="button"],[tabindex="0"]';
    const els = [...document.querySelectorAll(sel)];
    const small = [];
    for (const e of els) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || e.offsetParent === null) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.width < 44 || r.height < 44) {
        const label = (e.getAttribute('aria-label') || e.textContent || e.className || e.tagName).trim().slice(0, 20);
        small.push(`${Math.round(r.width)}x${Math.round(r.height)}:${label}`);
      }
    }
    return { hscroll, vscroll, smallCount: small.length, worst: small.slice(0, 3) };
  });
}

for (const { w, h } of PORTRAIT) {
  test.describe(`portrait ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    for (const s of SCREENS) {
      test(s.name, async ({ page }) => {
        test.setTimeout(40000);
        await s.nav(page); await freezeAnimations(page); await page.waitForTimeout(150);
        const r = await probe(page);
        // eslint-disable-next-line no-console
        console.log(`MOBILE P ${w}x${h} ${s.name.padEnd(10)} hscroll=${r.hscroll} taps<44=${r.smallCount} ${r.worst.join(' ')}`);
      });
    }
  });
}
for (const { w, h } of LANDSCAPE) {
  test.describe(`landscape ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test('menu', async ({ page }) => {
      test.setTimeout(40000);
      await bootMenu(page); await freezeAnimations(page); await page.waitForTimeout(150);
      const r = await probe(page);
      // eslint-disable-next-line no-console
      console.log(`MOBILE L ${w}x${h} menu       hscroll=${r.hscroll} vscroll=${r.vscroll} taps<44=${r.smallCount} ${r.worst.join(' ')}`);
    });
  });
}
