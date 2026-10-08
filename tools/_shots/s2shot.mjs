// s2shot.mjs — screenshot a SEASON-2 screen through the e2e backend mock, with a seeded save.
// Env: OUT (dir), TAG (file prefix), JPG=1 (jpeg), CLICK (selector to click after NAV) + WAIT2 (ms), SEEDJSON ('{"taw.key":"value"}' extra localStorage), SIZES ("1366x657 390x844"), WINS, GEMS, LV, F (0..1), REB, KEYT,
//      NAV (data-nav id to open after the menu loads, e.g. "stats"), WAIT (ms after nav), MOTION=1 (keep motion).
// Usage: OUT=/tmp/x TAG=menu WINS=999999999 node tools/_shots/s2shot.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { navControl } from '../../e2e/support/menu.js';

const out = process.env.OUT || 'shots';
fs.mkdirSync(out, { recursive: true });
const sizes = (process.env.SIZES || '1366x657 390x844').split(' ').map((s) => s.split('x').map(Number));
const seed = {
  wins: process.env.WINS || '500', gems: Number(process.env.GEMS || 40), lv: Number(process.env.LV || 6),
  f: Number(process.env.F || 0.4), reb: process.env.REB || '0', keyt: process.env.KEYT || '0', numStyle: process.env.NUMSTYLE || '', extra: process.env.SEEDJSON ? JSON.parse(process.env.SEEDJSON) : {},
};
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({
    baseURL: process.env.BASE || 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 1,
    reducedMotion: process.env.MOTION ? 'no-preference' : 'reduce',
  });
  const page = await ctx.newPage();
  await installBackendMock(page);
  // the mock aborts every external request — let the Google Fonts through, or every shot is in the fallback face
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
  await page.addInitScript((s) => {
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.s2.welcomed', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: s.lv, f: s.f, rc: Number(s.reb), v: 10 }));
    localStorage.setItem('taw.s2.wins', s.wins);
    localStorage.setItem('taw.s2.rebirths', s.reb);
    localStorage.setItem('taw.s2.keytier', s.keyt);
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: s.gems }));
    if (s.numStyle) localStorage.setItem('taw.numStyle', s.numStyle);
    for (const [k, v] of Object.entries(s.extra || {})) localStorage.setItem(k, v);
  }, seed);
  await page.goto('/?portal=1&season2=1');
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.fonts && document.fonts.ready);
  if (process.env.NAV) {
    await navControl(page, process.env.NAV).click().catch((e) => console.log('nav fail', e.message));
    await page.waitForTimeout(Number(process.env.WAIT || 900));
  }
  if (process.env.CLICK) {
    await page.locator(process.env.CLICK).first().click().catch((e) => console.log('click fail', e.message));
    await page.waitForTimeout(Number(process.env.WAIT2 || 3500));
  }
  const jpg = !!process.env.JPG; // JPG=1: an 80-quality JPEG (PR-body shots committed to the repo stay small)
  const name = `${process.env.TAG || 'menu'}-${w}x${h}.${jpg ? 'jpg' : 'png'}`;
  await page.screenshot({ path: `${out}/${name}`, ...(jpg ? { type: 'jpeg', quality: 80 } : {}) });
  console.log('wrote', name);
  await ctx.close();
}
await browser.close();
