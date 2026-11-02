// e2e/shop-deal.spec.js — DEAL OF THE HOUR (oct29 shop functionality): each hourly window ONE boost card wears the painted
// DEAL ribbon, its tag shows the deal price (−30%) with the shelf price struck beside it, and buying charges exactly that.
// The ribbon hangs WHOLE off the card's top-right corner (outside the face, like the EPIC gem on the other corner): inside
// the shelf and the screen, off every neighbouring card, its "−30%" clear of the name, the ×N LEFT sticker, the price and
// the art; the struck price sits inside its tag — including OVERDRIVE's hour (gem + ribbon on one card). Times are pinned to known deal hours
// (v3/stock.js dealOf — the window index alone picks it). SHOTS=<dir> saves a screenshot per case.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'd7'.repeat(24);
const SHOTS = process.env.SHOTS;
// an hour whose deal is each boost (2026-12, 30 min into the hour)
const HOUR = { wins25: 1796085000000, luck2: 1796092200000, overdrive: 1796095800000, xp25: 1796103000000, extend: 1796117400000 };
const BASE = { xp25: 45, wins25: 60, luck2: 120, overdrive: 300, extend: 150 };

async function boot(page, at, gems) {
  await page.clock.setFixedTime(at);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-dl', username: 'Dealer', level: 40, rebirths: 1, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  await mockBoard(page, [], { caps: true, shared: { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() }, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.route('**/rpc/lb_tickets', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, tickets: [], streak: null }) }));
  await page.addInitScript(({ secret, id, gems }) => {
    if (sessionStorage.getItem('dl.seeded')) return;
    sessionStorage.setItem('dl.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Dealer' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 1, v: 10 }));
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: gems, mig: 1 }));
  }, { secret: SECRET, id: row.id, gems });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'shop').click();
  const shop = page.locator('.sp2');
  await shop.waitFor({ state: 'visible' });
  return shop;
}
const card = (shop, id) => shop.locator(`.sp2-card:has([data-stock="${id}"])`);

/** The deal card's pieces that must stay apart + inside the face. */
const dealLayout = (page) => page.evaluate(() => {
  const c = document.querySelector('.sp2-card.is-deal');
  const face = c.querySelector('.kstc-card').getBoundingClientRect();
  const R = (el) => (el ? el.getBoundingClientRect() : null);
  const text = (el) => { if (!el) return null; const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  const tag = R(c.querySelector('.sp2-deal-t'));
  // the art's PAINTED area: its square minus the ~15% transparent air every boost painting carries round it
  const ab = R(c.querySelector('.sp2-card-in > .sp2-art'));
  const art = ab && { left: ab.left + ab.width * 0.15, right: ab.right - ab.width * 0.15, top: ab.top + ab.height * 0.15, bottom: ab.bottom - ab.height * 0.15 };
  const ribbon = R(c.querySelector('.sp2-deal'));
  const grid = document.querySelector('.sp2-grid').getBoundingClientRect();
  const others = [...document.querySelectorAll('.sp2-card .kstc-card')].filter((f) => !c.contains(f)).map((f) => f.getBoundingClientRect());
  const parts = { dealText: tag, name: text(c.querySelector('.sp2-name')), left: R(c.querySelector('.sp2-left')), price: R(c.querySelector('.sp2-price')), was: R(c.querySelector('.sp2-was')) };
  const hit = (a, b) => a && b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const overlaps = [];
  for (const [k, o] of [['name', parts.name], ['left', parts.left], ['price', parts.price], ['art', art]]) if (hit(parts.dealText, o)) overlaps.push(`−30% × ${k}`);
  for (const o of others) if (hit(ribbon, o)) overlaps.push('ribbon × a neighbouring card');
  const was = parts.was;
  const inShelf = ribbon.left >= grid.left - 1 && ribbon.right <= grid.right + 1 && ribbon.top >= grid.top - 1 && ribbon.right <= innerWidth + 1;
  return { overlaps, ribbonInShelf: inShelf, wasInsidePrice: !was || (was.left >= parts.price.left - 1 && was.right <= parts.price.right + 1), face: Math.round(face.width) };
});

for (const [w, h] of [[1366, 768], [1920, 1080], [1280, 551], [390, 844]]) {
  for (const id of ['xp25', 'overdrive']) {
    test(`${w}x${h}: ${id}'s hour — one DEAL card, −30% on its tag, the sash clear of the name / sticker / price`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      const shop = await boot(page, HOUR[id], 5000);
      await expect(shop.locator('.sp2-card.is-deal')).toHaveCount(1);
      await expect(card(shop, id)).toHaveClass(/is-deal/);
      await expect(card(shop, id).getByTestId('deal-ribbon')).toBeVisible();
      await expect(card(shop, id).locator('.sp2-price')).toContainText(String(Math.round(BASE[id] * 0.7)));
      await expect(card(shop, id).getByTestId('deal-was')).toHaveText(String(BASE[id]));
      await expect(card(shop, 'epicroll')).not.toHaveClass(/is-deal/);
      await page.waitForTimeout(400);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/deal-${id}-${w}x${h}.png` });
      const m = await dealLayout(page);
      expect(m.overlaps, JSON.stringify(m)).toEqual([]);
      expect(m.ribbonInShelf, 'the ribbon sits whole inside the shelf (never clipped)').toBe(true);
      expect(m.wasInsidePrice, 'the struck price sits inside its tag').toBe(true);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/deal-${id}-${w}x${h}.png` });
    });
  }
}

test('buying the deal charges the deal price; the next hour the deal moves and the price is back', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const shop = await boot(page, HOUR.luck2, 1000);
  await card(shop, 'luck2').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.gems')).bal)).toBe(1000 - 84); // 120 × 0.7
  // the window after LUCK's: a different deal, LUCK back at 120
  await page.clock.setFixedTime(HOUR.luck2 + 3600000);
  await expect(card(shop, 'luck2')).not.toHaveClass(/is-deal/, { timeout: 5000 });
  await expect(card(shop, 'luck2').locator('.sp2-price')).toContainText('120');
});
