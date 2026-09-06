import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const b = await chromium.launch();
for (const dpr of [1, 1.25, 1.5, 2]) {
  const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 1280, height: 551 }, deviceScaleFactor: dpr });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch {} });
  await p.goto('/?portal=1&soloms=20000'); await p.getByRole('img', { name: 'Type a Word' }).waitFor(); await p.waitForTimeout(300);
  await p.locator('.game-card-magnet[data-game="fuse"] .game-card').click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
  await p.locator('.solo-root input').first().waitFor(); await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const strip = document.querySelector('.solo-strip-big'); const sb = strip.getBoundingClientRect();
    const cells = [...strip.querySelectorAll('span')];
    // per-row grouping by top
    const rows = {}; cells.forEach(c => { const b = c.getBoundingClientRect(); const key = Math.round(b.top); (rows[key] = rows[key] || []).push(c.textContent); });
    const clipped = cells.filter(c => { const b = c.getBoundingClientRect(); return b.right > sb.right + 0.5; }).map(c => c.textContent);
    const rowText = Object.values(rows).map(r => r.join(''));
    return { stripW: +sb.width.toFixed(2), rows: rowText, clipped };
  });
  console.log(`DPR ${dpr}: stripW=${r.stripW} rows=${JSON.stringify(r.rows)} clippedPastStrip=${JSON.stringify(r.clipped)}`);
  await ctx.close();
}
await b.close();
