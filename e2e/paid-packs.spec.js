// e2e/paid-packs.spec.js — PAID ROLL PACKS (089): the shop's PACKS shelf and the + panel's PACKS tab. Hidden unless the
// payments flag is on (this e2e build honours ?payments=1 — playwright.config.js VITE_PAYMENTS_E2E). With it on, at phone
// and desktop sizes: two packs with a dollar price each, the shared $20 line and the refund line, every control a real
// target, nothing tiny, nothing overlapping, no sideways scroll; ODDS one tap away with the exact tier + gear odds; one tap
// on a price POSTs /api/checkout with { pack, secret, access } and NO amount. An unopened paid pack (lb_tickets source
// 'pay') shows OPEN and opens with the existing sealed-roll reveal; back from Stripe (?paid=1) the bought pack opens by
// itself. Stripe and the database are mocked; nothing leaves localhost.
import { test, expect } from '@playwright/test';
import { mockGsi } from './support/gsiMock.js';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

const SECRET = 'd'.repeat(48);
const TICKET = '0b6f5a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
const SHOTS = process.env.SHOTS;

async function boot(page, { query = '&payments=1', tickets = [], signedIn = true, spent = 0, session = null } = {}) {
  await installBackendMock(page);
  const calls = { checkout: [], tickets: 0 };
  await page.route('**/api/checkout', async (route) => {
    calls.checkout.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: '/?paid=1&season2=1&portal=1&payments=1' }) });
  });
  await page.route('**/rest/v1/rpc/pay_gems_pending', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [], spent_cents: spent, cap_cents: 2000, flagged: false, profile: true }) }));
  await page.route('**/rest/v1/rpc/pay_first_buy_open', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'false' }));
  await page.route('**/rest/v1/rpc/lb_tickets', async (route) => {
    calls.tickets += 1;
    const list = typeof tickets === 'function' ? tickets(calls.tickets) : tickets;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, tickets: list, streak: null }) });
  });
  await mockGsi(page);
  await page.addInitScript(({ secret, signedIn, session }) => {
    if (sessionStorage.getItem('pk.seeded')) return;
    sessionStorage.setItem('pk.seeded', '1');
    if (signedIn) localStorage.setItem('taw.auth', JSON.stringify({ access: 'e2e-access-token', refresh: 'r', exp: Date.now() + 3600000, email: 'parent@example.com' }));
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 0, v: 10 }));
    localStorage.setItem('taw.s2.wins', '0');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 40, mig: 1 }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'p-1', username: 'PAYTEST' }));
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('taw.s2.drop', JSON.stringify({ day, claimed: true, tier: 'rare' }));
    if (session) sessionStorage.setItem('taw.pay.packOpen', JSON.stringify({ pack: session, at: Date.now() }));
  }, { secret: SECRET, signedIn, session });
  await page.goto(`/?portal=1&season2=1${query}`);
  await menuReady(page);
  return calls;
}
async function openPacksShelf(page) {
  await navControl(page, 'shop').click();
  await page.locator('.sp2').waitFor({ state: 'visible' });
  await page.locator('.sp2-tab[data-shelf="packs"]').click();
  const shelf = page.getByTestId('shop-packs');
  await expect(shelf.locator('.pk-card')).toHaveCount(2);
  return shelf;
}

