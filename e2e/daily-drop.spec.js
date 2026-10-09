// e2e/daily-drop.spec.js — THE DAILY FREE DROP (season 2; v3/dailyDrop.js + components/DailyDrop.jsx), the top tile
// of the UPGRADES screen:
//   1. a fresh day lights the UPGRADES dot; 4 taps open the chest, it pays the rolled tier (MYTHIC = ×10 OVERDRIVE
//      through the STOCK's own path), the tile shows the reward + NEXT IN to local midnight, the dot clears;
//   2. COMMON pays +15 gems through the gem door (the pill moves), and a claimed day never pays twice;
//   3. the ⓘ shows the printed odds; the tile sits above the shelf tabs and the 6 cards still fit at 1366×657;
//   4. the phone gets the same tile above the tabs, nothing wider than the screen.
// The clock is pinned to 12:00:00 UTC (timezone UTC), so the countdown reads exactly 12:00:00.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl, navDot } from './support/menu.js';

test.use({ timezoneId: 'UTC' });

const SECRET = 'd'.repeat(48);
const NOON = Date.UTC(2026, 9, 9, 12, 0, 0);
const TODAY = '2026-10-09';

async function boot(page, { gems = 100, drop = null, rng = null, open = true } = {}) {
  await page.clock.setFixedTime(NOON);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  if (rng != null) await page.addInitScript((r) => { Math.random = () => r; }, rng);
  const row = { id: 'me-dd', username: 'Dropper', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, id, gems, drop }) => {
    if (sessionStorage.getItem('dd.seeded')) return;
    sessionStorage.setItem('dd.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Dropper' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 0, v: 10 }));
    localStorage.setItem('taw.s2.wins', '0'); // nothing affordable: the dot is the drop's alone
    localStorage.setItem('taw.s2.keytier', '0');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: gems, mig: 1 }));
    if (drop) localStorage.setItem('taw.s2.drop', JSON.stringify(drop));
  }, { secret: SECRET, id: row.id, gems, drop });
  await page.goto('/?portal=1&season2=1');
  if (!open) return null;
  await navControl(page, 'shop').click();
  const shop = page.locator('.sp2');
  await shop.waitFor({ state: 'visible' });
  return shop;
}
const stored = (page) => page.evaluate(() => ({
  drop: JSON.parse(localStorage.getItem('taw.s2.drop') || 'null'),
  gems: (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0,
  boost: JSON.parse(localStorage.getItem('taw.boost') || 'null'),
}));

test('a fresh day: the UPGRADES dot is on; 4 taps climb to MYTHIC and pay ×10 OVERDRIVE · 5 MIN; the dot clears', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await boot(page, { rng: 0.999, open: false });
  await expect(navDot(page, 'shop')).toHaveCount(1);
  await navControl(page, 'shop').click();
  const dd = page.getByTestId('daily-drop');
  await expect(dd).toHaveAttribute('data-phase', 'ready');
  await expect(dd.locator('.dd-stamp')).toHaveText('TAP TO OPEN');
  await expect(dd.locator('.dd-sub')).toHaveText('FREE · ONCE A DAY');
  const tap = dd.locator('.dd-tap');
  const names = [];
  for (let i = 1; i <= 3; i += 1) {
    await tap.click();
    await expect(dd.locator('.dd-stamp')).toHaveText(`TAP ${i}/4`);
    names.push(await dd.locator('.dd-big').textContent());
  }
  expect(names, 'MYTHIC steps up on every tap').toEqual(['RARE', 'EPIC', 'LEGENDARY']);
  await tap.click();
  await expect(dd).toHaveAttribute('data-phase', 'claimed');
  await expect(dd.locator('.dd-big')).toHaveText('MYTHIC');
  await expect(dd.locator('.dd-reward')).toHaveText(/OVERDRIVE\s*×10\s*· 5 MIN/);
  await expect(dd.getByTestId('daily-drop-next')).toHaveText('12:00:00');
  const st = await stored(page);
  expect(st.drop).toEqual({ day: TODAY, claimed: true, tier: 4 });
  expect(st.boost).toEqual({ until: NOON + 5 * 60_000, mult: 10 });
  expect(st.gems, 'MYTHIC pays no gems').toBe(100);
  await page.locator('.sp2-back').click();
  await expect(page.locator('.sp2')).toHaveCount(0);
  await expect(navDot(page, 'shop')).toHaveCount(0);
});

