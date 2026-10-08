// ROLL SCREEN state stress (layout pass): worn mark with the longest stat, AUTO → LEGENDARY+ with SKIP < LEGENDARY,
// the result line (dupe + NEW), NO GEMS. Reports boxes leaving the viewport / overlapping + shots.
//   SHOT_FONTS=1 TAG=before OUT=/tmp/rollaudit node tools/_shots/r4layout-states.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const base = process.env.BASE || 'http://localhost:4173';
const out = process.env.OUT || '/tmp/rollaudit';
const tag = process.env.TAG || 'before';
const sizes = (process.env.SIZES || '1366x657 1920x1080 390x844 360x640').split(' ').map((s) => s.split('x').map(Number));
fs.mkdirSync(out, { recursive: true });

const gemsOf = (bal) => JSON.stringify({ v: 1, bal, peak: 12, streak: 0, mig: 1 });
const SEED = {
  'taw.rollsOn': '1', 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1',
  'taw.xp': JSON.stringify({ lv: 12, into: 0 }), 'taw.marksRevealed': '1', 'taw.marksOwned': '["mk-singularity","mk-sparky"]', 'taw.marksSeen': '[]',
  'taw.wins': '50000000', 'taw.gems': gemsOf(Number(process.env.GEMS || 1000)), 'taw.mark': 'mk-singularity',
};
const state = { v: 2, rolls: 30, sinceEpic: 5, sinceLegendary: 30, everEpic: true, starter: true, marks: { 'mk-singularity': { n: 1, first: 1 }, 'mk-sparky': { n: 12, first: 1 } }, milestones: [], skipBelow: 'legendary', done: [] };
if (process.env.TIER === 'legendary') state.sinceLegendary = 499;

