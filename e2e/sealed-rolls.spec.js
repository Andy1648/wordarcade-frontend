// e2e/sealed-rolls.spec.js — 065 SEALED ROLLS (Andy oct24 "you just totally didnt do the epic+, legendary+ rolls … i
// don't want dice"). The SHOP sells a sealed EPIC+ / LEGENDARY+ ROLL: the tap pays the gems, asks lb_ticket_buy with ONLY
// the secret, the tier and a request id (never a price, a floor or luck), and opens the bought ticket in place — the
// cog-locked vessel rattles, unlocks, blasts open, and the server's pick lands (060 lb_ticket_roll / lb_ticket_claim). A definite no from the
// server (over the gem budget) gives the gems back. SHOTS=1 saves the seeded screenshots to claude/shots-canister/.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'e9'.repeat(24);
const TID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const WINDOW_MS = 60 * 60 * 1000;
const T = (Math.floor(Date.now() / WINDOW_MS) + 1) * WINDOW_MS + 60_000;
const SHOTS = process.env.SHOTS === '1';

async function boot(page, { gems = 2000, buy = null, pick = { mark: 'mk-eclipse', tier: 'legendary', shiny: false } } = {}) {
  await page.clock.setFixedTime(T);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-sr', username: 'Sealer', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  await mockBoard(page, [], { caps: true, shared: { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() }, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  const calls = { buy: [], roll: [], claim: [] };
  let bought = null;
  await page.route('**/rpc/lb_tickets', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, tickets: [], streak: null }) }));
  await page.route('**/rpc/lb_ticket_buy', (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    calls.buy.push(b);
    const reply = buy || { ok: true, ticket: { id: TID, tier: b.p_tier, state: 'owned' }, price: b.p_tier === 'legendary' ? 750 : 150, left: 0 };
    bought = b.p_tier;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
  });
  await page.route('**/rpc/lb_ticket_roll', (route) => {
    calls.roll.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ticket: TID, tier: bought, pick }) });
  });
  await page.route('**/rpc/lb_ticket_claim', (route) => {
    calls.claim.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ticket: TID }) });
  });
  await page.addInitScript(({ secret, id, gems }) => {
    if (sessionStorage.getItem('sr.seeded')) return;
    sessionStorage.setItem('sr.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Sealer' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 0, v: 10 }));
    localStorage.setItem('taw.s2.wins', '500');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: gems, mig: 1 }));
    localStorage.setItem('taw.marksRevealed', '1');
    localStorage.setItem('taw.markRolls', JSON.stringify({ v: 3, rolls: 40, sinceEpic: 3, sinceLegendary: 20, everEpic: true, starter: true, marks: {}, milestones: [] }));
  }, { secret: SECRET, id: row.id, gems });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'shop').click();
  const shop = page.locator('.sp2');
  await shop.waitFor({ state: 'visible' });
  return { shop, calls };
}
const card = (shop, id) => shop.locator(`.sp2-card:has([data-stock="${id}"])`);
const gemsOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.gems')).bal);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `claude/shots-canister/${name}.png` }); };

for (const vp of [{ w: 1366, h: 768, tag: 'desktop' }, { w: 390, h: 844, tag: 'phone' }]) {
  test(`${vp.tag}: buy a SEALED LEGENDARY+ ROLL — server-sold, paid once, opens on the server's pick`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const { shop, calls } = await boot(page);
    const leg = card(shop, 'legroll');
    await leg.scrollIntoViewIfNeeded();
    await expect(leg.locator('.sp2-vessel img.va-base')).toHaveAttribute('src', /vessel-legendary-base\.webp/); // the painted gold canister
    await expect(leg.locator('.sp2-vessel img.va-cog')).toHaveAttribute('src', /vessel-legendary-cog\.webp/); // the crowned gold lock
    await expect(leg.locator('.sp2-big')).toHaveText('LEGENDARY+'); // the card word names the tier (the tiny badge stays blank in the shop)
    await expect(leg).toContainText('750');
    await shot(page, `${vp.tag}-1-shop`);
    await leg.click();
    const sealed = page.getByTestId('sealed-roll');
    await expect(sealed).toHaveAttribute('data-phase', 'sealed');
    expect(calls.buy).toHaveLength(1);
    expect(Object.keys(calls.buy[0]).sort()).toEqual(['p_request', 'p_secret', 'p_tier']); // never a price / floor / luck
    expect(calls.buy[0].p_tier).toBe('legendary');
    expect(await gemsOf(page)).toBe(2000 - 750);
    await page.waitForTimeout(450);
    await shot(page, `${vp.tag}-2-sealed`);
    await page.getByTestId('sealed-roll-open').click();
    if (SHOTS) { await page.waitForTimeout(1250); await shot(page, `${vp.tag}-2b-opening`); } // mid cog-spin
    await expect(sealed).toHaveAttribute('data-phase', 'open', { timeout: 8000 });
    await expect(sealed).toHaveAttribute('data-tier', 'legendary');
    if (SHOTS) { await page.waitForTimeout(260); await shot(page, `${vp.tag}-2c-burst`); } // glow + shards mid-flight
    await page.waitForTimeout(900);
    await shot(page, `${vp.tag}-3-open`);
    expect(Object.keys(calls.roll[0]).sort()).toEqual(['p_secret', 'p_ticket']);
    await expect.poll(() => calls.claim.length).toBe(1);
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.markRolls')));
    expect(st.marks['mk-eclipse'].n).toBe(1);
    expect(st.sinceLegendary).toBe(20); // pity untouched
    expect(await gemsOf(page), 'opening is free — only the buy cost gems').toBe(1250);
    await page.getByTestId('sealed-roll-done').click();
    await expect(sealed).toHaveCount(0);
    await expect(leg.locator('.sp2-left')).toHaveText('×0 LEFT'); // the server's stock word
  });
}