test('COMMON pays +15 gems through the gem door; a claimed day never pays twice', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  const shop = await boot(page, { rng: 0.1 });
  const dd = page.getByTestId('daily-drop');
  for (let i = 0; i < 4; i += 1) await dd.locator('.dd-tap').click();
  await expect(dd.locator('.dd-big')).toHaveText('COMMON');
  await expect(dd.locator('.dd-reward')).toHaveText(/\+15\s*GEMS/);
  await expect(shop.locator('.kp-tone-cyan')).toContainText('115'); // the GEMS pill heard the grant
  await dd.locator('.dd-tap').click({ force: true }); // aria-disabled once claimed — a tap still reaches it
  expect((await stored(page)).gems).toBe(115);
});

test('already claimed today: no dot, the tile shows the reward and NEXT IN; taps pay nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await boot(page, { drop: { day: TODAY, claimed: true, tier: 2 }, open: false });
  await expect(navControl(page, 'shop')).toBeVisible();
  await expect(navDot(page, 'shop')).toHaveCount(0);
  await navControl(page, 'shop').click();
  const dd = page.getByTestId('daily-drop');
  await expect(dd).toHaveAttribute('data-phase', 'claimed');
  await expect(dd.locator('.dd-big')).toHaveText('EPIC');
  await expect(dd.locator('.dd-reward')).toHaveText(/\+60\s*GEMS/);
  await expect(dd.getByTestId('daily-drop-next')).toHaveText('12:00:00');
  await dd.locator('.dd-tap').click({ force: true });
  expect((await stored(page)).gems).toBe(100);
});

test('yesterday\'s claim is a fresh drop today (local midnight reset)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await boot(page, { drop: { day: '2026-10-08', claimed: true, tier: 4 }, open: false });
  await expect(navDot(page, 'shop')).toHaveCount(1);
});

test('the ⓘ shows the printed odds; the tile sits above the tabs and the 6 cards still fit at 1366×657', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  const shop = await boot(page);
  const dd = page.getByTestId('daily-drop');
  await expect(dd.locator('.dd-seg')).toHaveText(['55%', '28%', '12%', '4%', '1%']);
  await dd.locator('.dd-info').click();
  await expect(dd.locator('.dd-odd-name')).toHaveText(['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC']);
  await expect(dd.locator('.dd-odd-p')).toHaveText(['55%', '28%', '12%', '4%', '1%']);
  await expect(dd.locator('.dd-odd .dd-pay-n')).toHaveText(['+15', '+30', '+60', '+150', '×10']);
  await dd.locator('.dd-info').click();
  await expect(dd.locator('.dd-odds')).toHaveCount(0);
  const m = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const g = document.querySelector('.sp2-grid');
    const cards = [...document.querySelectorAll('.sp2-cell')].map((c) => (c.querySelector('.kstc-card') || c).getBoundingClientRect().bottom - c.querySelector('.sp2-price').getBoundingClientRect().bottom);
    return { dd: r('.dd').bottom, tabs: r('.sp2-tabs').top, gridScroll: g.scrollHeight - g.clientHeight, pageScroll: document.querySelector('.sp2').scrollHeight - document.querySelector('.sp2').clientHeight, minGap: Math.min(...cards) };
  });
  expect(m.dd).toBeLessThan(m.tabs);
  expect(m.gridScroll, 'the six cards fit without scrolling').toBeLessThanOrEqual(0);
  expect(m.pageScroll).toBeLessThanOrEqual(0);
  expect(m.minGap, 'every gem price stays inside its card').toBeGreaterThanOrEqual(0);
  await expect(shop.locator('.sp2-card')).toHaveCount(6);
});

test('phone 390×844: the tile above the tabs, nothing wider than the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  const dd = page.getByTestId('daily-drop');
  for (const odds of [false, true]) {
    if (odds) await dd.locator('.dd-info').click();
    const m = await page.evaluate(() => ({
      over: document.querySelector('.sp2').scrollWidth - document.querySelector('.sp2').clientWidth,
      dd: document.querySelector('.dd').getBoundingClientRect().bottom,
      tabs: document.querySelector('.sp2-tabs').getBoundingClientRect().top,
      right: Math.max(...[...document.querySelectorAll('.dd *')].filter((e) => !e.closest('.dd-chest')).map((e) => e.getBoundingClientRect().right)) - document.querySelector('.dd').getBoundingClientRect().right,
    }));
    expect(m.over).toBeLessThanOrEqual(0);
    expect(m.dd).toBeLessThan(m.tabs);
    expect(m.right, `nothing leaves the tile (odds ${odds})`).toBeLessThanOrEqual(0);
  }
});
