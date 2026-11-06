// e2e/honest-dots.spec.js — HONEST DOTS (nov3 design-research move 16, "red dots mean worth a visit, never something
// changed"): a menu dot shows only when the visit PAYS — a roll you can take, a gear to equip, a free chest, a reward to
// claim. Gone: the empty-gear-slot dot with nothing to equip and no roll in reach, the DAILY contracts "none done yet"
// dot (contracts pay on their own), and the leaderboard's "your rank went up" dot (news — the button's label says it).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ROLLS = (marks = {}) => JSON.stringify({ v: 4, rolls: 3, sinceEpic: 3, sinceLegendary: 3, everEpic: false, starter: true, marks, milestones: [], skipBelow: 'rare' });

async function boot(page, seed, w = 1366, h = 768) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('hd.seeded')) return;
    sessionStorage.setItem('hd.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.tut.markRolls', '1');
    localStorage.setItem('taw.marksRevealed', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 12, f: 0.2, rc: 0, v: 10 }));
    localStorage.setItem('taw.xpv10', JSON.stringify({ lv: 12, f: 0.2, rc: 0, v: 10 }));
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, seed);
  await page.goto('/?portal=1');
  await menuReady(page);
}
const gems = (bal) => JSON.stringify({ v: 1, bal, peak: bal, streak: 0, mig: 1 });

for (const [w, h] of [[1366, 768], [390, 844]]) {
  test(`${w}x${h}: nothing to equip and no roll in reach — the empty gear slot and GEARS wear no dot`, async ({ page }) => {
    await boot(page, { 'taw.gems': gems(0), 'taw.markRolls': ROLLS() }, w, h);
    await expect(page.locator('.menu-mark .menu-mark-name:visible').first()).toBeVisible();
    await expect(page.locator('.hp-chip-dot')).toHaveCount(0);
    await expect(page.locator('.is-gears .kb-rdot')).toHaveCount(0);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/dots-none-${w}x${h}.png` });
  });

  test(`${w}x${h}: a roll you can afford — the empty slot and GEARS both say so`, async ({ page }) => {
    await boot(page, { 'taw.gems': gems(500), 'taw.markRolls': ROLLS() }, w, h);
    await expect(page.locator('.hp-chip-dot:visible').first()).toBeVisible();
    await expect(page.locator('.is-gears .kb-rdot:visible').first()).toBeVisible();
  });

  test(`${w}x${h}: an owned gear nobody wears — the empty slot dots (equipping it pays), with no gems`, async ({ page }) => {
    await boot(page, { 'taw.gems': gems(0), 'taw.markRolls': ROLLS({ 'mk-singularity': { n: 1 } }) }, w, h);
    await expect(page.locator('.hp-chip-dot:visible').first()).toBeVisible();
  });
}

for (const [w, h] of [[1366, 768], [390, 844]]) {
  test(`${w}x${h}: DAILY contracts at 0 done wear no dot — they pay on their own when you play`, async ({ page }) => {
    await boot(page, { 'taw.gems': gems(0), 'taw.markRolls': ROLLS() }, w, h);
    const tile = page.locator('[data-nav="contracts"]:visible').first();
    await expect(tile).toHaveAttribute('aria-label', /— 0 of \d+ done/);
    await expect(tile.locator('.kb-idot, .kb-rdot')).toHaveCount(0);
  });
}
