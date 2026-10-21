// e2e/boost-dock-fit.spec.js — the menu's boost timers never sit on anything (Andy oct19: "the boosters are overlapping
// on right side of screen … i hate when u unconsciously overlap"). Six boosts running at once (the most the shop + gear can
// stack) at the Chromebook sizes: no tile touches the profile chip, the corner icons or a game card, and none leave the
// screen.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

for (const [w, h] of [[1366, 768], [1280, 800], [1280, 720], [1536, 864]]) {
  test(`six boost timers overlap nothing at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.addInitScript(() => {
      const T = Date.now();
      try {
        localStorage.setItem('taw.boost', JSON.stringify({ mult: 10, until: T + 280000 }));
        localStorage.setItem('taw.s2.boost2', JSON.stringify({ mult: 3, until: T + 200000 }));
        localStorage.setItem('taw.frenzyUntil', String(T + 150000));
        localStorage.setItem('taw.s2.stockfx', JSON.stringify({ xp: T + 300000, wins: T + 240000, luck: T + 180000 }));
      } catch { /* storage blocked */ }
    });
    await installBackendMock(page);
    await page.addInitScript(() => { try { localStorage.removeItem('taw.season2.off'); } catch { /* storage blocked */ } });
    await gotoMenu(page);
    // the dock renders in two layout slots (one hidden per layout), so count the VISIBLE tiles
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.bd-tile')].filter((t) => t.getBoundingClientRect().width > 0).length), { timeout: 10000 }).toBe(6);
    const hits = await page.evaluate(() => {
      const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const tiles = [...document.querySelectorAll('.bd-tile')].filter(visible);
      const others = [...document.querySelectorAll('.hp-main, .hp-icons button, .hp-icons a, [class*="game-card"]')]
        .filter((e) => visible(e) && !e.closest('.hp-dock'));
      const meet = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
      const out = [];
      for (const t of tiles) {
        const r = t.getBoundingClientRect();
        if (r.bottom > innerHeight || r.right > innerWidth) out.push(`${t.className} off screen`);
        for (const o of others) if (meet(r, o.getBoundingClientRect())) out.push(`${t.className} x ${o.className}`);
      }
      return out;
    });
    expect(hits).toEqual([]);
  });
}
