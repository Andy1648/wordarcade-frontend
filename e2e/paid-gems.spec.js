// e2e/paid-gems.spec.js — PAID GEMS (payments/, migration 082). The "+" on every gem pill and the panel behind it are HIDDEN
// unless the payments flag is on (production: VITE_PAYMENTS_ON=1; this e2e build also honours ?payments=1 —
// playwright.config.js VITE_PAYMENTS_E2E). With it on, at phone and desktop sizes: four packs, a dollar price on every one,
// the $20 monthly line, ODDS and the refund line, all on screen with no scrolling; one tap on a pack POSTs
// /api/checkout with { pack, secret } and NO amount, then the redirect. The return (?paid=1) picks up the paid ledger row,
// grants it once, acks it, and flies the gems into the menu pill. Stripe and the database are mocked; nothing leaves localhost.
import { test, expect } from '@playwright/test';
import { mockGsi } from './support/gsiMock.js';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

const SECRET = 'd'.repeat(48);

// signedIn: a SIGN IN WITH GOOGLE session (085 — buying needs one; the packs show only then)
async function boot(page, { query = '', gems = 40, firstBuy = false, signedIn = true, pending = { rows: [], spent_cents: 0, cap_cents: 2000, flagged: false, profile: true } } = {}) {
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
  await page.route('**/rest/v1/rpc/pay_first_buy_open', (route) => (firstBuy
    ? route.fulfill({ status: 200, contentType: 'application/json', body: 'true' })
    : route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"PGRST202"}' }))); // 088 not run yet
  await page.route('**/rest/v1/rpc/pay_gems_ack', async (route) => {
    calls.ack.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '1' });
  });
  await mockGsi(page);
  await page.addInitScript(({ gems, secret, signedIn }) => {
    if (sessionStorage.getItem('pg.seeded')) return;
    sessionStorage.setItem('pg.seeded', '1');
    if (signedIn) localStorage.setItem('taw.auth', JSON.stringify({ access: 'e2e-access-token', refresh: 'r', exp: Date.now() + 3600000, email: 'parent@example.com' }));
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
  }, { gems, secret: SECRET, signedIn });
  await page.goto(`/?portal=1&season2=1${query}`);
  await menuReady(page);
  return calls;
}
async function openShop(page) {
  await navControl(page, 'shop').click();
  await page.locator('.sp2').waitFor({ state: 'visible' });
}
const gemsBal = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal);

const SHOTS = process.env.SHOTS;
const plusOf = (page, scope = page) => scope.locator('[data-testid="gems-plus"]:visible').first();
async function openPanel(page) {
  await plusOf(page).click();
  const panel = page.getByTestId('buy-gems');
  await expect(panel).toBeVisible();
  return panel;
}
/** The whole panel on screen, nothing scrolling, every control a real target, no two controls overlapping, no tiny text. */
async function expectPanelFits(panel) {
  await expect.poll(() => panel.evaluate((el) => Math.abs(el.getBoundingClientRect().width - el.offsetWidth) < 0.05)).toBe(true); // the one finite enter scales it
  const m = await panel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = (p, q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 1 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 1;
    const ctl = [...el.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect());
    const texts = [...el.querySelectorAll('*')].filter((n) => !n.closest('[data-testid="gsi-official"]') && [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()));
    return {
      inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      scrolls: el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
      minH: Math.min(...[...el.querySelectorAll('button:not([data-testid="gsi-official"])')].filter((b) => b.getClientRects().length).map((b) => b.offsetHeight)), // Google's own button is its ~40 px
      overlaps: ctl.flatMap((a, i) => ctl.slice(i + 1).filter((b) => hit(a, b))).length,
      smallest: Math.min(...texts.map((n) => parseFloat(getComputedStyle(n).fontSize))),
      clipped: texts.filter((n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).display !== 'inline').map((n) => n.textContent.slice(0, 20)),
    };
  });
  expect(m).toMatchObject({ inside: true, scrolls: false, overlaps: 0, clipped: [] });
  expect(m.minH).toBeGreaterThanOrEqual(44);
  expect(m.smallest).toBeGreaterThanOrEqual(14);
}
const VIEWS = [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 1280, height: 600 }];