test('EPIC+ upgrade: a MYTHIC out of an EPIC+ vessel stamps UPGRADE!', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const { shop } = await boot(page, { pick: { mark: 'mk-kraken', tier: 'mythic', shiny: false } });
  await card(shop, 'epicroll').click();
  await page.getByTestId('sealed-roll-open').click();
  const sealed = page.getByTestId('sealed-roll');
  await expect(sealed).toHaveAttribute('data-phase', 'open', { timeout: 8000 });
  await expect(sealed.locator('.srr-stamp')).toHaveText('UPGRADE!');
  await page.waitForTimeout(900);
  await shot(page, 'desktop-4-epic-upgrade');
});

test('ADVERSARIAL: the server says no (over the gem budget) → the gems come back, no ticket, no popup', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const { shop, calls } = await boot(page, { buy: { ok: false, reason: 'budget', budget: 10, spent: 0 } });
  await card(shop, 'epicroll').click();
  await expect(shop.locator('.sp2-note')).toContainText('PLAY A LITTLE MORE');
  expect(calls.buy).toHaveLength(1);
  expect(await gemsOf(page)).toBe(2000);
  await expect(page.getByTestId('sealed-roll')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('taw.s2.ticketbuy'))).toBeNull();
});

// Andy: nothing scrolls unless it is a list, and the new thing must be SEEN — both SEALED ROLLS sit in the shop's first view.
for (const [w, h] of [[1366, 768], [1280, 600], [390, 844]]) {
  test(`${w}x${h}: both SEALED ROLLS are in the first view of BOOSTS (no scroll)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const { shop } = await boot(page);
    await expect(card(shop, 'legroll')).toBeVisible();
    if (SHOTS) { await page.waitForTimeout(700); await shot(page, `${w}x${h}-shop-first-view`); }
    const m = await page.evaluate(() => {
      const g = document.querySelector('.sp2-grid').getBoundingClientRect();
      const box = (id) => document.querySelector(`.sp2-card:has([data-stock="${id}"])`).getBoundingClientRect();
      const bottom = Math.min(innerHeight, g.bottom);
      return ['epicroll', 'legroll'].map((id) => { const r = box(id); return { id, top: r.top, bottom: r.bottom, view: bottom, gTop: g.top }; });
    });
    const fit = await page.evaluate(() => [...document.querySelectorAll('.sp2-cell.is-ticket')].map((c) => { const b = c.querySelector('.sp2-big').getBoundingClientRect(); const k = c.querySelector('.kstc-card').getBoundingClientRect(); const v = c.querySelector('.sp2-vessel').getBoundingClientRect(); return { l: b.left - k.left, r: k.right - b.right, v: v.height, overlap: v.bottom - b.top }; }));
    for (const f of fit) {
      expect(f.l, 'the tier word stays inside its card').toBeGreaterThanOrEqual(0);
      expect(f.r).toBeGreaterThanOrEqual(0);
      expect(f.v, 'the canister keeps a readable size').toBeGreaterThanOrEqual(46);
      expect(f.overlap, 'the canister never sits on the tier word').toBeLessThanOrEqual(4);
    }
    for (const r of m) {
      expect(r.top, `${r.id} top`).toBeGreaterThanOrEqual(r.gTop - 1);
      expect(r.bottom, `${r.id} fully on screen`).toBeLessThanOrEqual(r.view + 1);
    }
  });
}
