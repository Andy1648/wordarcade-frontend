// e2e/daily-track.spec.js — nov4 (Andy: "horrible progress bar dots for the themes (they dont fit crazy good looks)"): the
// menu's CONTRACTS chip shows today's three contracts as ONE framed track in three cells, the XP bar's construction.
// Plain: the chip's flame orange. A worn painted look: the track wears its rim + well, and done cells show its painted
// strip. At 1366 / 1920: the track sits inside the chip clear of the flame and the label, cells big enough to read.
// TRACK_SHOTS=<folder> saves the chip (plain + inferno) and the whole menu.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SHOTS = process.env.TRACK_SHOTS;

async function boot(page, w, h, { look = null, done = 1 } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.addInitScript(({ look, done }) => {
    if (sessionStorage.getItem('dt.seeded')) return;
    sessionStorage.setItem('dt.seeded', '1');
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const picks = ['any-double', 'sat-first', 'ch-run20'];
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.reveal', 'all');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0.55, rc: 0, v: 10 }));
    localStorage.setItem('taw.contracts', JSON.stringify({ v: 1, day, picks, prog: {}, seen: {}, done: picks.slice(0, done), rerolled: false, sweep: false, kept: done > 0 }));
    if (look) {
      localStorage.setItem('taw.owned', JSON.stringify(['classic', look]));
      localStorage.setItem('taw.equipped', JSON.stringify({ popStyle: look, soundPack: 'thock' }));
    }
  }, { look, done });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
}

const inside = (a, b) => a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1;
const overlap = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;

for (const [w, h] of [[1366, 768], [1920, 1080]]) {
  test(`@${w}: plain — one framed track, the done cell in flame orange, inside the chip`, async ({ page }) => {
    await boot(page, w, h, { done: 1 });
    const chip = page.locator('.hp-daily').filter({ visible: true }).first();
    const track = chip.getByTestId('daily-track');
    await expect(track).toBeVisible();
    await expect(track.locator('i')).toHaveCount(3);
    await expect(track.locator('i.is-done')).toHaveCount(1);
    expect(await track.locator('i.is-done').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(255, 107, 61)');
    const [c, t, f, k] = await Promise.all([chip.boundingBox(), track.boundingBox(), chip.locator('.hp-daily-flame').boundingBox(), chip.locator('.hp-daily-k').boundingBox()]);
    expect(inside(t, c), 'track inside the chip').toBe(true);
    expect(overlap(t, f), 'track over the flame').toBe(false);
    expect(overlap(t, k), 'track over the label').toBe(false);
    expect(t.height).toBeGreaterThanOrEqual(14);
    const cells = await track.locator('i').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
    expect(Math.min(...cells), 'cells wide enough to read').toBeGreaterThanOrEqual(18);
    if (SHOTS) { await page.screenshot({ path: `${SHOTS}/after-menu-plain-${w}.png` }); await chip.screenshot({ path: `${SHOTS}/after-chip-plain-${w}.png` }); }
  });

  test(`@${w}: a worn painted look dresses the track — its rim, its well, its painted strip in the done cells`, async ({ page }) => {
    await boot(page, w, h, { look: 'inferno', done: 2 });
    const track = page.locator('.hp-daily').filter({ visible: true }).first().getByTestId('daily-track');
    await expect(track).toHaveAttribute('data-kit', 'inferno', { timeout: 10_000 });
    const done = await track.locator('i.is-done').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundImage));
    expect(done).toHaveLength(2);
    for (const bg of done) expect(bg).toContain('/shop/pop/bar-inferno.webp');
    expect(await track.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe('rgb(184, 50, 10)'); // inferno's edge
    if (SHOTS) {
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${SHOTS}/after-menu-inferno-${w}.png` });
      await page.locator('.hp-daily').filter({ visible: true }).first().screenshot({ path: `${SHOTS}/after-chip-inferno-${w}.png` });
    }
  });
}
