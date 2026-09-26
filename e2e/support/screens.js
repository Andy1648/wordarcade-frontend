// e2e/support/screens.js — THE ONE SCREEN MAP.
//
// Every screen the app has, with the navigation that lands on it. Extracted from
// viewport-integrity.spec.js so the layout gate, the arcane-pass screenshot runs and the
// cold-stranger walk all drive the SAME list. Three copies of "how do I get to the Blitz
// game-over" is how a screen quietly stops being covered — the same divergent-copy bug that
// had FUSE's throughput asserted in one sim and derived in another.
//
// Exports: VIEWPORTS, SHOT_VIEWPORTS, TOL, SCREENS, NOSCROLL, THEME_IDS + the nav primitives.
import { installBackendMock } from './backendMock.js';
import { GAMES } from '../../src/gameData.js';
import { isPhoneMenu, joinControl, menuReady, modeEntry, phoneCanOpen, soloEntryQuery } from './menu.js';

// The level to seed so a gated mode is still LOCKED. Derived from the real gate, never a literal:
// this map hardcoded 16 for FUSE, written when FUSE unlocked at LV25. fix/unlock-gates lowered it
// to LV3, so a level-16 visitor now has FUSE UNLOCKED, the locked-preview panel never opens, and
// every locked-fuse cell of the layout matrix timed out — 35 failures across 5 themes x 7
// viewports. Neither branch's own gate could see it: one owned the map, the other owned the gate.
const lockedLevelFor = (id) => {
  const g = GAMES.find((x) => x.id === id);
  return Math.max(0, (g && g.unlockLevel != null ? g.unlockLevel : 1) - 1);
};

export const VIEWPORTS = [
  { name: '2560x1440', width: 2560, height: 1440 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1163x501', width: 1163, height: 501 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x640', width: 360, height: 640 },
];

// The four Andy asked every before/after frame to be taken at.
export const SHOT_VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x640', width: 320, height: 640 },
];

export const TOL = 2; // sub-pixel / rounding tolerance (px)
export const THEME_IDS = ['default', 'midnight', 'inferno', 'toxic', 'prism'];

// ---- navigation primitives (reused from coverage / gameover specs) ----
export async function bootMenu(page, level = 40, query = '?portal=1') {
  await installBackendMock(page);
  if (level != null) {
    await page.addInitScript((lv) => {
      try {
        localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 }));
        localStorage.setItem('taw.wins', '999999');
      } catch { /* ignore */ }
    }, level);
  }
  await page.goto(`/${query}`);
  await menuReady(page);
  await page.waitForTimeout(400);
}
// THE MODE ENTRY POINT, at either width (support/menu.js). Exported under the old name so
// every caller keeps working; what changed is that it now resolves on a phone too.
export const card = (page, id) => modeEntry(page, id);

export async function bootRoom(page, gameType, players) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType, hostId: 'me', difficultyKey: 'chill', players } });
  return mock;
}
export async function enterSolo(page, id) {
  await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* ignore */ } });
  await installBackendMock(page);
  // PHONE: CHAIN and FUSE have no card to click — the phone menu replaces both with one
  // "CHAIN + FUSE UNLOCK AS YOU PLAY" line (MobileMenu.jsx). They are still REACHABLE, by the
  // shipped /chain/play and /fuse/play deep links, which bridge to ?chain=1 / ?fuse=1
  // (router.js). That is the path a phone player actually arrives on, so it is the path this
  // drives — the mode is entered for real, not through a test-only hook.
  if (isPhoneMenu(page) && !phoneCanOpen(id)) {
    await page.goto(`/?portal=1&soloms=350&${soloEntryQuery(id)}`);
    await page.locator('.solo-root').waitFor({ state: 'visible', timeout: 15000 });
    return;
  }
  await page.goto('/?portal=1&soloms=350');
  await menuReady(page);
  await page.waitForTimeout(400);
  await card(page, id).click({ force: true });
  await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor({ state: 'visible' });
}

