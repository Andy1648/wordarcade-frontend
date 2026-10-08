// NIGHT OCT8 R3 — screenshot any screen against a local vite preview at the two Andy sizes.
//   PATHQ='/?fuse=1&portal=1' TAG=fuse ACT='type:a;wait:1500' node tools/_shots/r3.mjs
// ACT is a ';'-separated mini-script: click:<selector> | type:<text> | fill:<text> | press:<key> |
// wait:<ms> | waitfor:<selector> | seed:<key>=<value> (localStorage, before goto) | eval:<js>.
// Uses the e2e backend mock so no socket ever reaches production.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const base = process.env.BASE || 'http://localhost:4173';
const out = process.env.OUT || 'claude/night-oct8-r3/_raw';
const pathq = process.env.PATHQ || '/?portal=1';
const tag = process.env.TAG || 'shot';
const act = (process.env.ACT || '').split(';').map((s) => s.trim()).filter(Boolean);
const sizes = (process.env.SIZES || '1366x657 390x844').split(' ').map((s) => s.split('x').map(Number));
const motion = process.env.MOTION === '1';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: motion ? 'no-preference' : 'reduce' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await installBackendMock(page, { seedReduceMotion: !motion });
  const seeds = act.filter((a) => a.startsWith('seed:')).map((a) => a.slice(5));
  await page.addInitScript((seeds) => {
    try { localStorage.setItem('taw.seenMenu', '1'); } catch { /* */ }
    for (const s of seeds) { const i = s.indexOf('='); try { localStorage.setItem(s.slice(0, i), s.slice(i + 1)); } catch { /* */ } }
  }, seeds);
  await page.goto(base + pathq, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  for (const a of act) {
    const i = a.indexOf(':'); const op = a.slice(0, i); const arg = a.slice(i + 1);
    try {
      if (op === 'click') await page.locator(arg).first().click({ force: true, timeout: 5000 });
      else if (op === 'type') await page.keyboard.type(arg, { delay: 40 });
      else if (op === 'fill') await page.locator('input').first().fill(arg);
      else if (op === 'press') await page.keyboard.press(arg);
      else if (op === 'wait') await page.waitForTimeout(Number(arg));
      else if (op === 'waitfor') await page.locator(arg).first().waitFor({ state: 'visible', timeout: 20000 });
      else if (op === 'eval') await page.evaluate(arg);
      else if (op === 'shot') await page.screenshot({ path: `${out}/${tag}-${arg}-${w}x${h}.png` });
      else if (op === 'until3') {
        // solve until the fragment on screen has `arg` letters (FUSE hero fit check)
        const words = fs.readFileSync('src/solo/words.recall.txt', 'utf8').split(/\s+/).filter((x) => x.length >= 4);
        for (let n = 0; n < 30; n++) {
          const ph = await page.locator('.solo-root input').first().getAttribute('placeholder');
          const m = /"([A-Z]+)"/.exec(ph || ''); if (!m || m[1].length === Number(arg)) break;
          const frag = m[1].toLowerCase();
          const pick = words.find((x) => x.includes(frag)); if (!pick) break;
          await page.locator('.solo-root input').first().fill(pick); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
        }
      }
      else if (op === 'fusesolve') {
        // solve N FUSE fragments with real words from the recall list (reads the fragment off the input placeholder)
        const words = fs.readFileSync('src/solo/words.recall.txt', 'utf8').split(/\s+/).filter((x) => x.length >= 4);
        const used = new Set();
        for (let n = 0; n < Number(arg); n++) {
          const ph = await page.locator('.solo-root input').first().getAttribute('placeholder');
          const m = /"([A-Z]+)"/.exec(ph || ''); if (!m) break;
          const frag = m[1].toLowerCase();
          const pick = words.filter((x) => x.includes(frag) && !used.has(x)).sort((a, b) => new Set(b).size - new Set(a).size)[0];
          if (!pick) break; used.add(pick);
          await page.locator('.solo-root input').first().fill(pick); await page.keyboard.press('Enter'); await page.waitForTimeout(700);
        }
      }
    } catch (e) { console.log(`act ${a} failed @${w}x${h}:`, String(e).split('\n')[0].slice(0, 120)); }
  }
  const name = `${tag}-${w}x${h}.png`;
  await page.screenshot({ path: `${out}/${name}` });
  // overflow audit: any text node whose box leaves its parent's box, plus tiny fonts
  const audit = await page.evaluate(() => {
    const bad = []; const small = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let el;
    while ((el = walker.nextNode())) {
      if (!el.checkVisibility || !el.checkVisibility()) continue;
      const cs = getComputedStyle(el);
      const txt = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      if (!txt) continue;
      const fs = parseFloat(cs.fontSize);
      if (fs < 14) small.push(`${fs}px "${txt.slice(0, 24)}" <${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')}>`);
      const r = el.getBoundingClientRect(); if (r.width === 0) continue;
      let p = el.parentElement;
      while (p && p !== document.body) {
        const pcs = getComputedStyle(p);
        if (pcs.overflow !== 'visible' || p.classList.contains('solo-root') || p.tagName === 'BUTTON') break;
        p = p.parentElement;
      }
      if (p && p !== document.body) {
        const pr = p.getBoundingClientRect();
        if (r.right > pr.right + 2 || r.left < pr.left - 2 || r.bottom > pr.bottom + 2) bad.push(`"${txt.slice(0, 24)}" leaves <${p.tagName.toLowerCase()}.${[...p.classList].slice(0, 2).join('.')}> by ${Math.round(Math.max(r.right - pr.right, pr.left - r.left, r.bottom - pr.bottom))}px`);
      }
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible') bad.push(`"${txt.slice(0, 24)}" clips in itself (${el.scrollWidth}>${el.clientWidth})`);
    }
    const scrollers = [];
    document.querySelectorAll('*').forEach((n) => { const c = getComputedStyle(n); if ((c.overflowY === 'auto' || c.overflowY === 'scroll') && n.scrollHeight > n.clientHeight + 2 && n.clientHeight > 0) scrollers.push(`<${n.tagName.toLowerCase()}.${[...n.classList].slice(0, 2).join('.')}> ${n.scrollHeight}>${n.clientHeight}`); });
    return { bad: bad.slice(0, 12), small: [...new Set(small)].slice(0, 20), scrollers: scrollers.slice(0, 6) };
  });
  console.log(`wrote ${out}/${name}`);
  if (audit.small.length) console.log('  SMALL (<14px):', audit.small.join(' | '));
  if (audit.bad.length) console.log('  OVERFLOW:', audit.bad.join(' | '));
  if (audit.scrollers.length) console.log('  SCROLLERS:', audit.scrollers.join(' | '));
  if (errs.length) console.log('  PAGEERRORS:', errs.join(' | '));
  await ctx.close();
}
await browser.close();
