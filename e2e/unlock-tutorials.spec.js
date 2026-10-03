// e2e/unlock-tutorials.spec.js — T (Andy oct2): "a one-time, skippable, big-type, 1–3 step tutorial the first
// time a player reaches each feature … shown once (stored flag), never blocking a game in progress, readable
// with motion off. Check every one on a fresh profile." Each case is a fresh profile (tutorial system already
// initialised at LV1, i.e. a new player progressing) that has just reached the feature.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const until = () => Date.now() + 5 * 60 * 1000;
const CASES = [
  { id: 'marks', title: 'MARKS', seed: { 'taw.xp': { lv: 12, into: 0 }, 'taw.marksRevealed': '1' } },
  { id: 'frenzy', title: 'FRENZY ×5', seed: { 'taw.xp': { lv: 5, into: 0 }, 'taw.frenzyUntil': 'UNTIL' } },
  { id: 'boost', title: 'BOOST', seed: { 'taw.xp': { lv: 5, into: 0 }, 'taw.boost': { until: 'UNTIL', mult: 3 } } },
  { id: 'weekly', title: 'THIS WEEK', seed: { 'taw.xp': { lv: 5, into: 0 }, 'taw.lb.profile': { id: 'p1', username: 'TUTOR' } } },
  { id: 'rebirth', title: 'REBIRTH READY', seed: { 'taw.xp': { lv: 15, into: 0 } } },
  { id: 'chain', title: 'CHAIN UNLOCKED', seed: { 'taw.xp': { lv: 50, into: 0 }, 'taw.tut.rebirth': '1', 'taw.tut.marks': '1' } },
  { id: 'fuse', title: 'FUSE UNLOCKED', seed: { 'taw.xp': { lv: 100, into: 0 }, 'taw.wallTierSeen': '1', 'taw.tut.rebirth': '1', 'taw.tut.marks': '1', 'taw.tut.chain': '1' } },
  { id: 'wall', title: 'NEW WALL', seed: { 'taw.xp': { lv: 100, into: 0 }, 'taw.wallTierSeen': '1', 'taw.tut.rebirth': '1', 'taw.tut.marks': '1', 'taw.tut.chain': '1', 'taw.tut.fuse': '1' } },
];

async function boot(page, seed, vp) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('ut.seeded')) return;
    sessionStorage.setItem('ut.seeded', '1');
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.tut.init', '1'); // a fresh player whose tutorials started at LV1
    const u = String(Date.now() + 5 * 60 * 1000);
    for (const [k, v] of Object.entries(s)) {
      const raw = typeof v === 'string' ? v : JSON.stringify(v);
      localStorage.setItem(k, raw.replace(/"UNTIL"|UNTIL/g, u));
    }
  }, seed);
  await page.goto('/?portal=1');
  await menuReady(page);
}

for (const vp of [{ width: 1280, height: 551 }, { width: 390, height: 844 }]) {
  for (const c of CASES) {
    test(`${vp.width}x${vp.height}: ${c.id} — shown once on reaching it, big type, skippable, never again`, async ({ page }) => {
      test.setTimeout(45000);
      await boot(page, c.seed, vp);
      const card = page.locator('.ut-card');
      await expect(card).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.ut-overlay')).toHaveAttribute('data-tut', c.id);
      await expect(page.locator('.ut-title')).toHaveText(c.title);
      const px = await page.locator('.ut-title').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(px, 'hero-size title').toBeGreaterThanOrEqual(30);
      const linePx = await page.locator('.ut-line').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(linePx, 'big body line').toBeGreaterThanOrEqual(20);
      // step through (NEXT … GOT IT)
      for (let i = 0; i < 3 && (await page.locator('.ut-next').textContent()) === 'NEXT'; i++) await page.locator('.ut-next').click();
      await page.locator('.ut-next').click(); // GOT IT
      // this one is done (the next due one may follow — one at a time, e.g. FUSE then the LV100 wall)
      await expect(page.locator(`.ut-overlay[data-tut="${c.id}"]`)).toHaveCount(0);
      expect(await page.evaluate((id) => localStorage.getItem(`taw.tut.${id}`), c.id)).toBe('1');
      // once: a reload does not show it again
      await page.reload();
      await menuReady(page);
      await page.waitForTimeout(6000);
      await expect(page.locator(`.ut-overlay[data-tut="${c.id}"]`)).toHaveCount(0);
    });
  }
}

test('SKIP closes it for good on the first step', async ({ page }) => {
  await boot(page, CASES[4].seed, { width: 1280, height: 551 });
  await expect(page.locator('.ut-card')).toBeVisible({ timeout: 15000 });
  await page.locator('.ut-skip').click();
  await expect(page.locator('.ut-card')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('taw.tut.rebirth'))).toBe('1');
});

test('an existing LV300 player is not walked through what they already reached — only the new wall', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('ut.seeded')) return;
    sessionStorage.setItem('ut.seeded', '1');
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 300, into: 0 }));
    localStorage.setItem('taw.rebirths', '9');
    localStorage.setItem('taw.marksRevealed', '1');
    localStorage.setItem('taw.wallTierSeen', '3');
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  await expect(page.locator('.ut-overlay')).toHaveAttribute('data-tut', 'wall', { timeout: 15000 });
  await page.locator('.ut-next').click();
  await page.waitForTimeout(2500);
  await expect(page.locator('.ut-card')).toHaveCount(0);
});

test('never on a game screen: a deep-linked solo run shows no tutorial', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.tut.init', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 50, into: 0 }));
  });
  await page.goto('/?portal=1&chain=1');
  await page.locator('.solo-root').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(6000);
  await expect(page.locator('.ut-card')).toHaveCount(0);
});
