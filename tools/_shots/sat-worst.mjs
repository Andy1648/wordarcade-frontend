import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const sizes = (process.env.SIZES || '1366x657 1280x551 1366x768 390x844 360x640').split(' ').map((s) => s.split('x').map(Number));
for (const [w,h] of sizes) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript(() => { localStorage.setItem('taw.seenMenu','1'); localStorage.setItem('taw.xp', JSON.stringify({lv:12,into:0})); });
  await p.goto('http://localhost:4173/?satRush=1&satrush=1&portal=1&season2=1&stage=400&spell=250', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1800);
  // the longest clue in the lexicon + a long gloss + a long root line, all forced visible
  const r = await p.evaluate(() => {
    const f = document.querySelector('.sr-fields'); if (!f) return 'no fields';
    const s = document.querySelector('.sr-sentence'); s.textContent = 'Even after the committee had rejected the proposal twice, she remained ––––––––– enough to redraft it a third time and resubmit it.';
    let g = document.querySelector('.sr-gloss'); if (!g) { const d = document.createElement('div'); d.className = 'sr-field sr-field--gloss sr-reveal in'; d.innerHTML = '<span class="sr-fieldlabel">Description</span><div class="sr-fieldbody sr-gloss"></div>'; f.appendChild(d); g = d.querySelector('.sr-gloss'); } else g.closest('.sr-field').classList.add('in');
    g.textContent = '“impossible to stop, persuade or talk out of a course of action”';
    let rt = document.querySelector('.sr-root'); if (!rt) { const d = document.createElement('div'); d.className = 'sr-field sr-field--root sr-reveal in'; d.innerHTML = '<span class="sr-fieldlabel">Known aliases</span><div class="sr-fieldbody sr-root"></div>'; f.appendChild(d); rt = d.querySelector('.sr-root'); } else rt.closest('.sr-field').classList.add('in');
    rt.innerHTML = '<b>OR-</b> — to plead, speak <span class="cz">· orator · oracle · adore · oration</span>';
    return { sh: f.scrollHeight, ch: f.clientHeight, lines: Math.round(s.getBoundingClientRect().height / parseFloat(getComputedStyle(s).lineHeight)) };
  });
  await p.waitForTimeout(300);
  const r2 = await p.evaluate(() => { const f = document.querySelector('.sr-fields'); return { sh: f.scrollHeight, ch: f.clientHeight }; });
  console.log(`${w}x${h} worst-case fields ${r2.sh}/${r2.ch} ${r2.sh > r2.ch + 1 ? 'SCROLLS by ' + (r2.sh - r2.ch) : 'fits'} (clue lines=${r.lines})`);
  await p.screenshot({ path: `claude/night-oct8-r3/_raw/satw-${process.env.TAG || 'x'}-${w}x${h}.png` });
  await ctx.close();
}
await b.close();
