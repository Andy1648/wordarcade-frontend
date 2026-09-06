// measure-fill.mjs — width/height fill of each of the five game stages across desktop viewports.
// Reports rendered stage rect vs viewport, plus --app-scale and any ancestor zoom.
// Usage: node claude/_tools/measure-fill.mjs
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const BASE = 'http://localhost:4173';
const ME = 'e2e-player';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }];
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
const VIEWPORTS = [[1920, 1080], [1568, 675], [1366, 768], [1280, 551]];

async function openSolo(p, game) {
  await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch {} });
  await p.goto('/?portal=1&soloms=20000'); await waitImg(p); await p.waitForTimeout(250);
  await p.locator(`.game-card-magnet[data-game="${game}"] .game-card`).click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
  await p.locator('.solo-root').waitFor();
  const i = p.locator('.solo-root input').first(); await i.waitFor(); await i.fill(game === 'chain' ? 'e' : 'a'); await p.waitForTimeout(300);
}
async function openWB(p, mock, type) {
  const players = type === 'word-bomb' ? wbPlayers : [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
  await p.goto('/?portal=1'); await waitImg(p);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: type, hostId: ME, difficultyKey: 'chill', players } }); await p.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: type } }); await p.waitForTimeout(60);
  if (type === 'word-bomb') mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: ['MONSTER'], timerSeconds: 22 } });
  else mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 45, category: 'CRYPTIDS & FOLKLORE MONSTERS', categoryId: 'cryptids', rerollsRemaining: 1 } });
  await p.waitForTimeout(4600);
}
async function openSAT(p) {
  await p.goto('/?satRush=1&portal=1'); await waitImg(p); await p.waitForTimeout(250);
  await p.locator('[data-game="sat-rush"] .game-card').click({ force: true }); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Play' }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /BRIEFING/ }).click(); await p.waitForTimeout(400);
  await p.locator('.sr-brief-page').waitFor({ timeout: 6000 });
  await p.getByRole('button', { name: 'Start the run' }).click();
  await p.locator('.sr-slots').waitFor({ timeout: 8000 }); await p.waitForTimeout(600);
}

async function measure(p, sel) {
  return p.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { err: 'no ' + sel };
    const r = el.getBoundingClientRect();
    const scale = getComputedStyle(document.documentElement).getPropertyValue('--app-scale').trim();
    const zoomed = [];
    let e = el;
    while (e) { const z = getComputedStyle(e).zoom; if (z && z !== '1' && z !== 'normal') zoomed.push(`${e.className.toString().split(' ')[0]}=${z}`); e = e.parentElement; }
    return { w: Math.round(r.width), h: Math.round(r.height), fillW: +(r.width / window.innerWidth * 100).toFixed(1), fillH: +(r.height / window.innerHeight * 100).toFixed(1), scale, zoomed };
  }, sel);
}

const SCREENS = [
  ['word-bomb', '.game-stage', (p, m) => openWB(p, m, 'word-bomb')],
  ['category-blitz', '.game-stage', (p, m) => openWB(p, m, 'category-blitz')],
  ['chain', '.solo-root', (p) => openSolo(p, 'chain')],
  ['fuse', '.solo-root', (p) => openSolo(p, 'fuse')],
  ['sat-rush', '.sr-stage', (p) => openSAT(p)],
];

const browser = await chromium.launch();
const out = {};
for (const [w, h] of VIEWPORTS) {
  out[`${w}x${h}`] = {};
  for (const [name, sel, nav] of SCREENS) {
    const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); const mock = await installBackendMock(p);
    try { await nav(p, mock); out[`${w}x${h}`][name] = await measure(p, sel); }
    catch (e) { out[`${w}x${h}`][name] = { err: String(e).split('\n')[0].slice(0, 70) }; }
    await ctx.close();
  }
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