/** Every control a real target (≥ 44px), no text under 14px, no two controls overlapping, nothing clipped or off screen. */
async function expectFits(page, scope) {
  await page.evaluate(() => document.fonts.ready);
  const m = await scope.evaluate((el) => {
    const hit = (p, q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 1 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 1;
    const btns = [...el.querySelectorAll('button')].filter((b) => b.getClientRects().length && !b.closest('[data-testid="gsi-official"]'));
    const boxes = btns.map((b) => b.getBoundingClientRect());
    const texts = [...el.querySelectorAll('*')].filter((n) => n.getClientRects().length && !n.closest('[data-testid="gsi-official"]') && [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()));
    return {
      minH: Math.min(...btns.map((b) => b.offsetHeight)),
      minW: Math.min(...btns.map((b) => b.offsetWidth)),
      overlaps: boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => hit(a, b))).length,
      smallest: Math.min(...texts.map((n) => parseFloat(getComputedStyle(n).fontSize))),
      // (a shelf tab's NEW dot hangs past its corner on purpose: it widens scrollWidth without clipping any text)
      clipped: texts.filter((n) => !n.querySelector('.sp2-dot') && n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).display !== 'inline').map((n) => n.textContent.slice(0, 20)),
      offscreen: boxes.filter((r) => r.left < 0 || r.right > innerWidth + 0.5).length,
      sideways: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  expect(m).toMatchObject({ overlaps: 0, clipped: [], offscreen: 0, sideways: false });
  expect(m.minH).toBeGreaterThanOrEqual(44);
  expect(m.minW).toBeGreaterThanOrEqual(44);
  expect(m.smallest).toBeGreaterThanOrEqual(14);
}

const VIEWS = [{ width: 390, height: 844 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }];

test('flag OFF: no PACKS shelf, no PACKS tab, no ticket calls for packs', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const calls = await boot(page, { query: '' });
  await navControl(page, 'shop').click();
  await page.locator('.sp2').waitFor({ state: 'visible' });
  await expect(page.locator('.sp2-tab[data-shelf="packs"]')).toHaveCount(0);
  await expect(page.getByTestId('shop-packs')).toHaveCount(0);
  expect(calls.checkout.length).toBe(0);
});

for (const vp of VIEWS) {
  test(`@${vp.width}x${vp.height}: the shop's PACKS shelf — prices, the shared cap, refunds, exact odds, one tap to checkout with no amount`, async ({ page }) => {
    await page.setViewportSize(vp);
    const calls = await boot(page, { spent: 499 });
    const shelf = await openPacksShelf(page);
    await expect(page.getByTestId('pack-buy-mythic-pack')).toHaveText('$4.99');
    await expect(page.getByTestId('pack-buy-secret-pack')).toHaveText('$14.99');
    await expect(shelf.locator('.pk-card[data-pack="mythic-pack"] .pk-floor')).toHaveText('MYTHIC OR BETTER');
    await expect(shelf.locator('.pk-card[data-pack="secret-pack"] .pk-floor')).toHaveText('ALWAYS SECRET');
    await expect(page.getByTestId('pack-cap')).toContainText('$15.01 LEFT'); // the SAME month as gems: 2000 − 499
    await expect(page.getByTestId('pack-refund')).toContainText('refund');
    await expect(shelf.getByText(/limited|left today|ends in|sale/i)).toHaveCount(0); // no countdowns / limited offers
    await expect(shelf.locator('.pk-open')).toHaveCount(0); // none owned
    await page.waitForTimeout(400); // the shelf's enter has settled
    await expectFits(page, page.locator('.sp2-stock'));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/packs-shelf-${vp.width}.png` });

    // ODDS, one tap away: every tier and gear, exact
    await page.getByTestId('pack-odds-mythic-pack').click();
    const pop = page.getByTestId('pack-odds-pop');
    await expect(pop).toBeVisible();
    await expect(page.getByTestId('pack-odds-tier-mythic')).toHaveText('88.24%');
    await expect(page.getByTestId('pack-odds-tier-secret')).toHaveText('11.76%');
    await expect(pop.locator('.pk-odds-item')).toHaveCount(17);
    await expect(pop).toContainText('SINGULARITY');
    await expect(pop).toContainText('6.30%');
    await expect(pop).toContainText('Chase heroes never drop from packs');
    await expectFits(page, pop);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/packs-odds-mythic-${vp.width}.png` });
    await page.keyboard.press('Escape');
    await expect(pop).toHaveCount(0);
    await expect(page.locator('.sp2')).toBeVisible(); // Esc closed the odds only
    await page.getByTestId('pack-odds-secret-pack').click();
    await expect(page.getByTestId('pack-odds-tier-secret')).toHaveText('100.00%');
    await expect(pop.locator('.pk-odds-item')).toHaveCount(3);
    await page.getByRole('button', { name: 'Close odds' }).click();

    // one tap on the price → checkout, the pack id only
    await page.getByTestId('pack-buy-mythic-pack').click();
    await expect.poll(() => calls.checkout.length).toBe(1);
    expect(calls.checkout[0]).toEqual({ pack: 'mythic-pack', secret: SECRET, access: 'e2e-access-token' });
  });
}

