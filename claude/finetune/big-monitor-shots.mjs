// big-monitor-shots.mjs — BIG-MONITOR PASS (next-passes-spec PASS 1) before/after frames + box geometry.
// Every screen the pass touched, at Andy's 2560x1440, at 1920x1080, and at 1366x625 (the NO-CHANGE
// check: every rule in the pass sits behind (min-width:1800px) and (min-height:1000px), so the
// 1366x625 geometry JSON must be byte-identical before and after).
//
// usage:  node claude/finetune/big-monitor-shots.mjs <tag> [url] [vp,vp,...] [screen,screen,...]
//   e.g.  npx vite build && npx vite preview --port 4191
//         node claude/finetune/big-monitor-shots.mjs after http://localhost:4191
//         (check out origin/main, rebuild, run with tag "before", then diff the two geom JSONs)
// Writes claude/finetune/big-monitor/<tag>/<screen>-<vp>.png and <tag>-geom.json.
//
// SHOT_FONTS=1 is set BEFORE the backend mock is installed: the mock lets Google Fonts through only
// with it, so Bungee / Dela Gothic One / Space Mono load and the type is measured in the real face.
process.env.SHOT_FONTS = '1';

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { SCREENS, bootMenu, card } from '../../e2e/support/screens.js';
import { menuReady, navControl } from '../../e2e/support/menu.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] || 'shot';
const URL = process.argv[3] || 'http://localhost:4191';
const VPS = (process.argv[4] || '2560x1440,1920x1080,1366x625').split(',');
const ONLY = process.argv[5] ? process.argv[5].split(',') : null;
const OUT = path.join(here, 'big-monitor', TAG);
fs.mkdirSync(OUT, { recursive: true });

const fromScreens = (name) => SCREENS.find((s) => s.name === name).nav;
const settle = (p) => p.evaluate(() => document.getAnimations().forEach((a) => {
  try { if (a.effect && a.effect.getTiming().iterations !== Infinity) a.finish(); } catch { /* ignore */ }
}));

// ---- navs this pass needs that SCREENS does not have ----------------------------------------------
async function satCover(page) {
  await installBackendMock(page);
  await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* ignore */ } });
  await page.goto('/?satRush=1&portal=1');
  await menuReady(page);
  await page.waitForTimeout(400);
  await card(page, 'sat-rush').click({ force: true });
  await page.locator('.sr-cover').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
}
async function satRun(page, mode) {
  await satCover(page);
  await page.getByRole('button', { name: 'Play' }).click();
  await page.locator('.sr-modeselect').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: mode === 'lineup' ? /LINEUP/ : /BRIEFING/ }).click();
  if (mode !== 'lineup') {
    await page.locator('.sr-brief-page').waitFor({ state: 'visible', timeout: 6000 });
    await page.getByRole('button', { name: 'Start the run' }).click();
  }
  await page.locator('.sr-slots').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(500);
}
const CLAIMS = [
  { id: 'ach-x', kind: 'ach', label: 'TEST A', amount: 100, at: 1 },
  { id: 'ach-y', kind: 'ach', label: 'TEST B', amount: 250, at: 2 },
];
async function claims(page) {
  await installBackendMock(page);
  await page.addInitScript((c) => {
    if (sessionStorage.getItem('bm.seeded')) return;
    sessionStorage.setItem('bm.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 27, into: 0 }));
    localStorage.setItem('taw.claims', JSON.stringify(c));
  }, CLAIMS);
  await page.goto('/?portal=1');
  await menuReady(page);
  await navControl(page, 'stats').click();
  await page.locator('.claims-panel').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
}
async function ranks(page) {
  await bootMenu(page, 40);
  await page.locator('.menu-xp-rank--btn:visible').first().click();
  await page.locator('.rank-panel').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
}
async function rebirth(page) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('bm.seeded')) return;
    sessionStorage.setItem('bm.seeded', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 15, into: 0 }));
    localStorage.setItem('taw.wins', '400');
    localStorage.setItem('taw.owned', JSON.stringify(['classic', 'thock', 'clack', 'cream', 'inferno']));
  });
  await page.goto('/?portal=1');
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
  await page.locator('.homepage-nav-btn.is-rebirth').click();
  await page.locator('.shop-panel').waitFor({ state: 'visible' });
  await page.locator('.shop-rebirth').click();
  await page.locator('.shop-confirm-actions .shop-card-btn.danger').click();
  await page.locator('.rbc-card').waitFor({ state: 'visible' });
  await page.waitForTimeout(1600); // the slam + kept-row stamps land
}
// A Word Bomb WIN against a rival who is seated (the winner-bonus spec's flow): the WINNER popup
// (shown even at 0 when a rival exists), the K.O. burst and the round payout receipt.
async function wbWin(page) {
  const ME = 'e2e-player';
  const mock = await installBackendMock(page);
  await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 12, into: 0 })); localStorage.setItem('taw.claims', '[]'); } catch { /* ignore */ } });
  await page.goto('/?portal=1');
  await menuReady(page);
  const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p1', name: 'PLAYER1', lives: 3 }];
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [], timerSeconds: 30, maxLives: 3 } });
  await page.waitForTimeout(4800);
  const used = [];
  for (const w of ['STRAND', 'MINSTREL', 'STRIDE', 'ABSTRACT']) {
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w, playerId: ME } });
    await page.waitForTimeout(140);
    used.push(w);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: used, timerSeconds: 30, maxLives: 3 } });
    await page.waitForTimeout(140);
  }
  await page.waitForTimeout(400);
  mock.pushToClient({ type: 'game_over', payload: { winnerId: ME, players } });
  await page.locator('.game-over-overlay').waitFor({ state: 'visible' });
}

