// SAT RUSH poster fit probe: plays a (fast, ?stage=400) deep-linked LINEUP run and logs, per word, whether
// .sr-fields scrolls, the type sizes, and the box rects. Screenshots the first scrolling 4+ line clue.
//   SIZES='1366x657 390x844' TAG=x node tools/_shots/sat-measure.mjs
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const sizes = (process.env.SIZES || '1366x657 390x844').split(' ').map((s) => s.split('x').map(Number));
for (const [w, h] of sizes) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript(() => { localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.xp', JSON.stringify({ lv: 12, into: 0 })); });
  await p.goto('http://localhost:4173/?satRush=1&satrush=1&portal=1&season2=1&stage=400&spell=250' + (process.env.Q || ''), { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  let worst = null; const seen = new Set();
  for (let i = 0; i < 60 && seen.size < 12; i++) {
    const r = await p.evaluate(() => {
      const q = (s) => document.querySelector(s); const fs = (el) => (el ? getComputedStyle(el).fontSize : null);
      const f = q('.sr-fields'); if (!f) return null;
      const rect = (s) => { const e = q(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
      return { sent: q('.sr-sentence')?.innerText.slice(0, 30), sh: f.scrollHeight, ch: f.clientHeight, lines: Math.round(q('.sr-sentence').getBoundingClientRect().height / parseFloat(getComputedStyle(q('.sr-sentence')).lineHeight)),
        fs: { sent: fs(q('.sr-sentence')), gloss: fs(q('.sr-gloss')), root: fs(q('.sr-root')), label: fs(q('.sr-fieldlabel')), case: fs(q('.sr-caseid')), mult: fs(q('.sr-mult')), hval: fs(q('.sr-hval')), hlabel: fs(q('.sr-hlabel')) },
        slots: rect('.sr-slots'), slot: rect('.sr-slot'), n: document.querySelectorAll('.sr-slot').length, stage: rect('.sr-stage'), lineup: rect('.sr-lineup'), reward: rect('.sr-reward'), hud: rect('.sr-hud') };
    });
    if (r && r.sent && !seen.has(r.sent)) {
      seen.add(r.sent); if (!worst || r.sh - r.ch > worst.sh - worst.ch) worst = r;
      if (r.sh > r.ch + 1 && r.lines >= 4 && !p.__shot) { p.__shot = 1; await p.screenshot({ path: `claude/night-oct8-r3/_raw/satm-${process.env.TAG || 'x'}-worst-${w}x${h}.png` }); }
      if (r.sh > r.ch + 1) console.log(`${w}x${h} SCROLLS ${r.sh}>${r.ch} lines=${r.lines} "${r.sent}"`);
    }
    await p.waitForTimeout(1000);
    if (await p.locator('.sr-respage, .sr-results').count()) break;
    if (await p.locator('.sr-reencode-hint').count()) await p.keyboard.press('Space');
  }
  console.log(`${w}x${h} worst:`, JSON.stringify(worst));
  await p.screenshot({ path: `claude/night-oct8-r3/_raw/satm-${process.env.TAG || 'x'}-${w}x${h}.png` });
  await ctx.close();
}
await b.close();
