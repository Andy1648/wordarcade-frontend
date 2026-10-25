// e2e/daily-wheel.spec.js — THE DAILY WHEEL (season 2; progress/wheel.js + components/wheel/DailyWheel.jsx +
// leaderboard/serverWheel.js against a mocked 067_daily_wheel.sql):
//   1. the menu: the WHEEL tile (with today's dot) sits in the top-right cluster; NEWS + SETTINGS moved to the
//      bottom-right one; the CREDITS link is gone from the menu and lives inside SETTINGS;
//   2. SPIN asks the server ONCE, lands on the server's slot, pays the save ONCE (gems), claims, clears the dot;
//      reopening shows today's result and never pays again;
//   3. a ticket prize pays nothing locally (the server owns it) and says where it waits; the ODDS sheet sums to 100;
//   4. the panel fits every target viewport with no scroll.
// SHOTS=1 also saves the seeded screenshots for the PR (claude/shots-wheel/).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';

const SECRET = 'e'.repeat(48);
const SPIN_ID = '11111111-2222-4333-8444-555555555555';
const TICKET_ID = '99999999-8888-4777-8666-555555555555';
const SHOTS = !!process.env.SHOTS;

async function boot(page, { gems = 200, slot = 2, streak = 0 } = {}) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-wh', username: 'Spinner', level: 24, rebirths: 2, lifetime_words: 400, lifetime_letters: 2000, wins_per_word: 0, econ: 13 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, season2: true });
  // the 067 mock: one spin per day per kind; the same row on every later ask
  const db = { spun: null, claimed: false, calls: { spin: 0, claim: 0, state: 0 } };
  const PAY = { 0: ['gems', 25], 1: ['xp', 10], 2: ['gems', 60], 3: ['ticket', 0], 4: ['wins', 10], 5: ['ticket', 0], 6: ['gems', 120], 7: ['cosmetic', 0] };
  const body = (day, again) => {
    const [prize, base] = PAY[slot];
    const hot = streak + 1 >= 3;
    const amount = prize === 'gems' && hot ? Math.round(base * 1.5) : base; // = 067's HOT streak
    return {
      ok: true, again, spin: SPIN_ID, day, kind: 'free', slot, prize, amount, streak: streak + 1, bonus: hot ? 'hot' : null,
      claimed: db.claimed, cosmetic: prize === 'cosmetic' ? 'lucky' : null,
      ticket: prize === 'ticket' ? { id: TICKET_ID, tier: slot === 5 ? 'legendary' : 'rare' } : null,
    };
  };
  await page.route('https://lb.e2e.invalid/**/rpc/lb_wheel_*', async (route) => {
    const url = new URL(route.request().url());
    const p = JSON.parse(route.request().postData() || '{}');
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.pathname.endsWith('lb_wheel_state')) {
      db.calls.state += 1;
      return json({ ok: true, day: p.p_day, streak, last_day: p.p_day - 1, ad_on: false, free: db.spun ? body(db.spun, true) : null, ad: null });
    }
    if (url.pathname.endsWith('lb_wheel_spin')) {
      db.calls.spin += 1;
      const again = db.spun === p.p_day;
      db.spun = p.p_day;
      return json(body(p.p_day, again));
    }
    if (url.pathname.endsWith('lb_wheel_claim')) {
      db.calls.claim += 1;
      db.claimed = true;
      return json({ ok: true });
    }
    return route.fallback();
  });
  await page.addInitScript(({ secret, id, gems }) => {
    if (sessionStorage.getItem('wh.seeded')) return;
    sessionStorage.setItem('wh.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Spinner' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 24, f: 0.4, rc: 2, v: 10 }));
    localStorage.setItem('taw.s2.wins', '3200');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: gems, mig: 1 }));
    localStorage.setItem('taw.reveal', 'all');
    for (const k of ['gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier', 'init']) localStorage.setItem(`taw.tut.${k}`, '1');
  }, { secret: SECRET, id: row.id, gems });
  await page.goto('/?portal=1&season2=1');
  await page.locator('.homepage-logo, .hp-m-title').first().waitFor();
  return db;
}
const gemBal = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0);
const noScroll = (page) => page.evaluate(() => ({
  y: document.documentElement.scrollHeight - innerHeight, x: document.documentElement.scrollWidth - innerWidth,
}));

test('menu: the WHEEL takes the top-right slot; NEWS + SETTINGS sit bottom-right; CREDITS lives in SETTINGS', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page);
  const tile = page.locator('.hp-icons [data-nav="wheel"]');
  await expect(tile).toBeVisible();
  await expect(tile.locator('.kb-idot')).toBeVisible(); // today's free spin is waiting
  await expect(page.locator('.hp-icons [data-nav="news"], .hp-icons [data-nav="settings"]')).toHaveCount(0);
  await expect(page.locator('.hp-util [data-nav="news"]')).toBeVisible();
  await expect(page.locator('.hp-util [data-nav="settings"]')).toBeVisible();
  await expect(page.locator('.homepage-credits-link')).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: 'claude/shots-wheel/menu-1366x768.png' });
  await page.locator('.hp-util [data-nav="settings"]').click();
  await page.locator('.sp-credits:visible').click();
  await expect(page.locator('.credits-wrap')).toBeVisible();
});

