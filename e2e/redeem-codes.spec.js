// redeem-codes.spec.js — STEP 61. The shop's CODES entry against a mocked lb_redeem
// (supabase/migrations/007_redeem_codes.sql): a good code lands in REWARDS (it does not pay on its
// own), claiming pays exactly its wins, a second try says already-redeemed, a wrong code says so,
// and a DB without 007 says codes are not switched on — never a crash.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

async function boot(page, { live = true } = {}) {
  await installBackendMock(page);
  await mockBoard(page, []);
  const used = new Set();
  await page.route('https://lb.e2e.invalid/rest/v1/rpc/lb_redeem', async (route) => {
    if (!live) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.lb_redeem' }) });
    const { p_code: code } = route.request().postDataJSON();
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (code !== 'GIFT-2026') return json({ error: 'bad_code' });
    if (used.has(code)) return json({ error: 'already_redeemed' });
    used.add(code);
    return json({ code, wins: 25000, label: 'Launch gift' });
  });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('rc.seeded')) return;
    sessionStorage.setItem('rc.seeded', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 20, into: 0 }));
    localStorage.setItem('taw.wins', '1000');
    localStorage.setItem('taw.claims', '[]');
  });
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
    await expect(await redeem(page, 'gift-2026')).toHaveText('+25K WINS — CLAIM IT IN REWARDS');
    expect(await wins(page), 'a code never pays on its own').toBe(before);
    await page.locator('.shop-codes').screenshot({ path: `claude/codes/shop-codes-${vp.width}.png` });
    await page.screenshot({ path: `claude/codes/shop-${vp.width}.png` });
    const claims = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.claims') || '[]'));
    expect(claims.filter((c) => c.kind === 'code').map((c) => [c.label, c.amount])).toEqual([['CODE — LAUNCH GIFT', 25000]]);
    await expect(await redeem(page, 'GIFT-2026')).toHaveText('YOU ALREADY REDEEMED THAT CODE');
    // claim it: exactly its wins
    await page.locator('.shop-close').click();
    await expect(page.locator('.shop-panel')).toHaveCount(0);
    const open = page.getByRole('button', { name: /Open rewards/ });
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
