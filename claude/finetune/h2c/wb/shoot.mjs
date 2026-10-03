// H2c WB huge-screen shots + a per-element geometry dump (to prove the sub-2200 sizes are unchanged).
// usage: node claude/finetune/h2c/wb/shoot.mjs <tag> [vp,vp,...]   (needs `npx vite preview --port 4191`)
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCREENS } from '../../../../e2e/support/screens.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const tag = process.argv[2] || 'shot';
const vps = (process.argv[3] || '2560x1440,1920x1080,1366x625,1280x551,390x844').split(',');
const names = ['ingame-word-bomb', 'ingame-category-blitz', 'gameover-word-bomb'];
const browser = await chromium.launch();
const report = {};
for (const vp of vps) {
  const [w, h] = vp.split('x').map(Number);
  for (const n of names) {
    const s = SCREENS.find((x) => x.name === n);
    const ctx = await browser.newContext({ baseURL: 'http://localhost:4191', viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    try {
      await s.nav(page);
      await page.waitForTimeout(4500);
      if (vp === '2560x1440' || vp === '1920x1080') await page.screenshot({ path: path.join(here, `${tag}-${n}-${vp}.png`) });
      report[`${n}@${vp}`] = await page.evaluate(() => {
        const root = document.querySelector('.game-over-overlay') || document.querySelector('.game-wrap');
        const all = root ? [root, ...root.querySelectorAll('*')] : [];
        const cls = (e) => (typeof e.className === 'string' ? e.className : 'svg');
        return {
          all: all.map((e) => { const r = e.getBoundingClientRect(); return [cls(e), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), getComputedStyle(e).fontSize].join('|'); }),
          clipped: all.filter((e) => e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map((e) => cls(e) + ':' + e.textContent.trim().slice(0, 24)),
          docOverflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
        };
      });
    } catch (e) { report[`${n}@${vp}`] = { err: String(e).slice(0, 300) }; }
    await ctx.close();
  }
}
fs.writeFileSync(path.join(here, `${tag}-geom.json`), JSON.stringify(report, null, 1));
await browser.close();
console.log('done', tag);
