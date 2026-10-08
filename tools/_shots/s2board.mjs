// s2board.mjs — screenshot the SEASON-2 LEADERBOARD (LeaderboardV2) through the board mock with a seeded 13-row
// season-2 board (the e2e/v2-leaderboard.spec.js rows: ★ → R → level, a few un-earned stats). Env: OUT, TAG, SIZES, JPG=1.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { mockBoard } from '../../e2e/support/boardMock.js';
import { navControl } from '../../e2e/support/menu.js';

const out = process.env.OUT || 'shots';
fs.mkdirSync(out, { recursive: true });
const sizes = (process.env.SIZES || '1366x657 390x844').split(' ').map((s) => s.split('x').map(Number));
const SECRET = 'b8'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
const r = (id, username, o) => ({ id, username, level: 10, rebirths: 0, stars: 0, lifetime_words: 500, lifetime_letters: 2500, wins_per_word: 10, econ: 13, submitted_at: FUTURE, ...o });
const BOARD = [
  r('d', 'DELTA', { rebirths: 2, level: 9999, lifetime_words: 12345 }),
  r('b', 'BRAVO', { rebirths: 9, level: 900, lifetime_words: 80000 }),
  r('a', 'ALPHA', { stars: 1, rebirths: 0, level: 5 }),
  r('c', 'CHARLIE', { rebirths: 9, level: 100 }),
  r('e', 'ECHO', { rebirths: 1, level: 50 }),
  r('f', 'FOXTROT', { rebirths: 1, level: 40, lifetime_words: 0, wins_per_word: 0 }),
  r('g', 'GOLF', { rebirths: 0, level: 300 }),
  r('h', 'HOTEL', { rebirths: 0, level: 200 }),
  r('i', 'INDIA', { rebirths: 0, level: 100, lifetime_words: 0, wins_per_word: 0 }),
  r('j', 'JULIET', { rebirths: 0, level: 90 }),
  r('k', 'KILO', { rebirths: 0, level: 80 }),
  r('l', 'LIMA', { rebirths: 0, level: 70 }),
];
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ baseURL: process.env.BASE || 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
  const me = { level: 10, rebirths: 0, stars: 0 };
  const shared = { rows: [...BOARD.map((x) => ({ ...x })), r('me', 'NOBUFF', me)], secrets: new Map([[SECRET, 'me']]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, weekly: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, me }) => {
    if (sessionStorage.getItem('lb2.seeded')) return;
    sessionStorage.setItem('lb2.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'NOBUFF' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: me.level, f: 0.1, rc: me.rebirths, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', String(me.rebirths));
    localStorage.setItem('taw.s2.stars', String(me.stars));
  }, { secret: SECRET, me });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'leaderboard').waitFor({ state: 'visible' });
  await navControl(page, 'leaderboard').click();
  const lb = page.locator('.lb2');
  await lb.waitFor({ state: 'visible' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const jpg = !!process.env.JPG;
  const name = `${process.env.TAG || 'board'}-${w}x${h}.${jpg ? 'jpg' : 'png'}`;
  await page.screenshot({ path: `${out}/${name}`, ...(jpg ? { type: 'jpeg', quality: 80 } : {}) });
  const audit = await page.evaluate(() => {
    const r = document.querySelector('.lb2');
    const out = [];
    for (const el of r.querySelectorAll('*')) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (b.left < -1 || b.right > innerWidth + 1) out.push(`${el.className || el.tagName} x ${Math.round(b.left)}..${Math.round(b.right)}`);
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible' && getComputedStyle(el).textOverflow !== 'ellipsis') out.push(`${el.className} clipped ${el.scrollWidth}>${el.clientWidth}`);
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (hasText) { const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 14) out.push(`SMALL ${el.className || el.tagName} ${fs}px "${el.textContent.trim().slice(0, 18)}"`); }
    }
    return [...new Set(out)];
  });
  console.log('wrote', name, 'audit:', audit.length ? audit : 'clean');
  await ctx.close();
}
await browser.close();