for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`@${vp.width}: flag OFF — no +, no panel, no GEMS tab, no pay calls`, async ({ page }) => {
    await page.setViewportSize(vp);
    const calls = await boot(page, { query: '' });
    await expect(page.getByTestId('gems-plus')).toHaveCount(0);
    await expect(page.locator('.kp.has-plus')).toHaveCount(0);
    await openShop(page);
    await expect(page.getByTestId('gems-plus')).toHaveCount(0);
    await expect(page.locator('.sp2-tab[data-shelf="gems"]')).toHaveCount(0);
    await expect(page.getByTestId('buy-gems')).toHaveCount(0);
    expect(calls.pending).toBe(0);
    expect(calls.checkout.length).toBe(0);
  });
}

for (const vp of VIEWS) {
  test(`@${vp.width}x${vp.height}: flag ON — the + opens the one panel: prices, the cap, ODDS, refunds; it fits; one tap reaches checkout with no amount`, async ({ page }) => {
    await page.setViewportSize(vp);
    const calls = await boot(page, { query: '&payments=1', pending: { rows: [], spent_cents: 499, cap_cents: 2000, flagged: false, profile: true } });
    // the + is part of the pill: a full target, inside the screen, over nothing else
    const plus = plusOf(page);
    await expect(plus).toBeVisible();
    const b = await plus.boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(await plus.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return el.contains(at);
    })).toBe(true);
    await page.waitForTimeout(1200); // past the menu's entrance
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/plus-menu-${vp.width}.png` });

    const panel = await openPanel(page);
    await expect(page.getByText(/parent/i)).toHaveCount(0); // Andy nov5: gone everywhere
    await expect(page.getByTestId('pay-cap')).toContainText('$20 A MONTH LIMIT');
    await expect(page.getByTestId('pay-cap')).toContainText('$15.01 LEFT'); // 2000 − 499
    await expect(page.getByTestId('pay-refund')).toContainText('refund');
    await expect(panel.getByTestId('roll-rates')).toBeVisible(); // ODDS, one tap away
    await expect(panel.locator('.pg-pack')).toHaveCount(4);
    const prices = { pouch: '$1.99', pile: '$4.99', chest: '$9.99', hoard: '$19.99' };
    for (const [id, usd] of Object.entries(prices)) await expect(page.getByTestId(`pay-price-${id}`)).toHaveText(usd);
    // every pack says its gems in full, the same way (16,000, never 16K), inside its card at every size
    for (const [id, n] of Object.entries({ pouch: '1,000', pile: '3,000', chest: '7,000', hoard: '16,000' })) await expect(panel.locator(`.pg-pack[data-pack="${id}"] .pg-gems`)).toHaveText(n);
    expect(await panel.evaluate((el) => [...el.querySelectorAll('.pg-pack')].filter((p) => { const o = p.getBoundingClientRect(); const g = p.querySelector('.pg-gems').getBoundingClientRect(); return g.left < o.left || g.right > o.right; }).length)).toBe(0);
    await expect(panel.locator('.pg-pack.is-over')).toHaveCount(1); // $19.99 > $15.01 left: greyed, price still shown
    await expectPanelFits(panel);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/plus-panel-${vp.width}.png` });

    // ODDS opens the same rates popup the roll screen shows, ABOVE the panel; Esc closes it, not the panel
    await panel.getByTestId('roll-rates').click();
    await expect(page.getByTestId('roll-rates-pop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('roll-rates-pop')).toHaveCount(0);
    await expect(panel).toBeVisible();

    // over the cap: a note in the fine print's place, nothing moved, no checkout
    const before = await panel.locator('.pg-pack[data-pack="pouch"]').boundingBox();
    await panel.locator('.pg-pack[data-pack="hoard"]').click();
    await expect(page.getByTestId('pay-note')).toContainText('LIMIT');
    expect(Math.abs((await panel.locator('.pg-pack[data-pack="pouch"]').boundingBox()).y - before.y)).toBeLessThan(1); // sub-pixel centring aside
    await expectPanelFits(panel);
    expect(calls.checkout.length).toBe(0);

    // one tap on a pack → checkout
    await panel.locator('.pg-pack[data-pack="pile"]').click();
    await expect.poll(() => calls.checkout.length).toBe(1);
    expect(calls.checkout[0]).toEqual({ pack: 'pile', secret: SECRET, access: 'e2e-access-token' }); // NO amount, NO gems — the server prices it; 085: the Google session
    await page.waitForURL(/[?&]paid=1/).catch(() => {}); // the mocked "Stripe" sends us straight back
  });

  test(`@${vp.width}x${vp.height}: not signed in — the packs still show; a tap asks for Google, BACK returns, and the script loads only then`, async ({ page }) => {
    await page.setViewportSize(vp);
    let gsiReqs = 0;
    page.on('request', (r) => { if (r.url().includes('accounts.google.com/gsi/client')) gsiReqs += 1; });
    const calls = await boot(page, { query: '&payments=1&google=1', signedIn: false });
    const panel = await openPanel(page);
    await expect(panel.locator('.pg-pack')).toHaveCount(4);
    await expect(page.getByTestId('pay-signin')).toHaveCount(0);
    expect(gsiReqs).toBe(0);
    await expectPanelFits(panel);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/plus-signedout-${vp.width}.png` });
    await panel.locator('.pg-pack[data-pack="pile"]').click();
    const ask = page.getByTestId('pay-signin');
    await expect(ask).toContainText('SIGN IN TO GET 3,000 GEMS');
    await expect(ask).toContainText('$4.99');
    await expect(ask.getByTestId('gsi-official')).toBeVisible();
    await expectPanelFits(panel);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/plus-signin-${vp.width}.png` });
    expect(calls.checkout.length).toBe(0);
    await page.getByTestId('pay-signin-back').click();
    await expect(panel.locator('.pg-pack')).toHaveCount(4);
    await expect(ask).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('taw.pay.resume'))).toBeNull();
  });

  for (const [gems, shown] of [[987654321987654, '988T'], [1740, '1,740'], [12345, '12.3K']]) {
    test(`@${vp.width}x${vp.height}: a gem count of ${shown}: the figure stays clear of the + and the gem, in the pill and the panel`, async ({ page }) => {
      await page.setViewportSize(vp);
      await boot(page, { query: '&payments=1', gems });
      await page.waitForTimeout(1500); // past the menu's entrance, and the fonts' second measure
      const m = await page.locator('.menu-gems-chip:visible').first().evaluate(async (el) => {
        await document.fonts.ready;
        const n = el.querySelector('.kp-num');
        const num = n.getBoundingClientRect();
        const plus = el.querySelector('.gems-plus-face').getBoundingClientRect();
        const icon = el.querySelector('.kp-icon').getBoundingClientRect();
        return { text: n.textContent, gap: plus.left - num.right, overIcon: icon.right - num.left, iconW: icon.width };
      });
      expect(m.text).toBe(shown);
      expect(m.gap).toBeGreaterThanOrEqual(0);
      expect(m.overIcon).toBeLessThanOrEqual(m.iconW * 0.12); // the painted gem has a little clear margin in its box
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/plus-count-${shown.replace(/\W/g, '')}-${vp.width}.png` });
      const panel = await openPanel(page);
      await expectPanelFits(panel);
      if (SHOTS && gems > 1e9) await page.screenshot({ path: `${SHOTS}/plus-huge-panel-${vp.width}.png` });
    });
  }
}

test('the + is on every gem pill: the shop and the roll screen open the same panel; CLOSE and Esc come back where you were', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page, { query: '&payments=1' });
  await openShop(page);
  await expect(page.locator('.sp2-tab[data-shelf="gems"]')).toHaveCount(0); // ONE place to buy: the tab is gone
  const panel = await openPanel(page);
  await expectPanelFits(panel);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator('.sp2')).toBeVisible();
  await openPanel(page);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.locator('.sp2')).toBeVisible();
  await page.goto(`/?portal=1&season2=1&payments=1`);
  await menuReady(page);
  await page.locator('.hp-nav.is-gears:visible').first().click(); // the GEARS rail button (ROLL + INDEX)
  const roll = page.locator('.rs-gems-bal').first();
  await expect(roll).toBeVisible();
  const again = await openPanel(page);
  await expect(again).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/plus-from-roll-1366.png` });
});