// ---- the screens: nav, key boxes, and the extra frames ---------------------------------------------
const SHOTS = [
  { name: 'sat-cover', nav: satCover, boxes: ['.sr-cover', '.sr-cover-example', '.sr-title', '.sr-cover-tag', '.sr-btn'] },
  { name: 'sat-modeselect', nav: fromScreens('sat-modeselect'), boxes: ['.sr-modeselect'] },
  { name: 'sat-briefing', nav: fromScreens('sat-briefing'), boxes: ['.sr-brief-page', '.sr-brief-card', '.sr-brief-sentence'] },
  { name: 'sat-play-briefing', nav: (p) => satRun(p, 'briefing'), boxes: ['.sr-stage', '.sr-hud', '.sr-slots', '.sr-slot', '.sr-wanted-wrap', '.sr-mult', '.sr-root'] },
  { name: 'sat-play-lineup', nav: (p) => satRun(p, 'lineup'), boxes: ['.sr-stage', '.sr-slots', '.sr-slot', '.sr-lineup', '.sr-mult'] },
  { name: 'menu', nav: fromScreens('menu'), boxes: ['.homepage-cards-grid', '.game-card', '.game-card-name', '.game-card-xp', '.game-card-payout', '.game-card-badge', '.game-card-foot', '.game-card-ribbon'] },
  { name: 'shop', nav: fromScreens('shop'), boxes: ['.shop-panel', '.shop-grid', '.shop-card'] },
  { name: 'stats', nav: fromScreens('stats'), boxes: ['.stats-panel', '.stats-secrets'] },
  { name: 'dialog-word-bomb', nav: fromScreens('dialog-word-bomb'), boxes: ['.mode-dialog-shell'] },
  { name: 'dialog-category-blitz', nav: fromScreens('dialog-category-blitz'), boxes: ['.mode-dialog-shell', '.ppp-picker'] },
  { name: 'locked-chain', nav: fromScreens('locked-chain'), boxes: ['.lp-panel'] },
  { name: 'claims', nav: claims, boxes: ['.claims-panel', '.claims-row', '.claims-title', '.claims-label'],
    after: async (p, tag) => { // claim one: the stamp + the wins toast (.wct) it fires
      await p.locator('.claims-btn').first().click();
      await p.locator('.wct-row').first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      await p.waitForTimeout(300);
      await p.screenshot({ path: path.join(OUT, `wins-toast-${tag}.png`) });
      return geom(p, ['.wct', '.wct-row', '.wct-label']);
    } },
  { name: 'rank-ladder', nav: ranks, boxes: ['.rank-panel', '.rank-row', '.rank-num', '.rank-title', '.rank-name'] },
  { name: 'rebirth-ceremony', nav: rebirth, boxes: ['.rbc-card', '.rbc-hero', '.rbc-cols', '.rbc-continue'] },
  { name: 'wb-win', nav: wbWin, settleFirst: false, boxes: ['.winner-pop', '.winner-pop-title', '.ko-burst', '.ko-text', '.game-over-card', '.payout'],
    pre: async (p, tag) => { // the WINNER popup + K.O. burst are transient: frame them as they land
      await p.locator('.winner-pop').waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(OUT, `wb-win-popup-${tag}.png`) });
      return geom(p, ['.winner-pop', '.winner-pop-title', '.ko-burst', '.ko-text']);
    } },
  { name: 'gameover-word-bomb', nav: fromScreens('gameover-word-bomb'), boxes: ['.game-over-card', '.payout', '.payout-row'] },
];

// Box geometry + type for the first few matches of each selector, plus the whole-page sanity checks:
// document overflow, and any leaf text clipped by its own box.
function geom(p, sels) {
  return p.evaluate((sels) => {
    const out = {};
    for (const s of sels) {
      const els = [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).slice(0, 3);
      out[s] = els.map((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize, maxW: cs.maxWidth };
      });
    }
    const leaves = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && e.textContent.trim() && e.getClientRects().length);
    out._clipped = leaves.filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible')
      .map((e) => `${typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName}:${e.textContent.trim().slice(0, 24)}`).slice(0, 20);
    out._docOverflow = document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight;
    out._smallText = leaves.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 13).length;
    return out;
  }, sels);
}

const browser = await chromium.launch();
const report = {};
for (const vp of VPS) {
  const [w, h] = vp.split('x').map(Number);
  for (const s of SHOTS) {
    if (ONLY && !ONLY.includes(s.name)) continue;
    const ctx = await browser.newContext({ baseURL: URL, viewport: { width: w, height: h }, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const key = `${s.name}@${vp}`;
    try {
      await s.nav(page);
      await page.evaluate(() => document.fonts.ready);
      const entry = {};
      if (s.pre) entry.pre = await s.pre(page, vp);
      await page.waitForTimeout(300);
      if (s.settleFirst !== false) await settle(page);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, `${s.name}-${vp}.png`) });
      entry.boxes = await geom(page, [...s.boxes]);
      if (s.after) entry.after = await s.after(page, vp);
      report[key] = entry;
      const first = entry.boxes[s.boxes[0]] && entry.boxes[s.boxes[0]][0];
      console.log(key, first ? `${s.boxes[0]} ${first.w}x${first.h} fs=${first.fs}` : `${s.boxes[0]} MISSING`, entry.boxes._docOverflow ? 'DOC-OVERFLOW' : '', entry.boxes._clipped.length ? `clipped=${entry.boxes._clipped.length}` : '');
    } catch (e) {
      report[key] = { err: String(e).slice(0, 300) };
      console.log(key, 'ERR', String(e).slice(0, 160));
    }
    await ctx.close();
  }
}
fs.writeFileSync(path.join(OUT, `${TAG}-geom.json`), JSON.stringify(report, null, 1));
await browser.close();
