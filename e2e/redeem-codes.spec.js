// redeem-codes.spec.js — STEP 61. The shop's CODES entry against a mocked lb_redeem
// (supabase/migrations/007_redeem_codes.sql): a good code lands in REWARDS (it does not pay on its
// own), claiming pays exactly its wins, a second try says already-redeemed, a wrong code says so,
// and a DB without 007 says codes are not switched on — never a crash.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

async function boot(page, { live = true, level = 20 } = {}) {
  await installBackendMock(page);
  await mockBoard(page, []);
  const used = new Set();
  await page.route('https://lb.e2e.invalid/rest/v1/rpc/lb_redeem', async (route) => {
    if (!live) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.lb_redeem' }) });
    const { p_code: code } = route.request().postDataJSON();
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    const CODES = {
      'GIFT-2026': { code: 'GIFT-2026', wins: 25000, label: 'Launch gift' }, // a pre-010 response: no kind fields
      LEVELUP: { code: 'LEVELUP', wins: 1000, label: 'Level up', kind: 'wins', per_level: true, boost_mult: 3, boost_min: 10 },
      TRIPLE: { code: 'TRIPLE', wins: 0, label: 'Triple', kind: 'boost', per_level: false, boost_mult: 3, boost_min: 10 },
    };
    if (!CODES[code]) return json({ error: 'bad_code' });
    if (used.has(code)) return json({ error: 'already_redeemed' });
    used.add(code);
    return json(CODES[code]);
  });
  await page.addInitScript((level) => {
    if (sessionStorage.getItem('rc.seeded')) return;
    sessionStorage.setItem('rc.seeded', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: level, into: 0 }));
    localStorage.setItem('taw.wins', '1000');
    localStorage.setItem('taw.claims', '[]');
  }, level);
  await page.goto('/?portal=1');
  await menuReady(page);
}
const wins = (page) => page.evaluate(() => Number(localStorage.getItem('taw.wins') || 0));
async function redeem(page, code) {
  const input = page.locator('.shop-codes-input');
  await input.scrollIntoViewIfNeeded();
  await input.fill(code);
  await page.locator('.shop-codes-btn').click();
  return page.locator('.shop-codes-msg');
}

for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`a code lands in REWARDS, pays once, and never twice @ ${vp.width}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await boot(page);
    await navControl(page, 'shop').click();
    await expect(page.locator('.shop-codes')).toBeVisible();
    await expect(await redeem(page, 'nope')).toHaveText("THAT CODE DOESN'T EXIST");
    const before = await wins(page);
    await expect(await redeem(page, 'gift-2026')).toHaveText('+25K WINS — CLAIM IT IN STATS');
    expect(await wins(page), 'a code never pays on its own').toBe(before);
    await page.locator('.shop-codes').screenshot({ path: `claude/codes/shop-codes-${vp.width}.png` });
    await page.screenshot({ path: `claude/codes/shop-${vp.width}.png` });
    const claims = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.claims') || '[]'));
    expect(claims.filter((c) => c.kind === 'code').map((c) => [c.label, c.amount])).toEqual([['CODE — LAUNCH GIFT', 25000]]);
    await expect(await redeem(page, 'GIFT-2026')).toHaveText('YOU ALREADY REDEEMED THAT CODE');
    // claim it: exactly its wins
    await page.locator('.shop-close').click();
    await expect(page.locator('.shop-panel')).toHaveCount(0);
    const open = page.getByRole('button', { name: /Open stats — \d+ to claim/ });
    await open.first().click();
    const row = page.locator('.claims-row').filter({ hasText: 'LAUNCH GIFT' }).first();
    await row.waitFor();
    await row.getByRole('button', { name: /CLAIM/ }).click();
    await expect.poll(() => wins(page)).toBe(before + 25000);
  });
}

test('a DB without migration 007 says codes are not switched on', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, { live: false });
  await navControl(page, 'shop').click();
  await expect(await redeem(page, 'GIFT-2026')).toHaveText('CODES AREN’T SWITCHED ON YET');
});

// ---- R10 (migration 010): SCALING + BOOST codes ----
async function claimRow(page, text) {
  await page.locator('.shop-close').click();
  await page.getByRole('button', { name: /Open stats — \d+ to claim/ }).first().click();
  const row = page.locator('.claims-row').filter({ hasText: text }).first();
  await row.waitFor();
  return row;
}

test('a PER-LEVEL code pays wins × the level at claim (LV20 → 1,000 × 20)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  await boot(page);
  await navControl(page, 'shop').click();
  await expect(await redeem(page, 'levelup')).toHaveText(/^\+1.000 WINS × YOUR LEVEL — CLAIM IT IN STATS$/);
  const before = await wins(page);
  const row = await claimRow(page, 'LEVEL UP');
  await expect(row.getByRole('button', { name: /CLAIM/ })).toHaveText('CLAIM +20K');
  await row.getByRole('button', { name: /CLAIM/ }).click();
  await expect.poll(() => wins(page)).toBe(before + 20000);
});

test('a BOOST code: claim starts ×3 on everything, a gold pill counts down on the menu, nothing under 13px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  await boot(page);
  await navControl(page, 'shop').click();
  await expect(await redeem(page, 'triple')).toHaveText('BOOST ×3 · 10 MIN — CLAIM IT IN STATS TO START');
  const before = await wins(page);
  const row = await claimRow(page, 'TRIPLE');
  await expect(row.getByRole('button', { name: /START/ })).toHaveText('START ×3 · 10 MIN');
  await row.getByRole('button', { name: /START/ }).click();
  expect(await wins(page), 'a boost pays nothing by itself').toBe(before);
  await page.keyboard.press('Escape');
  const boost = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.boost') || 'null'));
  expect(boost.mult).toBe(3);
  expect(boost.until - Date.now()).toBeGreaterThan(9 * 60 * 1000);
  const pill = page.locator('.menu-boost-pill');
  await expect(pill).toBeVisible();
  await expect(pill).toContainText('BOOST ×3');
  await expect(pill).toContainText(/\d:\d\d/);
  const px = await pill.evaluate((el) => Math.min(...[el, ...el.querySelectorAll('*')].map((n) => parseFloat(getComputedStyle(n).fontSize))));
  expect(px).toBeGreaterThanOrEqual(13);
  await page.screenshot({ path: 'claude/day-oct2/r10-boost-pill-1280x551.png' });
});

test('BOOST OVER: when the clock hits 0 on the menu a finite moment plays and leaves no loop behind', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('bo.seeded')) return;
    sessionStorage.setItem('bo.seeded', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.boost', JSON.stringify({ until: Date.now() + 9000, mult: 3 }));
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  await expect(page.locator('.menu-boost-pill')).toBeVisible();
  await expect(page.locator('.menu-boost-pill.is-ending')).toBeVisible({ timeout: 6000 }); // last 10 s: red
  const over = page.locator('.tover.is-boost');
  await expect(over).toBeVisible({ timeout: 12000 });
  await expect(over).toContainText('BOOST OVER');
  await expect(over).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator('.menu-boost-pill')).toHaveCount(0);
  const infinite = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).length);
  expect(infinite).toBe(0);
});

test('a fresh LV1 profile at 1280x551 shows no boost pill and pays as before', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  await boot(page, { level: 1 });
  await expect(page.locator('.menu-boost-pill')).toHaveCount(0);
  await expect(page.locator('.tover')).toHaveCount(0);
});
