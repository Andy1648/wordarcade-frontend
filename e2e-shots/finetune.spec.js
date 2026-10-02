// e2e-shots/finetune.spec.js — STEP 30 fine-tune camera.
//
// Every screen a player sees (menu, shop, stats, rebirth, every mode dialog, lobby, every mode
// mid-round, every game-over, WORD RACE) at the four fine-tune viewports, for two players:
//   lv1   a first visit — storage cleared, real LV1 (locked CHAIN/FUSE show their locked panels).
//   vet   LV152, 6 rebirths, a big balance, every first-run flag seen.
// Reuses min-text.spec.js's navigation so the camera and the 13px gate drive the same screens.
//
// Run:  SHOT_FONTS=1 FT_OUT=claude/finetune/pass-1/before npx playwright test --config=playwright.shots.config.js finetune
import { test, expect } from '@playwright/test';
import fs from 'fs';
import { installBackendMock } from '../e2e/support/backendMock.js';
import { menuReady, navControl } from '../e2e/support/menu.js';
import { SCREENS, bootMenu, screenProfile, card } from '../e2e/support/screens.js';
import { ACHIEVEMENTS, ACHIEVEMENTS_KEY } from '../src/progress/achievements.js';

// A LV152 regular claimed every achievement long ago; without this the menu fires
// VETERAN / REBIRTH x5 / PAPER CHASE toasts on every frame, which no real veteran ever sees.
const VET_EARNED = ACHIEVEMENTS.map((a) => a.id);

const OUT = process.env.FT_OUT || 'claude/finetune/current';
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '1280x551', width: 1280, height: 551 },
  { name: '1366x625', width: 1366, height: 625 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

const ME = 'e2e-player';
const racers = [{ id: ME, name: 'ZEKE' }, { id: 'p2', name: 'RIVAL' }, { id: 'b1', name: 'SPRITZ', isBot: true }];
async function raceRoom(page) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1&race=1');
  await menuReady(page);
  mock.pushToClient({ type: 'room_update', payload: { code: 'RACE1', gameType: 'word-race', hostId: ME, difficultyKey: 'chill', players: racers.map((r, i) => ({ ...r, isHost: i === 0 })) } });
  await page.locator('.wr-lobby').waitFor({ state: 'visible' });
  return mock;
}
async function raceStart(page, mock) {
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-race' } });
  const now = Date.now();
  mock.pushToClient({ type: 'race_start', payload: { seed: 7, fragments: ['str', 'ing', 'ion', 'ent', 'ter', 'and', 'ous', 'con', 'pre', 'est', 'ble', 'ate'], target: 12, capMs: 90000, racers, serverNow: now, goAt: now + 50 } });
  mock.pushToClient({ type: 'race_go', payload: { serverNow: now, goAt: now + 50, endsAt: now + 90000 } });
  mock.pushToClient({ type: 'race_progress', payload: { racerId: 'p2', index: 3, word: 'STRAND' } });
  await page.locator('.wr-root[data-race-status="racing"]').waitFor({ state: 'visible' });
}
async function satLineup(page) {
  await installBackendMock(page);
  await page.goto('/?satRush=1&portal=1');
  await menuReady(page);
  await card(page, 'sat-rush').click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /LINEUP/ }).click();
  await page.locator('.sr-lineup').waitFor({ state: 'visible', timeout: 20000 });
}