// FIRST BUY ×2 (088): the stamp follows the server's answer; before 088 has run (404) there is no stamp and no promise
for (const vp of VIEWS) {
  for (const signedIn of [true, false]) {
    test(`@${vp.width}x${vp.height}: FIRST BUY stamp, ${signedIn ? 'signed in' : 'signed out'}: honest amounts on every pack, and it fits`, async ({ page }) => {
      await page.setViewportSize(vp);
      const calls = await boot(page, { query: '&payments=1&google=1', firstBuy: true, signedIn });
      const panel = await openPanel(page);
      await expect(panel.getByTestId('pay-first')).toHaveCount(4);
      for (const [id, n] of Object.entries({ pouch: '1,000', pile: '3,000', chest: '7,000', hoard: '16,000' })) {
        await expect(page.getByTestId(`pay-bonus-${id}`)).toHaveText(`+${n} BONUS`);
        await expect(panel.locator(`.pg-pack[data-pack="${id}"] .pg-gems`)).toHaveText(n);
      }
      await expect(page.getByTestId('pay-refund')).toContainText('First buy doubles, once per Google account');
      await expectPanelFits(panel);
      // each stamp stays on screen and off its pack's numbers
      expect(await panel.evaluate((el) => [...el.querySelectorAll('.pg-pack')].filter((p) => {
        const s = p.querySelector('.pg-first').getBoundingClientRect();
        const hit = (q) => Math.min(s.right, q.right) - Math.max(s.left, q.left) > 1 && Math.min(s.bottom, q.bottom) - Math.max(s.top, q.top) > 1;
        return ['.pg-gems', '.pg-bonus', '.pg-price'].some((c) => hit(p.querySelector(c).getBoundingClientRect())) || s.left < 0 || s.top < 0;
      }).length)).toBe(0);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/first-buy-${signedIn ? 'in' : 'out'}-${vp.width}.png` });
      expect(calls.checkout.length).toBe(0);
    });
  }
}

test('before 088 has run: no stamp, no bonus line, and the panel works as before', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page, { query: '&payments=1', firstBuy: false });
  const panel = await openPanel(page);
  await expect(panel.locator('.pg-pack')).toHaveCount(4);
  await expect(panel.getByTestId('pay-first')).toHaveCount(0);
  await expect(panel.locator('.pg-bonus')).toHaveCount(0);
  await expect(page.getByTestId('pay-refund')).not.toContainText('First buy');
  await expect(panel.locator('.pg-pack[data-pack="pouch"]')).toHaveAttribute('aria-label', /1000 gems for \$1\.99/);
});

test('a client can\'t claim the bonus: checkout still sends only the pack', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const calls = await boot(page, { query: '&payments=1', firstBuy: true });
  const panel = await openPanel(page);
  await panel.locator('.pg-pack[data-pack="pouch"]').click();
  await expect.poll(() => calls.checkout.length).toBe(1);
  expect(calls.checkout[0]).toEqual({ pack: 'pouch', secret: SECRET, access: 'e2e-access-token' });
});

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
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/plus-after-purchase-menu-1366.png` });
  const panel = await openPanel(page);
  await expect(page.getByTestId('pay-have')).toContainText('1,740');
  await expect(page.getByTestId('pay-cap')).toContainText('$15.01 LEFT');
  await expectPanelFits(panel);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/plus-after-purchase-panel-1366.png` });
});
