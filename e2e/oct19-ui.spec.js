// e2e/oct19-ui.spec.js — Andy's oct19 play-test, the three overlaps + the achievement pop-up (season 2 board mock):
//   1. "Top blank percent is overlapping with how many rebirths you have": TOP n% now rides the PLAYER column head —
//      its box never meets the REBIRTHS column, at 1366×768, 1280×551 and 390×844;
//   2. "overlapping with the MAX IT and then GRANDMASTER symbol with the zero symbol": the achievements hero row's
//      ALMOST label, gear chip and ready count never overlap;
//   3. "the notification dot is behind the card (the second gear and the daily chest)": every menu dot and the daily
//      chest's dot is the TOPMOST thing at its own centre;
//   4. "I want pop-ups for the achievements": a tier that just became claimable is toasted once on the menu (an edge
//      toast — no claim, no pay).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl, isPhoneMenu } from './support/menu.js';

const SIZES = [[1366, 768], [1280, 551], [390, 844]];
const SECRET = 'c9'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
const r = (id, username, o) => ({ id, username, level: 10, rebirths: 0, stars: 0, lifetime_words: 500, lifetime_letters: 2500, wins_per_word: 10, econ: 13, submitted_at: FUTURE, ...o });
const BOARD = Array.from({ length: 30 }, (_, i) => r(`p${i}`, `PLAYER${i}XX`, { rebirths: 30 - i, level: 900 - i }));

async function boot(page, me, extra = {}) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const meRow = r('me', 'NOBUFFCOOKIES', me);
  const shared = { rows: [...BOARD.map((x) => ({ ...x })), meRow], secrets: new Map([[SECRET, 'me']]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, weekly: true, rebirth: { delayMs: 0 }, season2: true });
  // the all-time player count (fetchBoardCount: HEAD … Prefer: count=exact) — 4,000 players
  await page.route(/leaderboard_s2\?select=id$/, (route) => route.fulfill({ status: 200, headers: { 'content-range': '*/4000', 'access-control-expose-headers': 'content-range' }, body: '' }));
  await page.addInitScript(({ secret, me, extra }) => {
    if (sessionStorage.getItem('o19.seeded')) return;
    sessionStorage.setItem('o19.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'NOBUFFCOOKIES' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: me.level, f: 0.1, rc: me.rebirths, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', String(me.rebirths));
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, { secret: SECRET, me, extra });
  await page.goto('/?portal=1&season2=1');
}

const box = (loc) => loc.evaluate((e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; });
const apart = (a, b) => a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t;

/** Every dot under `sel` is the topmost element at its centre (made hit-testable for the probe only). */
async function dotsOnTop(page, sel) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].map((d) => {
    d.style.pointerEvents = 'auto';
    const b = d.getBoundingClientRect();
    const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    d.style.pointerEvents = '';
    const ch = []; for (let e = top; e && ch.length < 5; e = e.parentElement) ch.push(String(e.className).slice(0, 30));
    return { hit: ch.join(' < '), dot: d.className, owner: String(d.parentElement.className).slice(0, 40), onTop: !!top && (top === d || d.contains(top)) };
  }), sel);
}

for (const [w, h] of SIZES) {
  test(`${w}x${h}: TOP n% never meets the REBIRTHS column`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page, { level: 400, rebirths: 12 });
    await navControl(page, 'leaderboard').click();
    const lb = page.locator('.lb2');
    await expect(lb.locator('.lb2-row.is-me')).toBeVisible({ timeout: 10_000 });
    const pct = lb.getByTestId('lb2-pct');
    await expect(pct).toHaveText(/TOP 1%/);
    await expect(lb.locator('.lb2-row.is-me .lb2-pct')).toHaveCount(0); // not in YOUR row any more
    const p = await box(pct);
    const head = await box(lb.locator('.lb2-cols > span').nth(2 + 1)); // # · PLAYER · (move) · REBIRTHS
    expect(p.r, 'the pill ends before the REBIRTHS head').toBeLessThanOrEqual(head.l + 1);
    for (const row of await lb.locator('.lb2-row .lb2-r').all()) expect(apart(p, await box(row))).toBe(true);
  });

  // oct22: the hero row's MAX IT → GEAR chip + ready count went (Andy "overloaded with numbers") — the hero's gear now
  // rings in the LEGENDARIES shelf, and the hero's label / badge / name / count never overlap
  test(`${w}x${h}: the achievements hero (ALMOST · badge · name · count) never overlaps; its gear rings in LEGENDARIES`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page, { level: 400, rebirths: 12 }, { 'taw.s2.count': JSON.stringify({ bots: 9 }) });
    await page.locator(isPhoneMenu(page) ? '.hp-m-navbtn.is-ach' : '.homepage-nav-btn.is-ach').click();
    const hero = page.locator('.av3-hero');
    await expect(hero.locator('.av3-hero-label')).toHaveText('ALMOST');
    await expect(page.locator('.av3-lg-item.is-hero')).toHaveAttribute('data-gear', 'mk-grandmaster');
    const [label, badge, name, nums] = await Promise.all(['.av3-hero-label', '.av3-hero-badge', '.av3-hero-name', '.av3-hero-nums'].map((s) => box(hero.locator(s))));
    expect(apart(label, badge), 'ALMOST vs the badge').toBe(true);
    expect(apart(badge, name), 'the badge vs the name').toBe(true);
    expect(apart(name, nums), 'the name vs the count').toBe(true);
  });

  test(`${w}x${h}: every notification dot paints above its card (2ND GEAR, ROLL, UPGRADES, daily chest)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page, { level: 400, rebirths: 6 }, { 'taw.s2.gems': JSON.stringify({ bal: 5000 }) });
    await navControl(page, 'stats').waitFor({ state: 'visible' });
    await expect(page.locator('.hp-chip-dot').first()).toBeVisible();
    // polled: the menu's arrival / dot-nudge motion can move a dot off its centre for a frame (CI caught one at 697ms);
    // a STACKING bug never clears, a transient does
    let menu = [];
    await expect.poll(async () => {
      menu = await dotsOnTop(page, '.hp-chip-dot, .kb-rdot, .kb-idot');
      return menu.length >= 3 && menu.every((d) => d.onTop);
    }, { timeout: 5000, message: 'every menu dot on top' }).toBe(true);
    await navControl(page, 'shop').click();
    await page.getByTestId('daily-chest-card').waitFor({ state: 'visible' });
    let shop = [];
    await expect.poll(async () => { shop = await dotsOnTop(page, '.sp2-dot'); return shop.length === 1 && shop[0].onTop; }, { timeout: 5000 }).toBe(true);
    expect(shop.length).toBe(1);
    expect(shop[0].onTop, `the daily chest dot is not clipped under its card ${JSON.stringify(shop)}`).toBe(true);
  });
}

test('a tier that just became claimable pops a READY TO CLAIM toast on the menu — once', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  // achShown present (not the first look) and BEAT BOTS I (10) reached → one toast
  await boot(page, { level: 40, rebirths: 1 }, { 'taw.s2.count': JSON.stringify({ bots: 10 }), 'taw.s2.achShown': '{}' });
  const toast = page.locator('.ket-card');
  await expect(toast).toHaveCount(1, { timeout: 5000 });
  await expect(toast).toContainText('READY TO CLAIM');
  await expect(toast).toContainText('BEAT BOTS');
  await expect(toast.locator('.ket-code')).toHaveText('I');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.achShown')))).toEqual({ bots: 1 });
  // nothing was paid or claimed by the toast
  expect(await page.evaluate(() => localStorage.getItem('taw.s2.ach'))).toBeNull();
});
