// e2e/paid-gems.spec.js — PAID GEMS (payments/, migration 082). The shop's GEMS shelf is HIDDEN unless the payments flag
// is on (production: VITE_PAYMENTS_ON=1; this e2e build also honours ?payments=1 — playwright.config.js
// VITE_PAYMENTS_E2E). With it on, at 1366 and 390: four packs, a dollar price on every one, ASK A PARENT, the $20 monthly
// line, ODDS and the refund line, nothing clipped or under 44px; a tap → confirm → POST /api/checkout carries { pack,
// secret } and NO amount, then the redirect. The return (?paid=1) picks up the paid ledger row, grants it once, acks it,
// and flies the gems into the menu pill. Stripe and the database are mocked; nothing leaves localhost.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

const SECRET = 'd'.repeat(48);

async function boot(page, { query = '', gems = 40, pending = { rows: [], spent_cents: 0, cap_cents: 2000, flagged: false, profile: true } } = {}) {
  await installBackendMock(page);
  const calls = { checkout: [], pending: 0, ack: [] };
  await page.route('**/api/checkout', async (route) => {
    calls.checkout.push(route.request().postDataJSON());
    // the mock "Stripe" page is this site's own return URL (startCheckout only follows checkout.stripe.com or self)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: '/?paid=1&season2=1&portal=1&payments=1' }) });
  });
  await page.route('**/rest/v1/rpc/pay_gems_pending', async (route) => {
    calls.pending += 1;
    const body = typeof pending === 'function' ? pending(calls.pending) : pending;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/rest/v1/rpc/pay_gems_ack', async (route) => {
    calls.ack.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '1' });
  });
  await page.addInitScript(({ gems, secret }) => {
    if (sessionStorage.getItem('pg.seeded')) return;
    sessionStorage.setItem('pg.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 0, v: 10 }));
    localStorage.setItem('taw.s2.wins', '0');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: gems, mig: 1 }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'p-1', username: 'PAYTEST' }));
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('taw.s2.drop', JSON.stringify({ day, claimed: true, tier: 'rare' }));
  }, { gems, secret: SECRET });
  await page.goto(`/?portal=1&season2=1${query}`);
  await menuReady(page);
  return calls;
}
async function openShop(page) {
  await navControl(page, 'shop').click();
  await page.locator('.sp2').waitFor({ state: 'visible' });
}
const gemsBal = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal);

