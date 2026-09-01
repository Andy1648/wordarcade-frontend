import { chromium } from '@playwright/test';
import fs from 'fs'; import path from 'path';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const OUT = 'claude/name-the-currency/shots'; fs.mkdirSync(OUT, { recursive: true });
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
const b = await chromium.launch();
for (const [w, h] of [[360, 640], [390, 844]]) {
  const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript(() => { try { localStorage.setItem('taw.wins', '12345'); localStorage.setItem('taw.xp', JSON.stringify({ lv: 12, into: 40 })); } catch {} });
  await p.goto('/?portal=1'); await waitImg(p); await p.waitForTimeout(500);
  // menu bar crop
  await p.locator('.menu-xp-bar').screenshot({ path: path.join(OUT, `menu-bar-${w}.png`) }).catch(()=>{});
  // fit check: does the menu still fit one screen?
  const fit = await p.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, cw: document.scrollingElement.clientWidth, sh: document.scrollingElement.scrollHeight, ch: document.scrollingElement.clientHeight }));
  console.log(`[menu ${w}] overflowX=${fit.sw>fit.cw} (${fit.sw}/${fit.cw})  overflowY=${fit.sh>fit.ch} (${fit.sh}/${fit.ch})`);
  // shop
  await p.locator('.homepage-nav-btn.is-shop').click(); await p.locator('.shop-panel').waitFor(); await p.waitForTimeout(400);
  await p.locator('.shop-header').screenshot({ path: path.join(OUT, `shop-header-${w}.png`) }).catch(async()=>{ await p.locator('.shop-panel').screenshot({ path: path.join(OUT, `shop-header-${w}.png`) }); });
  await p.locator('.shop-panel').screenshot({ path: path.join(OUT, `shop-panel-${w}.png`) }).catch(()=>{});
  await ctx.close();
}
await b.close();
