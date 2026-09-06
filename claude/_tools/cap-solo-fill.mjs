// cap-solo-fill.mjs — screenshot CHAIN/FUSE mid-play at the four fill viewports + print fill.
import { chromium } from '@playwright/test';
import fs from 'fs'; import path from 'path';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const OUT = process.argv[2] || 'claude/ingame-pass/shots/fill'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173';
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
const VPS = process.argv[3] === 'all' ? [[1920,1080],[1568,675],[1366,768],[1280,551]] : [[1920,1080],[1280,551]];
async function openSolo(p, game) {
  await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch {} });
  await p.goto('/?portal=1&soloms=20000'); await waitImg(p); await p.waitForTimeout(250);
  await p.locator(`.game-card-magnet[data-game="${game}"] .game-card`).click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
  await p.locator('.solo-root').waitFor();
  const i = p.locator('.solo-root input').first(); await i.waitFor(); await i.fill(game === 'chain' ? 'e' : 'a'); await p.waitForTimeout(400);
}
const b = await chromium.launch();
for (const [w, h] of VPS) {
  for (const game of ['chain', 'fuse']) {
    const ctx = await b.newContext({ baseURL: BASE, viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); await installBackendMock(p);
    let fill = '?';
    try {
      await openSolo(p, game);
      fill = await p.evaluate(() => { const r = document.querySelector('.solo-root').getBoundingClientRect(); return { fw: +(r.width/innerWidth*100).toFixed(1), fh: +(r.height/innerHeight*100).toFixed(1), w: Math.round(r.width) }; });
      await p.screenshot({ path: path.join(OUT, `${game}-${w}x${h}.png`) });
    } catch (e) { fill = 'ERR ' + String(e).split('\n')[0].slice(0,60); }
    console.log(`${game}-${w}x${h}`.padEnd(18), JSON.stringify(fill));
    await ctx.close();
  }
}
await b.close();
