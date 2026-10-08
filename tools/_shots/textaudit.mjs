// textaudit.mjs — the RENDERED size of every text run on a season-2 screen (NIGHT oct8 #5): computed font-size × the
// element's on-screen scale (a scaled stage shrinks text the CSS never sees). Flags a label < 14 px, a number < 18 px,
// and any text whose box leaves its parent box. Usage: NAV=stats node tools/_shots/textaudit.mjs  (same env as s2shot).
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { navControl } from '../../e2e/support/menu.js';

const sizes = (process.env.SIZES || '1366x657 390x844').split(' ').map((s) => s.split('x').map(Number));
const seed = { wins: process.env.WINS || '123456', gems: Number(process.env.GEMS || 1800), lv: Number(process.env.LV || 12), f: Number(process.env.F || 0.5), reb: process.env.REB || '2' };
const root = process.env.ROOT || 'body';
const browser = await chromium.launch();
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ baseURL: 'http://localhost:4173', viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await installBackendMock(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
  await page.addInitScript((s) => {
    localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.s2.welcomed', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: s.lv, f: s.f, rc: Number(s.reb), v: 10 }));
    localStorage.setItem('taw.s2.wins', s.wins); localStorage.setItem('taw.s2.rebirths', s.reb);
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: s.gems }));
  }, seed);
  await page.goto('/?portal=1&season2=1');
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.fonts && document.fonts.ready);
  if (process.env.NAV) { await navControl(page, process.env.NAV).click(); await page.waitForTimeout(1500); }
  const bad = await page.evaluate((sel) => {
    const out = [];
    const host = document.querySelector(sel) || document.body;
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const t = walker.currentNode;
      const txt = t.textContent.trim();
      if (!txt) continue;
      const el = t.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2) continue; // sr-only text
      if (el.closest('[aria-hidden="true"]') && el.closest('.rs-cut, .gl, .gsb')) continue;
      const scale = el.offsetHeight ? r.height / el.offsetHeight : 1;
      const px = parseFloat(cs.fontSize) * scale;
      const num = /\d/.test(txt);
      const min = num ? 18 : 14;
      const flags = [];
      if (px < min - 0.25) flags.push(`${num ? 'NUM' : 'LBL'} ${px.toFixed(1)}px<${min}`);
      const p = el.parentElement && el.parentElement.getBoundingClientRect();
      if (p && (r.right > p.right + 2 || r.left < p.left - 2) && getComputedStyle(el.parentElement).overflow !== 'visible') flags.push('LEAVES-BOX');
      if (r.right > innerWidth + 1 || r.left < -1) flags.push('OFFSCREEN');
      if (flags.length) out.push(`${flags.join(' ')} | ${el.className && el.className.baseVal == null ? el.className : el.tagName} | "${txt.slice(0, 40)}"`);
    }
    return out;
  }, root);
  console.log(`== ${w}x${h} ${process.env.NAV || 'menu'}: ${bad.length} flagged`);
  for (const b of bad) console.log('  ' + b);
  await ctx.close();
}
await browser.close();
