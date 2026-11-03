// e2e/shop-rhythm.spec.js — FIXED SHOP RHYTHM (nov3 design-research move 8): BOOSTS always reads in one order — the FREE
// DAILY chest first (top-left), then the ONE featured tile (the tall SEALED ROLL) beside it, then the boosts — with ONE
// header timer (RESTOCK) for the whole shelf. SHOTS=<dir> saves a screenshot per viewport.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'c7'.repeat(24);
const SHOTS = process.env.SHOTS;

// pinned to known DEAL OF THE HOUR windows (v3/stock.js dealOf) so the deal never moves the numbers under test:
// WINS's hour (WINS is lit either way), LUCK's hour (the line test buys XP and reads WINS)
const WINS_DEAL_HOUR = 1796085000000;
async function boot(page, gems, at = WINS_DEAL_HOUR) {
  await page.clock.setFixedTime(at);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-rh', username: 'Rhythm', level: 40, rebirths: 1, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  await mockBoard(page, [], { caps: true, shared: { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() }, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.route('**/rpc/lb_tickets', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, tickets: [], streak: null }) }));
  await page.addInitScript(({ secret, id, gems }) => {
    if (sessionStorage.getItem('rh.seeded')) return;
    sessionStorage.setItem('rh.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Rhythm' }));
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

const rect = (loc) => loc.evaluate((e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, h: b.height }; });

for (const [w, h] of [[1366, 768], [1920, 1080], [1280, 551], [1100, 700], [390, 844]]) {
  test(`${w}x${h}: FREE chest first, the featured SEALED ROLL next to it, the boosts after, one timer`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const shop = await boot(page, 100);
    const chest = await rect(shop.locator('.sp2-cell.is-chest'));
    const roll = await rect(shop.locator('.sp2-cell.is-ticket'));
    const boosts = await shop.locator('.sp2-cell.is-boost').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top }; }));
    expect(boosts.length).toBeGreaterThan(3);
    // the chest is the first cell: nothing above it, nothing left of it on its row
    // (rows are compared with half a cell of slack: the cards sit a few px off their cells' tops — tilt, sticker room)
    const sameRow = (c) => Math.abs(c.t - chest.t) < chest.h / 2;
    for (const c of [roll, ...boosts]) {
      expect(c.t).toBeGreaterThan(chest.t - chest.h / 2);
      if (sameRow(c)) expect(c.l).toBeGreaterThan(chest.l);
    }
    // the featured roll sits right of the chest on the first row and stands two rows tall
    expect(sameRow(roll)).toBe(true);
    expect(roll.l).toBeGreaterThan(chest.l);
    expect(roll.h).toBeGreaterThan(chest.h * 1.6);
    // every boost reads after the roll: never on the first row left of it
    for (const c of boosts) if (sameRow(c)) expect(c.l).toBeGreaterThan(roll.l);
    // the chest's FREE dot never crowds the roll's rarity gem (they met across the gap before the dot moved)
    const dot = await rect(shop.locator('.sp2-chest .sp2-dot'));
    const gem = await rect(shop.locator('.sp2-cell.is-ticket .sp2-gem'));
    const gapX = Math.max(gem.l - dot.r, dot.l - gem.r), gapY = Math.max(gem.t - dot.b, dot.t - gem.b);
    expect(Math.max(gapX, gapY), JSON.stringify({ dot, gem })).toBeGreaterThan(40);
    // ONE timer on the shelf
    await expect(shop.locator('.ktc:visible')).toHaveCount(1);
    if (SHOTS) { await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth), null, { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(400); await page.screenshot({ path: `${SHOTS}/rhythm-${w}x${h}.png` }); }
  });
}
