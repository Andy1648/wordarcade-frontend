// e2e/v2-levelup.spec.js — P9a KitLevelUp (claude/mockups/v2/KitLevelUp.dc.html; claude/SEASON2-QUEUE.md 9a):
// "XP-bar wrap + '+N LV' chip, top-edge rank-up banner (v3 rank names), 16 rank plates next to names on the board,
// edge unlock toasts. Nothing in the middle of the screen. No wins for rank-ups."
//
//   * the 16 SHAPED plates (gallery sheet) are the v3 ladder in order; only the ★ tiers shimmer, and only once;
//   * SEASON2 menu: the rank-up banner hangs from the TOP edge with the shaped old → new plates, fits a phone, pays
//     no wins / gems; slot unlocks toast on the RIGHT edge with their "2" badge;
//   * the menu XP bar (live): a multi-level gain wraps ≤ 3 times, the "+N LV" chip slides out UNDER the bar's left
//     end, and the bar lands on the real level + fraction;
//   * REDUCE MOTION: the banner still shows (no animation), nothing runs.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const V3_LADDER = ['KEYMASH', 'TYPO', 'CLACKER', 'HOTKEY', 'INKSTORM', 'WORDSMITH', 'KEYFIEND', 'CAPSLOCK', 'OVERCLOCK', 'GLYPHLORD', 'LEXIBEAST', 'VOIDTYPER', 'ASCENDANT', 'OMNIKEY', 'FINAL BOSS', 'ENDGAME'];

async function menu(page, { season2 = true, seed = {}, reduce = false } = {}) {
  await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await installBackendMock(page);
  await page.addInitScript(({ seed, reduce }) => {
    if (sessionStorage.getItem('lu.seeded')) return;
    sessionStorage.setItem('lu.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.reduceMotion', reduce ? '1' : '0');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, { seed, reduce });
  await page.goto(`/?portal=1${season2 ? '&season2=1' : ''}`);
  await menuReady(page);
}

test('the 16 shaped rank plates are the v3 ladder, in order; ★ tiers glow + shimmer once (no loop)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/?kit=1&sheet=levelup');
  const plates = page.getByTestId('lu-plates').locator('.krp');
  await expect(plates).toHaveCount(16);
  expect(await plates.locator('.krp-name').allTextContents()).toEqual(V3_LADDER);
  // every plate is SVG art (shape + outline paths), never a CSS box
  for (let i = 0; i < 16; i += 1) expect(await plates.nth(i).locator('svg path').count()).toBeGreaterThanOrEqual(4);
  await expect(page.getByTestId('lu-plates').locator('.krp.is-star')).toHaveCount(5);
  // names stay ≥ 13 px
  const sizes = await plates.locator('.krp-name').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(13);
  await page.waitForTimeout(1500);
  const infinite = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest('.kg-sheet--lu')).length);
  expect(infinite, 'no looping animation on the LEVEL + RANK UP sheet').toBe(0);
});

// R6 since the last look (the menu last SAW KEYMASH and no unlocks): KEYMASH → KEYFIEND + the R1…R5 unlocks owed.
const RANK_SEED = {
  'taw.s2.xp': JSON.stringify({ lv: 5, f: 0.2, rc: 6, v: 10 }),
  'taw.s2.rebirths': '6',
  'taw.s2.rankShown': '0',
  'taw.s2.unlocksShown': '["rollScreen","autoRoll"]',
};

