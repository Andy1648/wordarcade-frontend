// e2e/wheel-week.spec.js — THE WEEK ROW (nov3 design-research move 18): the daily wheel shows the 7 days of this streak
// week — spun days stamped, today lit, DAY 7 the painted SUPER SPIN (×2) always in view — from the server's streak (067)
// alone. At 1366 / 1920 / 390 / 360x640 and on DAY 1 / 3 / 7 / 9: seven cells, today the right one, nothing overlapping
// the wordmark / ODDS / ✕, everything inside the panel, the numbers ≥ 16px; after the spin today turns DONE.
// SHOTS=<dir> saves a screenshot per size + day.
import { test, expect } from '@playwright/test';
import { boot, openWheel } from './support/wheelBoot.js';

const SHOTS = process.env.SHOTS;

const measure = (page) => page.evaluate(() => {
  const b = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const hit = (a, c) => Math.min(a.r, c.r) - Math.max(a.l, c.l) > 1 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 1;
  const week = document.querySelector('[data-testid="wheel-week"]');
  const panel = b(document.querySelector('.dw'));
  const W = b(week);
  const out = [];
  for (const s of ['.dw-title', '.dw-odds-btn', '.dw-close']) { const el = document.querySelector(s); if (el && hit(W, b(el))) out.push(`week on ${s}`); }
  if (W.l < panel.l - 1 || W.r > panel.r + 1 || W.t < panel.t - 1) out.push('week leaves the panel');
  const cells = [...week.children].map(b);
  for (let i = 1; i < cells.length; i += 1) if (hit(cells[i - 1], cells[i])) out.push(`cells ${i} and ${i + 1} overlap`);
  const small = [...week.querySelectorAll('.dw-pip, .dw-day7-x')].filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).length;
  if (small) out.push(`${small} labels under 16px`);
  return { out, days: [...week.children].map((el) => [Number(el.dataset.day), el.dataset.state]) };
});

for (const [w, h] of [[1366, 768], [1920, 1080], [390, 844], [360, 640]]) {
  for (const [streak, week, todayAt] of [[0, 1, 0], [2, 1, 2], [6, 1, 6], [8, 8, 1]]) {
    test(`${w}x${h} · DAY ${streak + 1}: seven days, today lit, DAY 7 SUPER in view, nothing overlaps`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await boot(page, { gems: 200, slot: 2, streak });
      await openWheel(page);
      const wheel = page.getByTestId('daily-wheel');
      await expect(wheel.getByTestId('wheel-spin')).toBeVisible();
      await page.waitForTimeout(400);
      const m = await measure(page);
      expect(m.out, m.out.join('\n')).toEqual([]);
      expect(m.days.map((d) => d[0])).toEqual([0, 1, 2, 3, 4, 5, 6].map((i) => week + i));
      expect(m.days[todayAt][1]).toBe('today');
      expect(m.days.slice(0, todayAt).every((d) => d[1] === 'done')).toBe(true);
      expect(m.days.slice(todayAt + 1).every((d) => d[1] === 'next')).toBe(true);
      await expect(wheel.locator('.dw-day7 img')).toBeVisible();
      if (SHOTS) { await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth), null, { timeout: 6000 }).catch(() => {}); await page.screenshot({ path: `${SHOTS}/week-${w}x${h}-day${streak + 1}.png` }); }
    });
  }
}

test('after the spin, today is stamped DONE', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page, { gems: 200, slot: 2, streak: 2 });
  await openWheel(page);
  const wheel = page.getByTestId('daily-wheel');
  await wheel.getByTestId('wheel-spin').click();
  await expect(wheel.getByTestId('wheel-result')).toBeVisible({ timeout: 12000 });
  await expect(wheel.locator('[data-day="3"]')).toHaveAttribute('data-state', 'done');
  await expect(wheel.locator('[data-state="today"]')).toHaveCount(0);
});
