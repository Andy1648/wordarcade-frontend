import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const b = await chromium.launch();
for (const [w, h] of [[1280, 551], [1920, 1080]]) {
  const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch {} });
  await p.goto('/?portal=1&soloms=20000'); await p.getByRole('img', { name: 'Type a Word' }).waitFor(); await p.waitForTimeout(300);
  await p.locator('.game-card-magnet[data-game="chain"] .game-card').click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
  await p.locator('.solo-root input').first().waitFor(); await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const inp = document.querySelector('.solo-input');
    const cs = getComputedStyle(inp);
    return { ph: inp.placeholder, fontSize: cs.fontSize, clientW: inp.clientWidth, scrollW: inp.scrollWidth, clipped: inp.scrollWidth > inp.clientWidth + 1 };
  });
  console.log(`\n=== ${w}x${h} ===  font ${r.fontSize}  clientW ${r.clientW}  scrollW ${r.scrollW}  CLIPPED=${r.clipped}\n  placeholder: "${r.ph}"`);
  await p.screenshot({ path: `claude/ingame-pass/shots/diag/chain-empty-${w}x${h}.png` });
  await ctx.close();
}
await b.close();
