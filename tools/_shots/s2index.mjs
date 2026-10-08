// s2index.mjs — screenshot the GEARS INDEX (MarksIndex) with a seeded roll state: the first N marks of each tier owned
// (a few with dupes), the rest locked. Env: OUT, TAG, SIZES ("1366x657 390x844"), JPG=1, OWN (per-tier owned count,
// default 3), SHEET (a mark id to open its detail sheet). Goes menu → GEARS (ROLL) → INDEX like e2e/mark-rolls.spec.js.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { menuReady } from '../../e2e/support/menu.js';
import { ROLL_MARKS, ROLLABLE_TIERS } from '../../src/progress/markRollsCore.js';

const out = process.env.OUT || 'shots';
fs.mkdirSync(out, { recursive: true });
const sizes = (process.env.SIZES || '1366x657 390x844').split(' ').map((s) => s.split('x').map(Number));
const own = Number(process.env.OWN || 3);
const marks = {};
let roll = 1;
for (const tier of ROLLABLE_TIERS) {
  const ms = ROLL_MARKS.filter((m) => m.tier === tier).slice(0, own);
  ms.forEach((m, i) => { marks[m.id] = { n: i === 0 ? 7 : i === 1 ? 2 : 1, first: roll }; roll += 3; });
}
const state = { v: 2, rolls: 120, sinceEpic: 3, sinceLegendary: 40, everEpic: true, marks, milestones: [], starter: true, skipBelow: 'epic', done: [] };
const SEED = {
  'taw.rollsOn': '1', 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.marksRevealed': '1', 'taw.marksOwned': '[]', 'taw.marksSeen': '[]',
  'taw.tut.markRolls': '1', 'taw.s2.wins': '50000', 'taw.s2.gems': JSON.stringify({ v: 1, bal: 1000, peak: 12, streak: 0, mig: 1 }),
  'taw.s2.xp': JSON.stringify({ lv: 12, f: 0.2, rc: 0, v: 10 }), 'taw.markRolls': JSON.stringify(state), 'taw.s2.markRolls': JSON.stringify(state),
  'taw.s2.wornMark': Object.keys(marks)[0] || '', 'taw.wornMark': Object.keys(marks)[0] || '',
};
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ baseURL: process.env.BASE || 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await installBackendMock(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('mi.seeded')) return;
    sessionStorage.setItem('mi.seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, SEED);
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.locator('.hp-nav.is-gears:visible').first().click();
  await page.locator('.rs-overlay').waitFor();
  await page.waitForTimeout(600);
  await page.getByTestId('roll-index').click();
  await page.locator('.mx-panel').waitFor();
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts && document.fonts.ready);
  if (process.env.SHEET) { await page.locator(`.mx-tile[data-mark="${process.env.SHEET}"]`).click(); await page.waitForTimeout(600); }
  const jpg = !!process.env.JPG;
  const name = `${process.env.TAG || 'index'}-${w}x${h}.${jpg ? 'jpg' : 'png'}`;
  await page.screenshot({ path: `${out}/${name}`, ...(jpg ? { type: 'jpeg', quality: 80 } : {}) });
  const audit = await page.evaluate(() => {
    const r = document.querySelector('.mx-panel');
    const out = [];
    for (const el of r.querySelectorAll('*')) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (b.left < -1 || b.right > innerWidth + 1) out.push(`${el.className || el.tagName} x ${Math.round(b.left)}..${Math.round(b.right)}`);
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (hasText) {
        // rendered size = computed font-size × the card's transform scale
        let k = 1; let p = el;
        while (p && p !== r) { const m = getComputedStyle(p).transform; if (m && m !== 'none') { const a = m.match(/matrix\(([^,]+)/); if (a) k *= parseFloat(a[1]); } p = p.parentElement; }
        const fs = parseFloat(getComputedStyle(el).fontSize) * k;
        if (fs < 14) out.push(`SMALL ${el.className || el.tagName} ${fs.toFixed(1)}px "${el.textContent.trim().slice(0, 16)}"`);
        if (el.classList.contains('mc-name') && fs < 18) out.push(`NAME<18 ${el.textContent.trim()} ${fs.toFixed(1)}px`);
      }
    }
    return [...new Set(out)];
  });
  console.log('wrote', name, 'audit:', audit.length ? audit : 'clean');
  await ctx.close();
}
await browser.close();