test('over the cap: the pack greys out, a tap says so and never reaches checkout', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const calls = await boot(page, { spent: 999 });
  const shelf = await openPacksShelf(page);
  await expect(shelf.locator('.pk-card.is-over')).toHaveCount(1); // $14.99 > $10.01 left
  await page.getByTestId('pack-buy-secret-pack').click();
  await expect(page.getByTestId('pay-note')).toContainText('LIMIT');
  expect(calls.checkout.length).toBe(0);
});

test('signed out: a tap on a pack asks for Google, BACK returns to the packs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await boot(page, { query: '&payments=1&google=1', signedIn: false });
  const shelf = await openPacksShelf(page);
  await page.getByTestId('pack-buy-secret-pack').click();
  const ask = page.getByTestId('pay-signin');
  await expect(ask).toContainText('SIGN IN TO GET THE SECRET PACK');
  await expect(ask).toContainText('$14.99');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/packs-signin-390.png` });
  await page.getByTestId('pay-signin-back').click();
  await expect(shelf.locator('.pk-card')).toHaveCount(2);
  expect(calls.checkout.length).toBe(0);
});

test('an unopened paid pack shows OPEN; it opens with the sealed-roll reveal at its tier', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page, { tickets: [{ id: TICKET, tier: 'secret', state: 'owned', source: 'pay' }, { id: '1b6f5a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b', tier: 'legendary', state: 'owned', source: 'streak' }] });
  const shelf = await openPacksShelf(page);
  await expect(page.getByTestId('pack-open-secret-pack')).toBeVisible();
  await expect(page.getByTestId('pack-open-mythic-pack')).toHaveCount(0); // a streak ticket is not a pack
  await expectFits(page, page.locator('.sp2-stock'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/packs-owned-1366.png` });
  await page.getByTestId('pack-open-secret-pack').click();
  await expect(page.getByTestId('sealed-roll')).toBeVisible();
  await expect(page.getByTestId('sealed-roll')).toContainText('SECRET');
  await expect(shelf).toHaveCount(1);
});

for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`@${vp.width}x${vp.height}: the + panel reaches the packs (PACKS tab) and fits; GEMS is unchanged`, async ({ page }) => {
    await page.setViewportSize(vp);
    const calls = await boot(page);
    await page.locator('[data-testid="gems-plus"]:visible').first().click();
    const panel = page.getByTestId('buy-gems');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.pg-pack')).toHaveCount(4); // GEMS first, as before
    await expectFits(page, panel);
    await page.getByTestId('pay-tab-packs').click();
    await expect(panel.locator('.pk-card')).toHaveCount(2);
    await expect(panel.locator('.pg-pack')).toHaveCount(0);
    await expect(panel.locator('.pg-first')).toHaveCount(0); // FIRST BUY ×2 is gems only
    await page.waitForTimeout(300);
    await expectFits(page, panel);
    expect(await panel.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true); // the panel never scrolls
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/plus-packs-${vp.width}.png` });
    await page.getByTestId('pack-buy-secret-pack').click();
    await expect.poll(() => calls.checkout.length).toBe(1);
    expect(calls.checkout[0]).toEqual({ pack: 'secret-pack', secret: SECRET, access: 'e2e-access-token' });
  });
}

test('back from Stripe with a pack: the bought pack opens by itself once the webhook lands', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  // the first list is empty (the webhook is a beat behind the redirect), the next carries the paid ticket
  const calls = await boot(page, { query: '&payments=1&paid=1', session: 'mythic-pack', tickets: (n) => (n >= 2 ? [{ id: TICKET, tier: 'mythic', state: 'owned', source: 'pay' }] : []) });
  await expect(page.getByTestId('sealed-roll')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('sealed-roll')).toContainText('MYTHIC+');
  await expect(page.locator('[data-testid="sealed-roll"] .va-label')).toHaveText('MYTHIC+'); // the canister badge says the pack's floor, never LEGENDARY+
  expect(calls.tickets).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => sessionStorage.getItem('taw.pay.packOpen'))).toBeNull();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/packs-return-open-1366.png` });
});
