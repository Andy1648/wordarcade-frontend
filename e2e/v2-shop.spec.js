// e2e/v2-shop.spec.js — THE v2 SHOP (P3; claude/mockups/v2/Shop.dc.html) behind ?season2=1, with the season-2 board
// mock. Wins buy only POWER (hold to buy, 1 s, one per hold); everything in the STOCK costs GEMS (v3/stock.js):
//   1. POWER with wins: a tap does nothing, a full hold buys P0 → P1 for 300 wins (FINAL 300 × 8^P);
//   2. a gem item: +25% XP for 45 gems, ×5 → ×4 LEFT, the effect is running;
//   3. SOLD OUT: ×10 OVERDRIVE ×2 → two buys → the stamp; a third try charges nothing;
//   4. short on gems / the visual-only FREE EPIC+ ROLL charge nothing;
//   5. the phone gets the same screen.
// Date is pinned 60 s into a 5-minute restock window, so a restock never lands mid-test.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'f'.repeat(48);
const WINDOW_MS = 5 * 60 * 1000;
const T = (Math.floor(Date.now() / WINDOW_MS) + 1) * WINDOW_MS + 60_000;

async function boot(page, { wins = 500, gems = 640, power = 0 } = {}) {
  await page.clock.setFixedTime(T);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-sp2', username: 'Shopper', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, id, wins, gems, power }) => {
    if (sessionStorage.getItem('sp2.seeded')) return;
    sessionStorage.setItem('sp2.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Shopper' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 0, v: 10 }));
    localStorage.setItem('taw.s2.wins', String(wins));
    localStorage.setItem('taw.s2.keytier', String(power));
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: gems }));
  }, { secret: SECRET, id: row.id, wins, gems, power });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'shop').click();
  const shop = page.locator('.sp2');
  await shop.waitFor({ state: 'visible' });
  return shop;
}
const s2 = (page) => page.evaluate(() => ({
  wins: Number(localStorage.getItem('taw.s2.wins')),
  power: Number(localStorage.getItem('taw.s2.keytier') || 0),
  gems: (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0,
  stock: JSON.parse(localStorage.getItem('taw.s2.stock') || 'null'),
  fx: JSON.parse(localStorage.getItem('taw.s2.stockfx') || 'null'),
}));
async function hold(page, loc, ms) {
  const b = await loc.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
const card = (shop, id) => shop.locator(`.sp2-card:has([data-stock="${id}"])`);

test('POWER is bought with WINS on a 1 s hold — a tap does nothing; 300 wins → POWER 1', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  const shop = await boot(page);
  const buy = shop.locator('.sp2-buy .kb');
  await expect(shop.locator('[data-testid="sp2-power"]')).toHaveText('0');
  await expect(buy).toContainText('HOLD TO BUY');
  await expect(buy).toContainText('300');
  await hold(page, buy, 300);
  await page.waitForTimeout(200);
  expect((await s2(page)).power, 'a tap buys nothing').toBe(0);
  await hold(page, buy, 1150);
  await expect(shop.locator('[data-testid="sp2-power"]')).toHaveText('1');
  const st = await s2(page);
  expect(st.power).toBe(1);
  expect(st.wins).toBe(200);
  expect(st.gems, 'POWER never costs gems').toBe(640);
  // the next tier (2,400 wins) is out of reach with 200 → locked
  await expect(buy).toContainText('NEED WINS');
});

test('a STOCK item costs GEMS: +25% XP · 10 MIN for 45, ×5 → ×4 LEFT, the effect runs', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  const shop = await boot(page);
  await expect(shop.locator('.sp2-card')).toHaveCount(5); // ×2 GEM DROPS removed — gems never scale
  await expect(shop.locator('.sp2-price')).toHaveText(['45', '120', '225', '150', 'SOON']);
  await expect(shop.locator('.ktc')).toContainText('4:00'); // pinned 60 s into the window
  const xp = card(shop, 'xp25');
  await expect(xp.locator('.sp2-left')).toHaveText('×5 LEFT');
  await xp.click();
  await expect(xp.locator('.sp2-left')).toHaveText('×4 LEFT');
  const st = await s2(page);
  expect(st.gems).toBe(595);
  expect(st.wins, 'the STOCK never costs wins').toBe(500);
  expect(st.fx.xp - T, '10 minutes of +25% XP').toBe(10 * 60 * 1000);
});

test('SOLD OUT: two ×10 OVERDRIVEs empty it, the stamp lands, a third try charges nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shop = await boot(page);
  const od = card(shop, 'overdrive');
  await od.click();
  await expect(od.locator('.sp2-left')).toHaveText('×1 LEFT');
  await od.click();
  await expect(od.locator('.sp2-left')).toHaveText('×0 LEFT');
  await expect(od.locator('.kst[aria-label="SOLD OUT"] .kst-sold-band')).toBeVisible();
  expect((await s2(page)).gems).toBe(640 - 450);
  await od.click();
  await expect(shop.locator('.sp2-note')).toContainText('SOLD OUT');
  expect((await s2(page)).gems, 'a sold-out card charges nothing').toBe(190);
  const boost = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.boost') || 'null'));
  expect(boost.mult, 'OVERDRIVE runs as a ×10 boost').toBe(10);
});

test('short on gems, and the visual-only FREE EPIC+ ROLL: nothing charged, nothing taken', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  const shop = await boot(page, { gems: 100 });
  const luck = card(shop, 'luck2');
  await luck.click();
  await expect(shop.locator('.kp-tone-cyan .kp-need')).toContainText('NEED 20 MORE'); // the GEMS pill says the gap
  await expect(luck.locator('.sp2-left')).toHaveText('×3 LEFT');
  await card(shop, 'epicroll').click();
  await expect(shop.locator('.sp2-note')).toContainText('COMES WITH THE ROLL SCREEN');
  const st = await s2(page);
  expect(st.gems).toBe(100);
  expect(st.stock).toBeNull();
});

test('phone 390×844: the same shop; POWER hold and a gem buy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const shop = await boot(page);
  const overflow = await page.evaluate(() => document.querySelector('.sp2').scrollWidth - document.querySelector('.sp2').clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await hold(page, shop.locator('.sp2-buy .kb'), 1150);
  await expect(shop.locator('[data-testid="sp2-power"]')).toHaveText('1');
  await card(shop, 'xp25').click();
  await expect.poll(async () => (await s2(page)).gems).toBe(595);
  await shop.locator('.sp2-back').click();
  await expect(shop).toHaveCount(0);
});
