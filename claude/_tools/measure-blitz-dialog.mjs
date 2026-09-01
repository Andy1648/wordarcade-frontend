import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
async function run(w, h, tag) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.goto('/?portal=1'); await p.getByRole('img', { name: 'Type a Word' }).waitFor();
  await p.locator('.game-card-magnet[data-game="category-blitz"] .game-card').click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor(); await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; };
    return { chip: r('.mode-dialog-chip'), badge: r('.mode-dialog-ai-badge'), title: r('.mode-dialog-title') };
  });
  const gap = m.chip && m.badge ? m.badge.top - m.chip.bottom : null;
  console.log(`[${tag} ${w}x${h}] chip.bottom=${m.chip?.bottom} badge.top=${m.badge?.top} GAP=${gap}px  (negative = OVERLAP)  chip=${JSON.stringify(m.chip)} badge=${JSON.stringify(m.badge)}`);
  await p.locator('.mode-dialog-shell').screenshot({ path: `claude/stranger-2/shots/blitz-dialog-zoom-${tag}.png` });
  await b.close();
}
await run(390, 844, 'tall');
await run(360, 640, 'short');
