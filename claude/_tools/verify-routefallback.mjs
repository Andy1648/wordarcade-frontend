// Prove the delayed RouteFallback: throttle the lazy CHAIN chunk so its fetch outlasts the
// 450ms delay, then confirm "LOADING…" appears (old code would show a blank). Also confirm the
// loader is gone once the chunk resolves.
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const b = await chromium.launch();
const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 390, height: 844 } });
const p = await ctx.newPage(); await installBackendMock(p);
await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch {} });
// Delay any solo/game route chunk by 2s to simulate a cold/slow fetch.
await p.route('**/assets/**.js', async (route) => {
  const u = route.request().url();
  if (/Chain|Fuse|Game|Solo/i.test(u)) { await new Promise(r => setTimeout(r, 2000)); }
  await route.continue();
});
await p.goto('/?portal=1&soloms=20000'); await p.getByRole('img', { name: 'Type a Word' }).waitFor(); await p.waitForTimeout(400);
await p.locator('.game-card-magnet[data-game="chain"] .game-card').click({ force: true });
await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
// Within the 2s throttle window, past the 450ms delay, the loader should be visible.
await p.waitForTimeout(900);
const loaderVisible = await p.locator('.route-fallback').isVisible().catch(() => false);
const loaderText = await p.locator('.route-fallback-label').textContent().catch(() => null);
await p.screenshot({ path: 'claude/loading-states/routefallback-during.png' });
// After the chunk resolves, the loader should be gone and the game mounted.
await p.locator('.solo-root').waitFor({ timeout: 8000 });
const loaderGone = !(await p.locator('.route-fallback').isVisible().catch(() => true));
console.log(`loaderVisible=${loaderVisible} text="${loaderText}" loaderGoneAfterMount=${loaderGone}`);
await b.close();
