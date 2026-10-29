// e2e/titles-fit.spec.js — the TITLES surfaces stay clean (oct28 UI checklist: zero overlaps, nothing tiny, the main
// element dominates its panel) at 1366, 1920 and 390. The picker opens from the profile's title plate.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const VPS = [[1366, 657], [1920, 1080], [390, 844]];

async function seed(page) {
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('tf.seeded')) return;
    sessionStorage.setItem('tf.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 60, f: 0.1, rc: 6, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', '6');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'BETTERTHANANDY' }));
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  });
}

// rects of the matched nodes, and every pair of them that overlaps by more than 1px
const overlaps = (page, sel) => page.evaluate((s) => {
  const r = [...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect());
  const bad = [];
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i]; const b = r[j];
    if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) bad.push([i, j]);
  }
  return bad;
}, sel);

for (const [w, h] of VPS) {
  test(`TITLES @${w}x${h}: no overlaps, nothing tiny, the stage plate dominates`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await seed(page);
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    await page.getByTestId('profile-plate').click();
    const pf = page.getByTestId('profile-popup');
    await expect(pf).toBeVisible();
    await page.waitForTimeout(500);
    // profile: your name and your title plate never overlap; the plate is a real 44px+ target
    const [name, plate] = await Promise.all([pf.locator('.pf-name').boundingBox(), pf.getByTestId('profile-title').boundingBox()]);
    const sideBySide = name.x + name.width <= plate.x + 1;
    const stacked = name.y + name.height <= plate.y + 1;
    expect(sideBySide || stacked, 'name and title plate overlap').toBe(true);
    expect(plate.height).toBeGreaterThanOrEqual(w <= 480 ? 44 : 22); // a finger target on the phone; on a laptop it stays within the name line (the slim NEON board is ~25px)

    await pf.getByTestId('profile-title').click();
    const rl = page.getByTestId('rank-ladder');
    await expect(rl).toBeVisible();
    await page.waitForTimeout(800); // the rise / slam one-shots settle
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll').toBe(true);
    expect(await overlaps(page, '.rl-item'), 'title tiles overlap').toEqual([]);
    expect(await overlaps(page, '.rl-stage > *'), 'stage blocks overlap').toEqual([]);
    // each tile: the painted plate fills most of it, and its name stays inside the tile
    const tiles = await rl.locator('.rl-item').evaluateAll((els) => els.map((el) => {
      const t = el.getBoundingClientRect();
      const p = el.querySelector('.krp').getBoundingClientRect();
      const n = el.querySelector('.krp-name').getBoundingClientRect();
      return { fill: p.width / t.width, inside: n.left >= t.left - 1 && n.right <= t.right + 1, fs: parseFloat(getComputedStyle(el.querySelector('.krp-name')).fontSize) };
    }));
    expect(tiles).toHaveLength(16);
    for (const [i, t] of tiles.entries()) {
      expect(t.fill, `tile ${i} plate too small`).toBeGreaterThanOrEqual(0.6);
      expect(t.inside, `tile ${i} name spills`).toBe(true);
      expect(t.fs, `tile ${i} name too small`).toBeGreaterThanOrEqual(13);
    }
    // the STAGE plate dominates its panel
    const stage = await rl.locator('.rl-show').boundingBox();
    const big = await rl.locator('.rl-show .krp').boundingBox();
    expect(big.width / stage.width, 'stage plate dominates').toBeGreaterThanOrEqual(0.6);
    expect(big.height).toBeGreaterThanOrEqual(60);
    // desktop: the whole picker fits the window (no scroll)
    if (w > 820) {
      const panel = await rl.locator('.rl-panel').boundingBox();
      expect(panel.y + panel.height).toBeLessThanOrEqual(h + 1);
      expect(await rl.locator('.rl-shelf').evaluate((e) => e.scrollHeight <= e.clientHeight + 1), 'shelf fits without scrolling').toBe(true);
    }
  });
}
