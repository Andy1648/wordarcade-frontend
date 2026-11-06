// e2e/stats-boosts-empty.spec.js — STATS → BOOSTS with nothing running: one empty line (the where-from guide went in #685, "no
// filler"), on screen, nothing over the all-time strip beneath it.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

const OUT = process.env.STATS_SHOTS || '';
const SEED = { 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1', 'taw.rollsOn': '1', 'taw.marksRevealed': '1', 'taw.reveal': 'all', 'taw.s2.welcome': JSON.stringify({ st: 'done' }), 'taw.s2.xp': JSON.stringify({ lv: 60, f: 0, rc: 6, v: 10 }), 'taw.s2.rebirths': '6' };

for (const [w, h] of [[1920, 1080], [1366, 768], [1280, 551], [390, 844]]) {
  test(`${w}x${h}: no boosts running`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.addInitScript((s) => { localStorage.removeItem('taw.season2.off'); if (sessionStorage.getItem('sb')) return; sessionStorage.setItem('sb', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    await navControl(page, 'stats').first().click();
    await page.locator('.st2-tab:visible').nth(2).click();
    const root = page.getByTestId('st2-boosts');
    await expect(root).toHaveClass(/is-empty/);
    await expect(root.locator('.st2-bl-none')).toHaveText('NO BOOSTS RUNNING');
    await page.waitForTimeout(400);
    if (OUT) await page.screenshot({ path: `${OUT}/boosts-${w}.png` });
    await expect(root.locator('.st2-where')).toHaveCount(0);
    const g = await page.evaluate(() => {
      const r = document.querySelector('.st2-bl-none').getBoundingClientRect();
      const strip = document.querySelector('.st2-life, [class*="st2-life"]');
      const s = strip ? strip.getBoundingClientRect() : null;
      return { left: r.left, right: r.right, bottom: r.bottom, stripTop: s ? s.top : null };
    });
    expect(g.left).toBeGreaterThanOrEqual(0);
    expect(g.right).toBeLessThanOrEqual(w);
    if (w > 480 && g.stripTop != null) expect(g.bottom).toBeLessThanOrEqual(g.stripTop + 1);
  });
}
