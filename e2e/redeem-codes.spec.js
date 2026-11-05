// redeem-codes.spec.js — STEP 61. The CODES row against a mocked lb_redeem (supabase/migrations/007_redeem_codes.sql): a
// good code pays once, a second try says already-redeemed, a wrong code says so, and a DB without 007 says codes are not
// switched on — never a crash. Andy nov4 "move codes to settings": the row lives in SETTINGS (season 2 — what visitors
// get) and nowhere else; the first test below pins that, its fit at every size included.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

async function boot(page, { live = true, level = 20, query = '' } = {}) {
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
      GEMRAIN: { code: 'GEMRAIN', wins: 0, label: 'GEM RAIN', kind: 'gems', per_level: false, boost_mult: 3, boost_min: 10, gems: 150 }, // 030
      OVERDRIVE: { code: 'OVERDRIVE', wins: 0, label: 'OVERDRIVE', kind: 'overdrive', per_level: false, boost_mult: 10, boost_min: 5, gems: 0 }, // 030
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
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: level, f: 0, rc: 0, v: 10 }));
    localStorage.setItem('taw.econ', '12'); // already on Rebirth Rush: econ 12 (this spec is not about the one-time conversion)
    localStorage.setItem('taw.s2.wins', '1000');
    for (const k of ['gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier', 'init']) localStorage.setItem(`taw.tut.${k}`, '1');
    localStorage.setItem('taw.claims', '[]');
  }, level);
  await page.goto(`/?portal=1&season2=1${query}`);
  await menuReady(page);
}
const wins = (page) => page.evaluate(() => Number(localStorage.getItem('taw.s2.wins') || 0));
const openSettings = async (page) => {
  await page.locator('[data-nav="settings"]:visible').first().click();
  await page.locator('.sp-sheet').waitFor({ state: 'visible' });
};
async function redeem(page, code) {
  await page.locator('.sp-codes-input').fill(code);
  await page.locator('.sp-codes-btn').click();
  return page.locator('.sp-codes-msg');
}
const SHOTS = process.env.SHOTS_DIR || null;

// Andy nov4 "move codes to settings": one place only. At every size: the row is on screen in SETTINGS with full targets
// and 16 px type, nothing overlaps, the sheet never scrolls (360x640 with SIGN IN WITH GOOGLE too — even with an answer
// line up); the shop has no CODES shelf and no redeem box.
for (const [w, h, query] of [[1920, 1080, ''], [1366, 768, ''], [1280, 551, ''], [390, 844, ''], [360, 640, ''], [390, 844, '&google=1'], [360, 640, '&google=1']]) {
  test(`CODES opens from SETTINGS and the shop's entry is gone @${w}x${h}${query}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page, { query });
    await navControl(page, 'shop').click();
    await page.locator('.sp2').waitFor({ state: 'visible' });
    await expect(page.locator('.sp2-tab[data-shelf="codes"]')).toHaveCount(0);
    await expect(page.locator('.sp2-tab')).toHaveCount(2);
    await expect(page.locator('.sp-codes')).toHaveCount(0);
    await page.goto(`/?portal=1&season2=1${query}`); // back on the menu, fresh
    await menuReady(page);

    await openSettings(page);
    const sheet = page.locator('.sp-sheet');
    const fit = () => sheet.evaluate((el) => {
      const vis = (n) => { const cs = getComputedStyle(n); const b = n.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 1 && b.height > 1; };
      const boxes = [...el.querySelectorAll('button, input, [role="switch"]')].filter(vis).map((n) => { const b = n.getBoundingClientRect(); return { k: n.className, l: b.left, t: b.top, r: b.right, b: b.bottom }; });
      const overlaps = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]; const c = boxes[j];
        if (Math.min(a.r, c.r) - Math.max(a.l, c.l) > 1 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 1) overlaps.push(`${a.k} × ${c.k}`);
      }
      const r = el.getBoundingClientRect();
      return { over: el.scrollHeight - el.clientHeight, bottom: r.bottom, overlaps, offSheet: boxes.filter((b) => b.b > r.bottom + 1 || b.t < r.top - 1).map((b) => b.k) };
    });
    const check = async () => {
      const m = await fit();
      expect(m.over, 'the sheet never scrolls').toBeLessThanOrEqual(1);
      expect(m.bottom).toBeLessThanOrEqual(h);
      expect(m.overlaps, 'no control overlaps another').toEqual([]);
      expect(m.offSheet, 'every control inside the sheet').toEqual([]);
    };
    const input = page.locator('.sp-codes-input');
    const btn = page.locator('.sp-codes-btn');
    await expect(input).toBeVisible();
    await expect(btn).toHaveText('REDEEM');
    await expect(sheet.locator('.sp-play .sp-codes')).toHaveCount(1); // a row in GAMEPLAY
    await input.fill('X'); // REDEEM awake, as a player sees it
    for (const loc of [input, btn]) {
      const b = await loc.boundingBox();
      expect(b.height, 'a full 44 px target').toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
    }
    expect(await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), 'no iOS focus zoom').toBeGreaterThanOrEqual(16);
    await input.fill('');
    await check();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-${w}x${h}${query ? '-google' : ''}.png` });
    // the answers: still no scroll, no overlap
    await expect(await redeem(page, 'nope')).toHaveText("THAT CODE DOESN'T EXIST");
    await page.waitForTimeout(350); // the shake is over
    await check();
    await expect(await redeem(page, 'OVERDRIVE')).toHaveText('OVERDRIVE ×15 · 5 MIN — STARTED');
    await page.waitForTimeout(350);
    await check();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-${w}x${h}${query ? '-google' : ''}-redeemed.png` });
    // closing clears the answer: the sheet comes back whole
    await page.locator('.sp-close').click();
    await openSettings(page);
    await expect(page.locator('.sp-codes-msg')).toHaveCount(0);
    await expect(page.getByTestId('sp-reset-open')).toBeVisible();
  });
}

for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`E4: a code pays the moment it is redeemed — once, never twice, never via the inbox @ ${vp.width}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await boot(page);
    await openSettings(page);
    await expect(page.locator('.sp-codes')).toBeVisible();
    await expect(await redeem(page, 'nope')).toHaveText("THAT CODE DOESN'T EXIST");
    const before = await wins(page);
    await expect(await redeem(page, 'gift-2026')).toHaveText('+25K WINS — ADDED');
    await expect.poll(() => wins(page)).toBe(before + 25000);
    const claims = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.claims') || '[]'));
    expect(claims.filter((c) => c.kind === 'code'), 'E4: codes never sit in the inbox').toEqual([]);
    await expect(await redeem(page, 'GIFT-2026')).toHaveText('YOU ALREADY REDEEMED THAT CODE');
    expect(await wins(page), 'never twice').toBe(before + 25000);
  });
}

