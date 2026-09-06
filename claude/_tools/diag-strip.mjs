import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const b = await chromium.launch();
for (const [w, h] of [[1280, 551], [1920, 1080], [390, 844]]) {
  const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch {} });
  await p.goto('/?portal=1&soloms=20000'); await p.getByRole('img', { name: 'Type a Word' }).waitFor(); await p.waitForTimeout(300);
  await p.locator('.game-card-magnet[data-game="fuse"] .game-card').click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
  await p.locator('.solo-root input').first().waitFor(); await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const strip = document.querySelector('.solo-strip-big');
    const sb = strip.getBoundingClientRect();
    const cs = getComputedStyle(strip);
    const cells = [...strip.querySelectorAll('span')];
    const vis = cells.filter((c) => { const b = c.getBoundingClientRect(); const s = getComputedStyle(c); return s.display !== 'none' && b.width >= 1 && b.right <= sb.right + 0.5 && b.left >= sb.left - 0.5; });
    const last = cells[cells.length - 1].getBoundingClientRect();
    // which cells' right edge exceeds strip right
    const clipped = cells.filter((c) => c.getBoundingClientRect().right > sb.right + 0.5).map((c) => c.textContent);
    return {
      cellCount: cells.length,
      visibleCount: vis.length,
      cols: cs.gridTemplateColumns.split(' ').length,
      stripW: Math.round(sb.width), stripL: Math.round(sb.left), stripR: Math.round(sb.right),
      lastCell: `${cells[cells.length - 1].textContent} R${Math.round(last.right)}`,
      firstRowCellW: Math.round(cells[0].getBoundingClientRect().width),
      clippedRight: clipped,
    };
  });
  console.log(`\n=== FUSE ${w}x${h} ===`);
  console.log(JSON.stringify(r, null, 1));
  await p.screenshot({ path: `claude/ingame-pass/shots/diag/fuse-strip-${w}x${h}.png` });
  await ctx.close();
}
await b.close();
