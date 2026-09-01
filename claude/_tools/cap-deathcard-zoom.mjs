import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
async function shot(id) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch {} });
  await p.goto('/?portal=1&soloms=350'); await p.getByRole('img', { name: 'Type a Word' }).waitFor(); await p.waitForTimeout(400);
  await p.locator(`.game-card-magnet[data-game="${id}"] .game-card`).click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor();
  await p.locator('.mode-dialog-btn-create').click();
  await p.locator('.solo-root').waitFor();
  const input = p.locator('.solo-root input').first(); await input.waitFor(); await input.fill('a');
  await p.locator('.solo-deathcard').waitFor({ timeout: 8000 }); await p.waitForTimeout(400);
  const fonts = await p.evaluate(() => { const h = document.querySelector('.solo-deathcard h2'); return { text: h?.textContent, font: getComputedStyle(h).fontFamily, loaded: document.fonts.check("28px Bungee") }; });
  console.log(id, JSON.stringify(fonts));
  await p.locator('.solo-deathcard').screenshot({ path: `claude/full-sweep/shots/${id}-deathcard-zoom.png` });
  await b.close();
}
await shot('chain');
await shot('fuse');
