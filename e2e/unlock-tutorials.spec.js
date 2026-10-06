// e2e/unlock-tutorials.spec.js — SPOTLIGHT TUTORIALS (Andy oct5): "screen dims, the one target glows, tap
// anywhere to continue. No OK-button popups. Keep only the few that matter (roll, gems, rebirth, KEY TIER); cut
// minor ones like the wall moving." Written WITHOUT being run (authoring-machine rules); Andy / CI runs it.
// Menu: REBIRTH, GEMS (the gem count, once MARKS is there). SHOP: KEY TIER. MARKS: the ROLL one (mark-rolls.spec).
// Every other spec gets the GEMS / KEY TIER flags pre-set by installBackendMock (opts.newTutorials turns that off).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const REBIRTH = { 'taw.xp': { lv: 25, into: 0 } }; // the gate: LV 25 × (R+1)

async function boot(page, seed, vp, mockOpts = {}) {
  await page.setViewportSize(vp);
  await installBackendMock(page, mockOpts);
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('ut.seeded')) return;
    sessionStorage.setItem('ut.seeded', '1');
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.tut.init', '1'); // a fresh player whose tutorials started at LV1
    localStorage.setItem('taw.econ', '12'); // already on Rebirth Rush (this spec is not about the one-time conversion)
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
  test(`${vp.width}x${vp.height}: rebirth — a spotlight on REBIRTH, no buttons, tap anywhere, never again`, async ({ page }) => {
    test.setTimeout(45000);
    await boot(page, REBIRTH, vp);
    const tut = page.locator('.ut-overlay[data-tut="rebirth"]');
    await expect(tut).toBeVisible({ timeout: 15000 });
    await expect(tut).toHaveAttribute('role', 'dialog');
    await expect(tut).toBeFocused();
    // the target glows: a ring over the visible REBIRTH button
    const ring = await page.locator('.ut-ring').boundingBox();
    const btn = await page.locator('.hp-nav.is-rebirth:visible').first().boundingBox();
    expect(ring && btn, 'ring + target').toBeTruthy();
    expect(Math.abs((ring.x + ring.width / 2) - (btn.x + btn.width / 2))).toBeLessThan(4);
    expect(Math.abs((ring.y + ring.height / 2) - (btn.y + btn.height / 2))).toBeLessThan(4);
    await expect(page.locator('.ut-line')).toContainText('REBIRTH READY');
    // NO OK-button popups
    await expect(tut.locator('button')).toHaveCount(0);
    // tap ANYWHERE (a corner, nowhere near the target) and it is done — the tap does not open REBIRTH
    await page.mouse.click(8, vp.height - 8);
    await expect(tut).toHaveCount(0);
    await expect(page.locator('.shop-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('taw.tut.rebirth'))).toBe('1');
    // once: a reload does not show it again
    await page.reload();
    await menuReady(page);
    await page.waitForTimeout(6000);
    await expect(page.locator('.ut-overlay')).toHaveCount(0);
  });
}

test('Escape (and Enter) close it too', async ({ page }) => {
  await boot(page, REBIRTH, { width: 1280, height: 551 });
  await expect(page.locator('.ut-overlay')).toBeVisible({ timeout: 15000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('.ut-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('taw.tut.rebirth'))).toBe('1');
});

test('the CUT tutorials never show: wall, chain / fuse unlock, marks, frenzy, boost, weekly', async ({ page }) => {
  test.setTimeout(45000);
  await boot(page, {
    'taw.xp': { lv: 100, into: 0 },
    'taw.wallTierSeen': '1',
    'taw.marksRevealed': '1',
    'taw.frenzyUntil': 'UNTIL',
    'taw.boost': { until: 'UNTIL', mult: 3 },
    'taw.lb.profile': { id: 'p1', username: 'TUTOR' },
    'taw.tut.rebirth': '1',
  }, { width: 1280, height: 551 });
  await page.waitForTimeout(8000);
  await expect(page.locator('.ut-overlay')).toHaveCount(0);
});

test('KEY TIER: the first affordable KEY tier lights the KEY item in the SHOP, once', async ({ page }) => {
  test.setTimeout(45000);
  await boot(page, { 'taw.wins': '100000', 'taw.tut.rebirth': '1' }, { width: 1280, height: 720 }, { newTutorials: true });
  await page.locator('.homepage-nav-btn.is-shop').click();
  await page.locator('.shop-overlay').waitFor();
  const tut = page.locator('.ut-overlay[data-tut="keyTier"]');
  await expect(tut).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.ut-line')).toContainText('POWER');
  await expect(tut.locator('button')).toHaveCount(0);
  // Escape closes the spotlight only — the SHOP stays open under it
  await page.keyboard.press('Escape');
  await expect(tut).toHaveCount(0);
  await expect(page.locator('.shop-overlay')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('taw.tut.keyTier'))).toBe('1');
});

test('GEMS: once MARKS is there, the gem count is lit once — tap anywhere, never again', async ({ page }) => {
  test.setTimeout(45000);
  await boot(page, { 'taw.xp': { lv: 12, into: 0 }, 'taw.marksRevealed': '1', 'taw.tut.rebirth': '1' }, { width: 1280, height: 720 }, { newTutorials: true });
  const tut = page.locator('.ut-overlay[data-tut="gems"]');
  await expect(tut).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.ut-line')).toContainText('GEMS');
  await expect(tut.locator('button')).toHaveCount(0);
  // the ring sits on the visible gem count
  const ring = await page.locator('.ut-ring').boundingBox();
  const chip = await page.locator('.menu-gems-chip:visible').first().boundingBox();
  expect(ring && chip, 'ring + gem count').toBeTruthy();
  expect(Math.abs((ring.x + ring.width / 2) - (chip.x + chip.width / 2))).toBeLessThan(4);
  await page.mouse.click(8, 720 - 8);
  await expect(tut).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('taw.tut.gems'))).toBe('1');
  await page.reload();
  await menuReady(page);
  await page.waitForTimeout(4000);
  await expect(page.locator('.ut-overlay')).toHaveCount(0);
});

test('an existing LV300 player is not walked through anything', async ({ page }) => {
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
  await page.waitForTimeout(8000);
  await expect(page.locator('.ut-overlay')).toHaveCount(0);
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
  await expect(page.locator('.ut-overlay')).toHaveCount(0);
});