for (const vp of [{ width: 1280, height: 551 }, { width: 390, height: 844 }]) {
  test(`SEASON2 @${vp.width}x${vp.height}: rank-up = shaped plates on the TOP edge, slot unlocks = right-edge toasts with a 2 badge, no pay`, async ({ page }) => {
    await page.setViewportSize(vp);
    await menu(page, { seed: RANK_SEED });
    const banner = page.locator('.krb');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toHaveAttribute('data-rank', 'KEYFIEND');
    await expect(banner.locator('.krb-code')).toHaveText('R6');
    const oldP = banner.locator('.krb-plate.is-old');
    const newP = banner.locator('.krb-plate.is-new');
    await expect(oldP).toHaveAttribute('data-rank-plate', 'R0');
    await expect(newP).toHaveAttribute('data-rank-plate', 'R6');
    await expect(newP).toHaveText('KEYFIEND');
    expect(await newP.locator('svg path').count(), 'the new plate is the shaped SVG (horns)').toBeGreaterThanOrEqual(4);
    await page.waitForTimeout(700); // past the 0.5 s drop
    const bb = await banner.boundingBox();
    expect(bb.y, 'hangs from the top edge').toBeLessThanOrEqual(2);
    expect(bb.y + bb.height, 'stays in the top band — nothing mid-screen').toBeLessThan(vp.height * 0.25);
    for (const p of [oldP, newP]) {
      const b = await p.boundingBox();
      expect(b.x, 'plate inside the viewport').toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, 'plate inside the viewport').toBeLessThanOrEqual(vp.width);
    }
    // the slot unlocks (R3 BOOST, R5 MARK) toast from the RIGHT edge with their "2"
    const slot = page.locator('.ket-card[data-toast="R5"]');
    await expect(slot).toBeVisible();
    await expect(slot.locator('.ket-badge')).toHaveText('2');
    const tb = await slot.boundingBox();
    expect(Math.round(tb.x + tb.width), 'on the right edge').toBeGreaterThanOrEqual(vp.width - 2);
    // rank-ups pay nothing
    expect(await page.evaluate(() => localStorage.getItem('taw.s2.wins'))).toBeNull();
    expect(await page.evaluate(() => (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0)).toBe(0);
  });
}

test('SEASON2 + REDUCE MOTION: the rank banner still shows, nothing animates', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await menu(page, { seed: RANK_SEED, reduce: true });
  const banner = page.locator('.krb');
  await expect(banner).toBeVisible({ timeout: 5000 });
  await expect(banner.locator('.krb-plate.is-new')).toHaveText('KEYFIEND');
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.krb-host, .ket-host')).length);
  expect(running).toBe(0);
});

test('menu XP bar (live): a multi-level gain wraps ≤ 3 times, "+N LV" chip slides out under the bar, lands on the real level', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  // LV1 on 6 rebirths (live econ): one keystroke crosses tens of levels (e2e/bar-multilevel.spec.js's seed)
  const save = JSON.stringify({ lv: 1, f: 0, rc: 6, v: 10 });
  await menu(page, { season2: false, seed: { 'taw.xp': save, 'taw.xpv10': save, 'taw.rebirths': '6' } });
  await page.locator('.menu-xp-bar.kx').waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const num = () => document.querySelector('.menu-xp-bar .kx-lv-n');
    const chip = document.querySelector('.menu-xp-bar .kx-gain');
    const bar = document.querySelector('.menu-xp-bar .kx-bar');
    const lv = () => Number(String(num().textContent).replace(/[^0-9]/g, ''));
    const before = window.__tawXp().level;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    const real = window.__tawXp();
    const seen = [lv()];
    let chipText = '';
    let chipBelow = null;
    const t0 = performance.now();
    while (performance.now() - t0 < 2000) {
      await new Promise((res) => requestAnimationFrame(res));
      if (seen[seen.length - 1] !== lv()) seen.push(lv());
      if (chip.classList.contains('is-on') && !chipText) {
        chipText = chip.textContent;
        await new Promise((res) => setTimeout(res, 320)); // past the 0.28 s slide
        const cb = chip.getBoundingClientRect();
        const bb = bar.getBoundingClientRect();
        chipBelow = { top: cb.top, barBottom: bb.bottom, left: cb.left, barLeft: bb.left };
      }
    }
    return { before, real: real.level, seen, chipText, chipBelow, end: lv(), state: document.querySelector('.menu-xp-bar').dataset.state };
  });
  expect(r.real - r.before, 'a multi-level gain').toBeGreaterThanOrEqual(5);
  expect(r.seen.length - 1, `wraps: ${r.seen.join(' → ')}`).toBeLessThanOrEqual(3);
  for (let i = 1; i < r.seen.length; i += 1) expect(r.seen[i]).toBeGreaterThan(r.seen[i - 1]);
  expect(r.chipText).toMatch(/^\+[\d.,]+[KMB]? LV$/);
  expect(r.chipBelow.top, 'the chip hangs under the bar').toBeGreaterThanOrEqual(r.chipBelow.barBottom - 8);
  expect(r.chipBelow.left, 'at its left end').toBeLessThan(r.chipBelow.barLeft + 80);
  expect(r.end).toBe(r.real);
  expect(r.state).toBe('rest');
});