test('SPIN: one server spin, lands, pays +60 gems once, claims, clears the dot; reopen never pays again', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const db = await boot(page, { gems: 200, slot: 2 });
  await page.locator('[data-nav="wheel"]').click();
  const wheel = page.getByTestId('daily-wheel');
  await expect(wheel.getByTestId('wheel-spin')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: 'claude/shots-wheel/wheel-ready-1366x768.png' });
  await wheel.getByTestId('wheel-spin').click();
  await expect(wheel.getByTestId('wheel-result')).toContainText('+60 GEMS', { timeout: 12000 });
  if (SHOTS) await page.screenshot({ path: 'claude/shots-wheel/wheel-landed-1366x768.png' });
  expect(db.calls.spin).toBe(1);
  await expect.poll(() => db.calls.claim).toBe(1);
  expect(await gemBal(page)).toBe(260);
  // the rotor came to rest on the server's slot (slot 2 → the wheel turned ≈ -90°, inside the slice)
  const rot = await page.locator('.dw-rotor').evaluate((el) => el.style.transform);
  const deg = Number(/rotate\(([-\d.]+)deg\)/.exec(rot)[1]);
  const under = Math.floor((((-deg % 360) + 360 + 22.5) % 360) / 45);
  expect(under).toBe(2);
  await page.locator('.dw-close').click();
  await expect(page.locator('[data-nav="wheel"] .kb-idot')).toHaveCount(0);
  // reopen: today's result, no SPIN, no second payment
  await page.locator('[data-nav="wheel"]').click();
  await expect(wheel.getByTestId('wheel-result')).toContainText('+60 GEMS');
  await expect(wheel.getByTestId('wheel-spin')).toHaveCount(0);
  expect(await gemBal(page)).toBe(260);
  expect(db.calls.spin).toBe(1);
});

test('a LEGENDARY+ ticket pays nothing locally (the server owns it); the ODDS sheet prints 8 rows = 100%', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await boot(page, { gems: 200, slot: 5, streak: 3 });
  await page.locator('[data-nav="wheel"]').click();
  const wheel = page.getByTestId('daily-wheel');
  await wheel.getByTestId('wheel-spin').click();
  await expect(wheel.getByTestId('wheel-result')).toContainText('LEGENDARY+ ROLL', { timeout: 12000 });
  await expect(wheel.getByTestId('wheel-result')).toContainText('GEARS');
  expect(await gemBal(page)).toBe(200);
  expect(await noScroll(page)).toEqual({ x: 0, y: 0 });
  if (SHOTS) await page.screenshot({ path: 'claude/shots-wheel/wheel-jackpot-1280x600.png' });
  await wheel.getByRole('button', { name: 'ODDS' }).click();
  const pcts = await wheel.locator('.dw-odds-p').allTextContents();
  expect(pcts).toHaveLength(8);
  expect(pcts.reduce((a, t) => a + Number(t.replace('%', '')), 0)).toBe(100);
  if (SHOTS) await page.screenshot({ path: 'claude/shots-wheel/wheel-odds-1280x600.png' });
});

test('phone 390x844: SPIN lands and pays (+ the PR shots)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, { gems: 200, slot: 2 });
  await page.locator('[data-nav="wheel"]').click();
  const wheel = page.getByTestId('daily-wheel');
  await expect(wheel.getByTestId('wheel-spin')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: 'claude/shots-wheel/wheel-ready-390x844.png' });
  await wheel.getByTestId('wheel-spin').click();
  await expect(wheel.getByTestId('wheel-result')).toContainText('+60 GEMS', { timeout: 12000 });
  if (SHOTS) { await page.waitForTimeout(500); await page.screenshot({ path: 'claude/shots-wheel/wheel-landed-390x844.png' }); }
  expect(await gemBal(page)).toBe(260);
});

for (const [w, h] of [[1536, 864], [1366, 768], [1280, 600], [390, 844], [360, 640]]) {
  test(`fits ${w}x${h}: menu + open wheel, no scroll, the panel inside the viewport`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    expect(await noScroll(page)).toEqual({ x: 0, y: 0 });
    if (SHOTS) { await page.waitForTimeout(1500); await page.screenshot({ path: `claude/shots-wheel/menu-${w}x${h}.png` }); }
    await page.locator('[data-nav="wheel"]').click();
    const panel = page.locator('.dw');
    await expect(page.getByTestId('wheel-spin')).toBeVisible();
    const b = await panel.boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(h + 0.5);
    expect(b.x + b.width).toBeLessThanOrEqual(w + 0.5);
    expect(await noScroll(page)).toEqual({ x: 0, y: 0 });
    if (SHOTS) await page.screenshot({ path: `claude/shots-wheel/wheel-${w}x${h}.png` });
  });
}
