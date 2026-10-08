// ROOMS screenshots through the e2e backend mock: the lobby (room-wrap) as host with 3 players, the sound/settings
// panel over it, the JOIN screen, and the public rooms browser.   SIZES='1366x657 390x844' TAG=rooms node tools/_shots/rooms.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { menuReady, joinControl } from '../../e2e/support/menu.js';
const out = process.env.OUT || 'claude/night-oct8-r3/_raw'; fs.mkdirSync(out, { recursive: true });
const tag = process.env.TAG || 'rooms';
const sizes = (process.env.SIZES || '1366x657 390x844').split(' ').map((s) => s.split('x').map(Number));
const ME = 'e2e-player';
const PLAYERS = [{ id: ME, name: 'ANDY', isHost: true }, { id: 'p2', name: 'KEYSMASH' }, { id: 'p3', name: 'LOWERCASE' }];
const audit = (page, root) => page.evaluate((root) => {
  const de = document.documentElement; const scope = document.querySelector(root) || document.body;
  const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
  const small = [...scope.querySelectorAll('*')].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim())).filter((el) => parseFloat(getComputedStyle(el).fontSize) < 14).map((el) => `${el.className}:${el.textContent.trim().slice(0, 14)}:${getComputedStyle(el).fontSize}`);
  const tiny = [...scope.querySelectorAll('button, [role="switch"], [role="radio"]')].filter(vis).filter((el) => { const r = el.getBoundingClientRect(); return r.height < 43.5; }).map((el) => `${el.className}:${Math.round(el.getBoundingClientRect().height)}`);
  const clip = []; for (const el of scope.querySelectorAll('*')) { if (!vis(el)) continue; const cs = getComputedStyle(el); if (cs.overflow !== 'visible' && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)) clip.push(`${el.className}:${el.scrollWidth}x${el.scrollHeight}>${el.clientWidth}x${el.clientHeight}`); }
  const sz = (s) => { const e = scope.querySelector(s) || document.querySelector(s); return e ? `${s}=${getComputedStyle(e).fontSize}` : null; };
  return { hscroll: de.scrollWidth > de.clientWidth, vscroll: de.scrollHeight > de.clientHeight, small: [...new Set(small)].slice(0, 12), tiny: tiny.slice(0, 8), clip: clip.slice(0, 8), sizes: ['.room-code-tile', '.room-code-face', '.room-player-name', '.room-start-btn', '.room-section-label', '.room-difficulty-name', '.room-difficulty-desc', '.sp-label', '.sp-sub', '.sp-val', '.browser-code-slot', '.browser-code-count'].map(sz).filter(Boolean).join(' ') };
}, root);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: process.env.MOTION ? 'no-preference' : 'reduce' });
  const page = await ctx.newPage();
  const mock = await installBackendMock(page, { seedReduceMotion: !process.env.MOTION });
  await page.addInitScript(() => { try { localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.xp', JSON.stringify({ lv: 12, into: 0 })); } catch { /* */ } });
  await page.goto('http://localhost:4173/?portal=1&season2=1', { waitUntil: 'networkidle' });
  await menuReady(page);
  mock.pushToClient({ type: 'room_update', payload: { code: 'KZRTB', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: PLAYERS } });
  await page.locator('.room-wrap').waitFor({ state: 'visible' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${tag}-lobby-${w}x${h}.png` });
  const a = await audit(page, '.room-wrap'); console.log(`${w}x${h} LOBBY`, JSON.stringify(a));
  // hover + press the START button
  const start = page.locator('.room-start-btn');
  if (await start.count()) { await start.hover(); await page.waitForTimeout(350); await page.screenshot({ path: `${out}/${tag}-start-hover-${w}x${h}.png`, clip: await start.boundingBox().then((b) => ({ x: Math.max(0, b.x - 30), y: Math.max(0, b.y - 30), width: b.width + 60, height: b.height + 60 })) }); await page.mouse.down(); await page.waitForTimeout(250); await page.screenshot({ path: `${out}/${tag}-start-pressed-${w}x${h}.png`, clip: await start.boundingBox().then((b) => ({ x: Math.max(0, b.x - 30), y: Math.max(0, b.y - 30), width: b.width + 60, height: b.height + 60 })) }); await page.mouse.up(); await page.waitForTimeout(300); }
  // settings panel
  await page.getByRole('button', { name: 'Sound settings' }).first().click().catch(() => console.log('no settings btn'));
  await page.locator('.sp').waitFor({ state: 'visible', timeout: 5000 }).catch(() => console.log('no .sp'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${tag}-settings-${w}x${h}.png` });
  const s = await audit(page, '.sp'); const pb = await page.locator('.audio-panel--v2').boundingBox().catch(() => null);
  console.log(`${w}x${h} SETTINGS`, JSON.stringify(s), 'panel', JSON.stringify(pb));
  // join screen
  await page.goto('http://localhost:4173/?portal=1&season2=1', { waitUntil: 'networkidle' }); await menuReady(page);
  await (await joinControl(page)).click().catch(() => console.log('no join control'));
  await page.locator('.browser-wrap').waitFor({ state: 'visible', timeout: 5000 }).catch(() => console.log('no browser-wrap'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${tag}-join-${w}x${h}.png` });
  const j = await audit(page, '.browser-wrap'); console.log(`${w}x${h} JOIN`, JSON.stringify(j));
  await ctx.close();
}
await browser.close();