const EXTRA = [
  { name: 'rebirth', nav: async (page) => { await bootMenu(page, 40); await navControl(page, 'rebirth').click(); await page.locator('.shop-panel').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'sat-lineup', nav: async (page) => { await satLineup(page); await page.waitForTimeout(400); } },
  {
    name: 'sat-results',
    nav: async (page) => {
      await satLineup(page);
      await expect.poll(async () => {
        if (await page.locator('.sr-respage').isVisible()) return true;
        await page.keyboard.press('Escape'); await page.waitForTimeout(250);
        await page.keyboard.press('x'); await page.waitForTimeout(250);
        return page.locator('.sr-respage').isVisible();
      }, { timeout: 30000, intervals: [300] }).toBe(true);
      await page.waitForTimeout(400);
    },
  },
  { name: 'race-lobby', nav: async (page) => { await raceRoom(page); await page.waitForTimeout(300); } },
  { name: 'race-racing', nav: async (page) => { const m = await raceRoom(page); await raceStart(page, m); await page.waitForTimeout(400); } },
  {
    name: 'race-results',
    nav: async (page) => {
      const m = await raceRoom(page);
      await raceStart(page, m);
      m.pushToClient({ type: 'race_over', payload: { winnerId: 'p2', reason: 'target', standings: [{ id: 'p2', name: 'RIVAL', place: 1, words: 12, reachedAt: 41000 }, { id: ME, name: 'ZEKE', place: 2, words: 7 }, { id: 'b1', name: 'SPRITZ', isBot: true, place: 3, words: 5 }] } });
      await page.locator('.wr-over').waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
    },
  },
];

// The shared screen map seeds its multiplayer rooms with player id 'me', but the mock socket
// tells the client it is 'e2e-player' — so every room/in-game/game-over frame it drives is a
// SPECTATOR's view ("waiting for host", "THEIR TURN", "YOU WINS"). The camera photographs the
// player: same navs, the client's real id, the server's real payload shapes.
const wbP = [{ id: ME, name: 'ZEKE', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 0 }];
const cbP = [{ id: ME, name: 'ZEKE', isHost: true }, { id: 'p2', name: 'RIVAL' }];
// screens.js bootRoom hardcodes hostId 'me'; the player must be the host here.
async function bootRoom(page, gameType, players) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType, hostId: ME, difficultyKey: 'chill', players } });
  return mock;
}
async function wbGame(page) {
  const m = await bootRoom(page, 'word-bomb', wbP);
  await page.waitForTimeout(80);
  m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbP, combo: 'at', usedWords: [], timerSeconds: 30 } });
  await page.locator('.game-wrap').waitFor({ state: 'visible' });
  return m;
}
async function cbGame(page) {
  const m = await bootRoom(page, 'category-blitz', cbP);
  await page.waitForTimeout(80);
  m.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
  await page.waitForTimeout(80);
  m.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } });
  await page.locator('.game-wrap').waitFor({ state: 'visible' });
  return m;
}
const AS_PLAYER = {
  room: async (page) => { await bootRoom(page, 'word-bomb', wbP); await page.locator('.room-wrap').waitFor({ state: 'visible' }); await page.waitForTimeout(300); },
  'ingame-word-bomb': async (page) => { await wbGame(page); await page.waitForTimeout(300); },
  'ingame-category-blitz': async (page) => { await cbGame(page); await page.waitForTimeout(300); },
  'gameover-word-bomb': async (page) => { const m = await wbGame(page); await page.waitForTimeout(80); m.pushToClient({ type: 'game_over', payload: { winnerId: ME } }); await page.locator('.game-over-overlay').waitFor({ state: 'visible' }); await page.waitForTimeout(500); },
  'gameover-category-blitz': async (page) => { const m = await cbGame(page); await page.waitForTimeout(60); m.pushToClient({ type: 'game_over', payload: { winnerId: ME, finalScores: [{ id: ME, name: 'ZEKE', score: 30 }, { id: 'p2', name: 'RIVAL', score: 10 }] } }); await page.locator('.game-over-overlay').waitFor({ state: 'visible' }); await page.waitForTimeout(500); },
};

// Screens the step asks for (splash / credits / public-room browser are out of scope).
const SKIP = new Set(['splash', 'credits', 'browser']);
// Unreachable for a LV1 player — their locked-* panels are the LV1 versions of these.
const LV1_SKIP = new Set(['dialog-chain', 'dialog-fuse', 'rebirth']);
// A LV152 player has everything unlocked; the locked panels are LV1-only.
const VET_SKIP = new Set(['locked-chain', 'locked-fuse']);

const PROFILES = {
  lv1: { menuLevel: null, skip: LV1_SKIP, init: () => { try { localStorage.clear(); } catch { /* blocked */ } } },
  vet: {
    menuLevel: 152,
    skip: VET_SKIP,
    init: () => {
      try {
        localStorage.setItem('taw.xp', JSON.stringify({ lv: 152, into: 0 }));
        localStorage.setItem('taw.wins', '48200000');
        localStorage.setItem('taw.winsLifetime', '391000000');
        localStorage.setItem('taw.rebirths', '6');
        for (const k of ['taw.seenMenu', 'taw.seenMenuSpotlight', 'taw.seenGameSpotlight', 'wa_has_played']) localStorage.setItem(k, '1');
      } catch { /* blocked */ }
    },
  },
};

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () => !document.getAnimations().some((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations !== Infinity),
    null, { timeout: 5000 },
  ).catch(() => {});
}

const ALL = [...SCREENS.filter((s) => !SKIP.has(s.name)).map((s) => ({ name: s.name, nav: AS_PLAYER[s.name] || s.nav })), ...EXTRA];
const ONLY = process.env.FT_ONLY ? new Set(process.env.FT_ONLY.split(',')) : null;

for (const [profileName, profile] of Object.entries(PROFILES)) {
  test.describe(`finetune [${profileName}]`, () => {
    for (const vp of VIEWPORTS) {
      for (const screen of ALL) {
        if (profile.skip.has(screen.name)) continue;
        if (ONLY && !ONLY.has(screen.name)) continue;
        test(`${screen.name} @ ${vp.name}`, async ({ page }) => {
          test.setTimeout(90_000);
          screenProfile.menuLevel = profile.menuLevel;
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.addInitScript(profile.init);
          if (profileName === 'vet') await page.addInitScript(([k, ids]) => { try { localStorage.setItem(k, JSON.stringify(ids)); } catch { /* blocked */ } }, [ACHIEVEMENTS_KEY, VET_EARNED]);
          try { await screen.nav(page); } finally { screenProfile.menuLevel = undefined; }
          // FT_CSS: an experiment stylesheet injected after nav — try a fix on pictures before coding it.
          if (process.env.FT_CSS) await page.addStyleTag({ content: process.env.FT_CSS });
          await settle(page);
          const dir = `${OUT}/${profileName}`;
          fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: `${dir}/${screen.name}__${vp.name}.png` });
        });
      }
    }
  });
}
