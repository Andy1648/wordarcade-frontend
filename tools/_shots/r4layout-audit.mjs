// ROLL SCREEN LAYOUT AUDIT — 4 viewports, real fonts. Reports: text nodes < threshold, overflow, native controls,
// infinite animations at idle. Shots to OUT/TAG-rest-WxH.png.
//   SHOT_FONTS=1 TAG=before OUT=... node tools/_shots/r4layout-audit.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const base = process.env.BASE || 'http://localhost:4173';
const out = process.env.OUT || '/tmp/rollaudit';
const tag = process.env.TAG || 'before';
const sizes = (process.env.SIZES || '1366x657 1920x1080 390x844 360x640').split(' ').map((s) => s.split('x').map(Number));
const moments = (process.env.MOMENTS || 'rest').split(',');
fs.mkdirSync(out, { recursive: true });

const gemsOf = (bal) => JSON.stringify({ v: 1, bal, peak: 12, streak: 0, mig: 1 });
const SEED = {
  'taw.rollsOn': '1', 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1',
  'taw.xp': JSON.stringify({ lv: 12, into: 0 }), 'taw.marksRevealed': '1', 'taw.marksOwned': '[]', 'taw.marksSeen': '[]',
  'taw.wins': '50000000', 'taw.gems': gemsOf(1000),
};
const state = { v: 2, rolls: 30, sinceEpic: 5, sinceLegendary: 30, everEpic: true, starter: true, marks: { 'mk-eclipse': { n: 1, first: 1 } }, milestones: [], skipBelow: 'epic', done: [] };
if (process.env.WORN) SEED['taw.markEquipped'] = process.env.WORN;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const report = [];
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'no-preference', isMobile: w < 500, hasTouch: w < 500 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await installBackendMock(page, { seedReduceMotion: false });
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch { /* */ } } }, { ...SEED, 'taw.markRolls': JSON.stringify(state) });
  await page.goto(`${base}/?portal=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('.hp-nav.is-gears:visible').first().click({ force: true });
  await page.locator('.rs-overlay').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  const audit = await page.evaluate(() => {
    const root = document.querySelector('.rs-overlay');
    const vw = innerWidth, vh = innerHeight;
    const small = [];
    const overflow = [];
    const natives = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let n;
    while ((n = walker.nextNode())) {
      const t = n.textContent.trim();
      if (!t) continue;
      const el = n.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.classList.contains('rs-sr')) continue;
      const fs = parseFloat(cs.fontSize);
      const cls = el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName;
      const isNum = /^[\d.,×x+%−-]+$/.test(t) || el.classList.contains('rs-pity-n') || el.tagName === 'B';
      const min = isNum ? 18 : 14;
      if (fs < min) small.push({ cls, text: t.slice(0, 24), fs: +fs.toFixed(1), min });
      // outside viewport / clipped
      if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) overflow.push({ cls, text: t.slice(0, 24), why: 'viewport', rect: [r.left | 0, r.top | 0, r.right | 0, r.bottom | 0] });
      // text wider than its own box
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible') overflow.push({ cls, text: t.slice(0, 24), why: 'clip-self', sw: el.scrollWidth, cw: el.clientWidth });
      // outside nearest ancestor with a border/background (box)
      let p = el.parentElement;
      while (p && p !== root) {
        const pcs = getComputedStyle(p);
        const boxed = parseFloat(pcs.borderTopWidth) > 0 || (pcs.backgroundColor !== 'rgba(0, 0, 0, 0)' && pcs.position !== 'static');
        if (boxed) {
          const pr = p.getBoundingClientRect();
          if (r.left < pr.left - 1 || r.right > pr.right + 1 || r.top < pr.top - 1 || r.bottom > pr.bottom + 1) overflow.push({ cls, text: t.slice(0, 24), why: 'leaves ' + (p.className && typeof p.className === 'string' ? p.className.split(' ')[0] : p.tagName), rect: [r.left | 0, r.top | 0, r.right | 0, r.bottom | 0], prect: [pr.left | 0, pr.top | 0, pr.right | 0, pr.bottom | 0] });
          break;
        }
        p = p.parentElement;
      }
    }
    root.querySelectorAll('select, input, textarea, progress, meter').forEach((e) => natives.push(e.tagName + '.' + e.className));
    // boxes vs viewport
    const boxes = [];
    root.querySelectorAll('.rs-roll, .rs-auto-btn, .rs-skip, .rs-pity-row, .rs-gems-bal, .rs-index-btn, .rs-close, .rs-equipped, .rs-stage, .rs-controls').forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width && (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1)) boxes.push({ cls: e.className.split(' ')[0], rect: [r.left | 0, r.top | 0, r.right | 0, r.bottom | 0] });
    });
    // overlapping boxes among bottom controls
    const ctrls = [...root.querySelectorAll('.rs-roll, .rs-auto-btn, .rs-skip, .rs-pity-row, .rs-pity-big, .rs-auto-cap, .rs-result-slot, .rs-stage')].map((e) => ({ cls: e.className.split(' ')[0], r: e.getBoundingClientRect() })).filter((b) => b.r.width);
    const overlaps = [];
    for (let i = 0; i < ctrls.length; i++) for (let j = i + 1; j < ctrls.length; j++) {
      const a = ctrls[i].r, b = ctrls[j].r;
      if (ctrls[i].cls === 'rs-stage' && ctrls[j].cls === 'rs-result-slot') continue;
      if (ctrls[j].cls === 'rs-stage' && ctrls[i].cls === 'rs-result-slot') continue;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 2 && oy > 2) overlaps.push([ctrls[i].cls, ctrls[j].cls, ox | 0, oy | 0]);
    }
    const anims = document.getAnimations().filter((a) => a.playState === 'running').map((a) => {
      const t = a.effect && a.effect.target;
      const it = a.effect && a.effect.getTiming ? a.effect.getTiming().iterations : '?';
      return { target: t ? (t.className && typeof t.className === 'string' ? t.className.split(' ').slice(0, 2).join('.') : t.tagName) : '?', name: a.animationName || a.id || 'waapi', iterations: it };
    });
    const inf = anims.filter((a) => a.iterations === Infinity);
    const html = document.documentElement;
    return { small, overflow, natives, boxes, overlaps, infinite: inf, running: anims.length, docW: html.scrollWidth, vw, docH: html.scrollHeight, vh };
  });
  const shot = async (m) => { if (moments.includes(m)) await page.screenshot({ path: `${out}/${tag}-${m}-${w}x${h}.png` }); };
  await shot('rest');
  report.push({ size: `${w}x${h}`, ...audit, errs });
  await ctx.close();
}
await browser.close();
for (const r of report) {
  console.log(`\n=== ${r.size} (doc ${r.docW}x${r.docH} vs ${r.vw}x${r.vh}) running anims ${r.running}, infinite ${r.infinite.length}`);
  if (r.infinite.length) console.log('  INFINITE:', JSON.stringify(r.infinite));
  if (r.natives.length) console.log('  NATIVE:', r.natives.join(', '));
  if (r.small.length) console.log('  SMALL:', r.small.map((s) => `${s.cls} "${s.text}" ${s.fs}px<${s.min}`).join(' | '));
  if (r.overflow.length) console.log('  OVERFLOW:', JSON.stringify(r.overflow));
  if (r.boxes.length) console.log('  BOX OUT OF VIEWPORT:', JSON.stringify(r.boxes));
  if (r.overlaps.length) console.log('  OVERLAPS:', JSON.stringify(r.overlaps));
  if (r.errs.length) console.log('  PAGEERRORS:', r.errs.join(' | '));
}
fs.writeFileSync(path.join(out, `${tag}-audit.json`), JSON.stringify(report, null, 1));