test('a DB without migration 007 says codes are not switched on', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, { live: false });
  await openSettings(page);
  await expect(await redeem(page, 'GIFT-2026')).toHaveText('CODES AREN’T SWITCHED ON YET');
});

// ---- R10 (migration 010): SCALING + BOOST codes — applied at redeem since E4 ----
test('a PER-LEVEL code scales at redeem: season 2 pays wins × the rebirth multiplier (R2 → 1,000 × 9)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  await page.addInitScript(() => { localStorage.setItem('taw.s2.rebirths', '2'); });
  await boot(page);
  await openSettings(page);
  const before = await wins(page);
  // H2d: the line says what was ADDED (1,000 × 9), not the formula.
  await expect(await redeem(page, 'levelup')).toHaveText(/^\+9,000 WINS — ADDED$/);
  await expect.poll(() => wins(page)).toBe(before + 9000);
});

test('a BOOST code starts ×3 on everything at once; a gold pill counts down on the menu, nothing under 13px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  await boot(page);
  await openSettings(page);
  const before = await wins(page);
  await expect(await redeem(page, 'triple')).toHaveText('BOOST ×3 · 10 MIN — STARTED');
  expect(await wins(page), 'a boost pays nothing by itself').toBe(before);
  await page.locator('.sp-close').click();
  const boost = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.boost') || 'null'));
  expect(boost.mult).toBe(3);
  expect(boost.until - Date.now()).toBeGreaterThan(9 * 60 * 1000);
  // Andy oct8: boost timers live in the BOTTOM-RIGHT dock (frenzy/BoostDock) — a tile per boost: ×N · NAME · WHAT · clock
  const pill = page.locator('.hp-dock--grid .bd-tile.bd-boost1');
  await expect(pill).toBeVisible();
  await expect(pill.locator('.bd-name')).toHaveText('BOOST');
  await expect(pill.locator('.bd-mult')).toHaveText('×3');
  await expect(pill.locator('.bd-what')).toHaveText('XP + WINS');
  await expect(pill.locator('.bd-clock')).toHaveText(/\d:\d\d/);
  const px = await pill.evaluate((el) => Math.min(...[el, ...el.querySelectorAll('*')].map((n) => parseFloat(getComputedStyle(n).fontSize))));
  expect(px).toBeGreaterThanOrEqual(13);
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
  await expect(page.locator('.hp-dock--grid .bd-tile')).toBeVisible();
  await expect(page.locator('.hp-dock--grid .bd-tile.is-ending')).toBeVisible({ timeout: 6000 }); // last 10 s: red
  const over = page.locator('.tover.is-boost');
  await expect(over).toBeVisible({ timeout: 12000 });
  await expect(over).toContainText('BOOST OVER');
  await expect(over).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator('.bd-tile')).toHaveCount(0);
  const infinite = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).length);
  expect(infinite).toBe(0);
});

test('a fresh LV1 profile at 1280x551 shows no boost pill and pays as before', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  await boot(page, { level: 1 });
  await expect(page.locator('.bd-tile')).toHaveCount(0);
  await expect(page.locator('.tover')).toHaveCount(0);
});

// ---- Andy oct10 (migration 030): GEMS + OVERDRIVE codes — applied at redeem ----
test('a GEMS code pays its gems through the gem door; an OVERDRIVE code starts ×15 for its minutes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page);
  await openSettings(page);
  const gems = () => page.evaluate(() => (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0);
  const g0 = await gems();
  await expect(await redeem(page, 'gemrain')).toHaveText('+150 GEMS — ADDED');
  await expect.poll(gems).toBe(g0 + 150);
  await expect(await redeem(page, 'OVERDRIVE')).toHaveText('OVERDRIVE ×15 · 5 MIN — STARTED');
  const boost = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.boost') || 'null'));
  expect(boost && boost.mult).toBe(15); // nov4: OVERDRIVE ×15
  expect(boost.until - Date.now()).toBeGreaterThan(4 * 60_000);
  await expect(await redeem(page, 'GEMRAIN')).toHaveText('YOU ALREADY REDEEMED THAT CODE');
  expect(await gems(), 'never twice').toBe(g0 + 150);
});