const AUDIT = () => {
  const root = document.querySelector('.rs-overlay');
  const vw = innerWidth, vh = innerHeight;
  const sel = '.rs-roll, .rs-auto-btn, .rs-skip, .rs-skip-v, .rs-skip-btn, .rs-pity-row, .rs-pity-big, .rs-auto-cap, .rs-gems-bal, .rs-index-btn, .rs-close, .rs-equipped, .rs-stage, .rs-result, .rs-need, .rs-chip, .rs-res-name, .rs-card-stat';
  const els = [...root.querySelectorAll(sel)].map((e) => ({ cls: e.className.split(' ')[0], r: e.getBoundingClientRect(), e })).filter((b) => b.r.width);
  const out = [], ovl = [];
  for (const b of els) {
    if (b.r.left < -1 || b.r.right > vw + 1 || b.r.top < -1 || b.r.bottom > vh + 1) out.push([b.cls, b.r.left | 0, b.r.top | 0, b.r.right | 0, b.r.bottom | 0]);
    if (b.e.scrollWidth > b.e.clientWidth + 1 && (getComputedStyle(b.e).overflow !== 'visible' || ['rs-skip-v', 'rs-auto-btn', 'rs-roll', 'rs-chip'].includes(b.cls))) out.push([b.cls, 'textwider', b.e.scrollWidth, b.e.clientWidth]);
  }
  const tops = els.filter((b) => ['rs-roll', 'rs-auto-btn', 'rs-skip', 'rs-pity-row', 'rs-pity-big', 'rs-auto-cap', 'rs-gems-bal', 'rs-index-btn', 'rs-close', 'rs-equipped', 'rs-stage', 'rs-need'].includes(b.cls));
  for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) {
    const a = tops[i].r, c = tops[j].r;
    const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left), oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
    if (ox > 2 && oy > 2) ovl.push([tops[i].cls, tops[j].cls, ox | 0, oy | 0]);
  }
  // text that leaves its boxed parent
  const leaks = [];
  for (const b of els) {
    if (!['rs-res-name', 'rs-card-stat', 'rs-chip', 'rs-skip-v', 'rs-pity-big'].includes(b.cls)) continue;
    const p = b.e.closest('.rs-result-slot, .rs-skip, .rs-rollcol');
    if (!p) continue;
    const pr = p.getBoundingClientRect();
    if (b.r.left < pr.left - 1 || b.r.right > pr.right + 1) leaks.push([b.cls, b.e.textContent.slice(0, 20), b.r.left | 0, b.r.right | 0, pr.left | 0, pr.right | 0]);
  }
  const st = root.querySelector('.rs-stage').getBoundingClientRect(); const win = root.querySelector('.rs-win').getBoundingClientRect();
  if (win.top < st.top + 6 || win.bottom > st.bottom - 6) out.push(['rs-win-vs-stage', win.top | 0, win.bottom | 0, st.top | 0, st.bottom | 0]);
  const rs = root.querySelector('.rs-result'); if (rs) { const rr = rs.getBoundingClientRect(); if (rr.bottom > st.bottom - 6 || rr.top < win.bottom) out.push(['rs-result-vs-stage', rr.top | 0, rr.bottom | 0, win.bottom | 0, st.bottom | 0]); }
  return { out, ovl, leaks, res: (root.querySelector('.rs-result') || {}).textContent || '', autoTxt: (root.querySelector('.rs-auto-btn') || {}).textContent, docW: document.documentElement.scrollWidth };
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await installBackendMock(page, { seedReduceMotion: false });
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch { /* */ } } }, { ...SEED, 'taw.markRolls': JSON.stringify(state) });
  await page.goto(`${base}/?portal=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.locator('.hp-nav.is-gears:visible').first().click({ force: true });
  await page.locator('.rs-overlay').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  const log = (m, a) => console.log(`${w}x${h} ${m}: auto="${a.autoTxt}" res="${a.res.slice(0, 40)}" docW=${a.docW}` + (a.out.length ? ` OUT=${JSON.stringify(a.out)}` : '') + (a.ovl.length ? ` OVL=${JSON.stringify(a.ovl)}` : '') + (a.leaks.length ? ` LEAK=${JSON.stringify(a.leaks)}` : ''));
  log('rest-worn', await page.evaluate(AUDIT));
  await page.screenshot({ path: `${out}/${tag}-worn-${w}x${h}.png` });
  if (process.env.GEMS === '0') {
    const box = await page.locator('.rs-roll').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
    log('nogems', await page.evaluate(AUDIT));
    await page.screenshot({ path: `${out}/${tag}-nogems-${w}x${h}.png` });
    await ctx.close();
    continue;
  }
  // AUTO → LEGENDARY+: 3 taps (OFF → RARE+ → EPIC+ → LEGENDARY+); the first starts rolling
  const autoBtn = page.locator('.rs-auto-btn');
  await autoBtn.click(); await page.waitForTimeout(80); await autoBtn.click(); await page.waitForTimeout(80); await autoBtn.click();
  await page.waitForTimeout(300);
  log('auto-leg', await page.evaluate(AUDIT));
  await page.screenshot({ path: `${out}/${tag}-autoleg-${w}x${h}.png` });
  await page.waitForTimeout(3600);
  log('auto-result', await page.evaluate(AUDIT));
  await page.screenshot({ path: `${out}/${tag}-autores-${w}x${h}.png` });
  await autoBtn.click(); // → OFF
  await page.waitForTimeout(4500);
  // one more roll (a dupe of sparky most likely, or a legendary with TIER=legendary) — hold to roll
  const box = await page.locator('.rs-roll').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(560); await page.mouse.up();
  await page.waitForTimeout(4200);
  const cut = page.locator('[data-testid="roll-cutscene"]');
  if (await cut.evaluate((el) => el.classList.contains('is-on')).catch(() => false)) {
    await page.screenshot({ path: `${out}/${tag}-reveal-${w}x${h}.png` });
    await cut.click({ force: true }); await page.waitForTimeout(900);
  }
  log('result', await page.evaluate(AUDIT));
  await page.screenshot({ path: `${out}/${tag}-result-${w}x${h}.png` });
  if (errs.length) console.log('  PAGEERRORS:', errs.join(' | '));
  await ctx.close();
}
await browser.close();