export const ME = 'me';
export const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 0 }];
export const cbPlayers = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];

// ---------------------------------------------------------------------------------------------
// PHONE REACHABILITY. `phone: false` on a screen means THE PRODUCT has no way to open it at
// <=480px — not that the test is awkward there. MobileMenu.jsx renders exactly three sections
// (title + sound, three mode rows, unlock line + JOIN), so the corner nav (SHOP / STATS /
// REBIRTH), the CREDITS footer link and the CHAIN/FUSE cards simply do not exist at that width.
// A screen reached only through one of those has no phone path to drive, and the matrix skips
// that CELL with the reason stated, rather than driving a desktop selector that cannot resolve.
// Every one of these is listed in the branch summary; they are gaps in the app, not in the gate.
// ---------------------------------------------------------------------------------------------
// Each screen: name, root selector, overlay?, and an async nav(page) that lands on it.
export const SCREENS = [
  { name: 'splash', root: '.splash-screen', overlay: true, nav: async (page) => { await installBackendMock(page); await page.goto('/'); await page.locator('.splash-screen').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'menu', root: '.homepage-wrap', overlay: false, nav: async (page) => bootMenu(page, 40) },
  { name: 'dialog-word-bomb', root: '.mode-dialog-shell', overlay: true, nav: async (page) => { await bootMenu(page, 40); await card(page, 'word-bomb').click(); await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'dialog-category-blitz', root: '.mode-dialog-shell', overlay: true, nav: async (page) => { await bootMenu(page, 40); await card(page, 'category-blitz').click(); await page.locator('.ppp-picker').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'dialog-chain', phone: false, phoneWhy: 'the phone menu has no CHAIN card, so its mode dialog has no phone entry', root: '.mode-dialog-shell', overlay: true, nav: async (page) => { await bootMenu(page, 40); await card(page, 'chain').click(); await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'dialog-fuse', phone: false, phoneWhy: 'the phone menu has no FUSE card, so its mode dialog has no phone entry', root: '.mode-dialog-shell', overlay: true, nav: async (page) => { await bootMenu(page, 40); await card(page, 'fuse').click(); await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'locked-chain', phone: false, phoneWhy: 'the locked-preview panel opens from the CHAIN card, which the phone menu replaces with one text line', root: '.lp-panel', overlay: true, nav: async (page) => { await bootMenu(page, lockedLevelFor('chain')); await card(page, 'chain').click({ force: true }); await page.locator('.lp-panel').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'locked-fuse', phone: false, phoneWhy: 'the locked-preview panel opens from the FUSE card, which the phone menu replaces with one text line', root: '.lp-panel', overlay: true, nav: async (page) => { await bootMenu(page, lockedLevelFor('fuse')); await card(page, 'fuse').click({ force: true }); await page.locator('.lp-panel').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'credits', phone: false, phoneWhy: 'the CREDITS link lives in the desktop footer; the phone menu has no footer', root: '.credits-wrap', overlay: true, nav: async (page) => { await bootMenu(page, 40); await page.locator('.homepage-credits-link').click(); await page.locator('.credits-wrap').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'shop', phone: false, phoneWhy: 'SHOP is in the desktop corner nav, which the phone menu does not render', root: '.shop-panel', overlay: true, nav: async (page) => { await bootMenu(page, 40); await page.locator('.homepage-nav-btn.is-shop').click(); await page.locator('.shop-panel').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'stats', phone: false, phoneWhy: 'STATS is in the desktop corner nav, which the phone menu does not render', root: '.stats-panel', overlay: true, nav: async (page) => { await bootMenu(page, 40); await page.locator('.homepage-nav-btn.is-stats').click(); await page.locator('.stats-panel').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'lobby', root: '.lobby-wrap', overlay: false, nav: async (page) => { await bootMenu(page, 40); await card(page, 'word-bomb').click(); await page.locator('.mode-dialog-btn-create').click(); await page.locator('.lobby-wrap').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'browser', root: '.browser-wrap', overlay: false, nav: async (page) => { await bootMenu(page, 40); await joinControl(page).click(); await page.locator('.browser-wrap').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'room', root: '.room-wrap', overlay: false, nav: async (page) => { await bootRoom(page, 'word-bomb', wbPlayers); await page.locator('.room-wrap').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'ingame-word-bomb', root: '.game-wrap', overlay: false, nav: async (page) => { const m = await bootRoom(page, 'word-bomb', wbPlayers); await page.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await page.waitForTimeout(80); m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 30 } }); await page.locator('.game-wrap').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'ingame-category-blitz', root: '.game-wrap', overlay: false, nav: async (page) => { const m = await bootRoom(page, 'category-blitz', cbPlayers); await page.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } }); await page.waitForTimeout(80); m.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } }); await page.locator('.game-wrap').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'gameover-word-bomb', root: '.game-over-overlay', overlay: true, nav: async (page) => { const m = await bootRoom(page, 'word-bomb', wbPlayers); await page.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await page.waitForTimeout(80); m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 30 } }); await page.waitForTimeout(80); m.pushToClient({ type: 'game_over', payload: { winnerId: ME } }); await page.locator('.game-over-overlay').waitFor({ state: 'visible' }); await page.waitForTimeout(500); } },
  { name: 'gameover-category-blitz', root: '.game-over-overlay', overlay: true, nav: async (page) => { const m = await bootRoom(page, 'category-blitz', cbPlayers); await page.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } }); await page.waitForTimeout(80); m.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } }); await page.waitForTimeout(60); m.pushToClient({ type: 'game_over', payload: { winnerId: ME, finalScores: [{ id: ME, name: 'YOU', score: 30 }, { id: 'p2', name: 'RIVAL', score: 10 }] } }); await page.locator('.game-over-overlay').waitFor({ state: 'visible' }); await page.waitForTimeout(500); } },
  { name: 'ingame-chain', root: '.solo-root', overlay: false, nav: async (page) => { await enterSolo(page, 'chain'); await page.waitForTimeout(200); } },
  { name: 'ingame-fuse', root: '.solo-root', overlay: false, nav: async (page) => { await enterSolo(page, 'fuse'); await page.waitForTimeout(200); } },
  { name: 'gameover-chain', root: '.solo-deathcard', overlay: true, nav: async (page) => { await enterSolo(page, 'chain'); const input = page.locator('.solo-root input').first(); await input.waitFor({ state: 'visible' }); await input.fill('a'); await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 8000 }); await page.waitForTimeout(300); } },
  { name: 'gameover-fuse', root: '.solo-deathcard', overlay: true, nav: async (page) => { await enterSolo(page, 'fuse'); const input = page.locator('.solo-root input').first(); await input.waitFor({ state: 'visible' }); await input.fill('a'); await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 8000 }); await page.waitForTimeout(300); } },
  { name: 'sat-modeselect', root: '.sr-modeselect', overlay: true, nav: async (page) => { await installBackendMock(page); await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* ignore */ } }); await page.goto('/?satRush=1&portal=1'); await menuReady(page); await page.waitForTimeout(400); await card(page, 'sat-rush').click(); await page.getByRole('button', { name: 'Play' }).click(); await page.locator('.sr-modeselect').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'sat-briefing', root: '.sr-brief-page', overlay: false, nav: async (page) => { await installBackendMock(page); await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* ignore */ } }); await page.goto('/?satRush=1&portal=1'); await menuReady(page); await page.waitForTimeout(400); await card(page, 'sat-rush').click(); await page.getByRole('button', { name: 'Play' }).click(); await page.getByRole('button', { name: 'briefing' }).click(); await page.locator('.sr-brief-page').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
];


export const NOSCROLL = new Set([
  'dialog-word-bomb', 'dialog-category-blitz', 'dialog-chain', 'dialog-fuse',
  'locked-chain', 'locked-fuse', 'gameover-word-bomb', 'gameover-category-blitz',
  'gameover-chain', 'gameover-fuse', 'sat-modeselect',
]);