for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`@${vp.width}: flag OFF — no GEMS shelf, no pay calls`, async ({ page }) => {
    await page.setViewportSize(vp);
    const calls = await boot(page);
    await openShop(page);
    await expect(page.locator('.sp2-tab')).toHaveCount(3);
    await expect(page.locator('.sp2-tab[data-shelf="gems"]')).toHaveCount(0);
    await expect(page.getByTestId('shop-gems')).toHaveCount(0);
    expect(calls.pending).toBe(0); // the menu never asks the pay ledger with the flag off
  });

  test(`@${vp.width}: flag ON — the GEMS shelf: prices, ask a parent, the cap, ODDS, refunds; nothing clipped; checkout sends no amount`, async ({ page }) => {
    await page.setViewportSize(vp);
    const calls = await boot(page, { query: '&payments=1', pending: { rows: [], spent_cents: 499, cap_cents: 2000, flagged: false, profile: true } });
    await openShop(page);
    const tab = page.locator('.sp2-tab[data-shelf="gems"]');
    await expect(page.locator('.sp2-tab')).toHaveCount(4);
    await tab.click();
    const shelf = page.getByTestId('shop-gems');
    await expect(shelf).toBeVisible();
    // every tab still a full target, on the screen, its word whole
    for (const t of await page.locator('.sp2-tab').all()) {
      const b = await t.boundingBox();
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 0.5);
      expect(await t.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    await expect(page.getByTestId('pay-parent')).toContainText('ASK A PARENT FIRST');
    await expect(page.getByTestId('pay-cap')).toContainText('$20 A MONTH LIMIT');
    await expect(page.getByTestId('pay-cap')).toContainText('$15.01 LEFT'); // 2000 − 499
    await expect(page.getByTestId('pay-refund')).toContainText('refund');
    await expect(shelf.getByTestId('roll-rates')).toBeVisible(); // ODDS, one tap away
    const packs = shelf.locator('.pg-pack');
    await expect(packs).toHaveCount(4);
    const prices = { pouch: '$1.99', pile: '$4.99', chest: '$9.99', hoard: '$19.99' };
    for (const [id, usd] of Object.entries(prices)) {
      await expect(page.getByTestId(`pay-price-${id}`)).toHaveText(usd);
    }
    await expect(shelf.locator('.pg-pack.is-over')).toHaveCount(1); // $19.99 > $15.01 left: greyed, price still shown
    // nothing clipped: each pack on screen, ≥ 44px, its name / gems / price inside it
    for (const p of await packs.all()) {
      await p.scrollIntoViewIfNeeded();
      const b = await p.boundingBox();
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 0.5);
      const inside = await p.evaluate((el) => {
        const o = el.getBoundingClientRect();
        return [...el.querySelectorAll('.pg-name, .pg-gems, .pg-price')].every((c) => {
          const r = c.getBoundingClientRect();
          return r.left >= o.left - 0.5 && r.right <= o.right + 0.5 && r.top >= o.top - 0.5 && r.bottom <= o.bottom + 0.5 && c.scrollWidth <= c.clientWidth + 1;
        });
      });
      expect(inside).toBe(true);
    }
    // the shelf reads at the type floor (no text under 14px)
    const smallest = await shelf.evaluate((el) => Math.min(...[...el.querySelectorAll('*')].filter((n) => n.childNodes.length && [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())).map((n) => parseFloat(getComputedStyle(n).fontSize))));
    expect(smallest).toBeGreaterThanOrEqual(14);
    await page.screenshot({ path: `test-results/paid-gems-${vp.width}.png` });

    // ODDS opens the same rates popup the roll screen shows, above the shop
    await shelf.getByTestId('roll-rates').click();
    await expect(page.getByTestId('roll-rates-pop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('roll-rates-pop')).toHaveCount(0);
    await expect(shelf).toBeVisible(); // Esc closed the popup, not the shop

    // over the cap: no confirm, a note
    await shelf.locator('.pg-pack[data-pack="hoard"]').click();
    await expect(page.getByTestId('pay-confirm')).toHaveCount(0);
    // a pack → the confirm step → checkout
    await shelf.locator('.pg-pack[data-pack="pile"]').click();
    const confirm = page.getByTestId('pay-confirm');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('parent or guardian');
    await expect(page.getByTestId('pay-go')).toHaveText('PARENT: PAY $4.99');
    const go = await page.getByTestId('pay-go').boundingBox();
    expect(go.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `test-results/paid-gems-confirm-${vp.width}.png` });
    await page.getByTestId('pay-go').click();
    await expect.poll(() => calls.checkout.length).toBe(1);
    expect(calls.checkout[0]).toEqual({ pack: 'pile', secret: SECRET }); // NO amount, NO gems — the server prices it
    await page.waitForURL(/[?&]paid=1/).catch(() => {}); // the mocked "Stripe" sends us straight back
  });
}

test('back from Stripe (?paid=1): polls until the webhook lands, grants once, acks, and flies the gems in (a re-sent row is never paid twice: payClient.test.js)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  // the first poll is empty (the webhook is a beat behind the redirect), the second carries the purchase
  const calls = await boot(page, {
    query: '&payments=1&paid=1',
    gems: 40,
    pending: (n) => ({ rows: n >= 2 ? [{ id: 41, delta: 1700, reason: 'purchase' }] : [], spent_cents: n >= 2 ? 499 : 0, cap_cents: 2000, flagged: false, profile: true }),
  });
  await expect.poll(() => gemsBal(page), { timeout: 15000 }).toBe(1740);
  await expect.poll(() => calls.ack.length).toBeGreaterThanOrEqual(1);
  expect(calls.ack[0]).toEqual({ p_secret: SECRET, p_ids: [41] });
  expect(await page.evaluate(() => new URLSearchParams(location.search).get('paid'))).toBeNull(); // a reload won't poll again
  await expect(page.locator('.menu-gems-chip').first()).toContainText('1,740', { timeout: 5000 }); // the fly lands, the pill counts it in
});
