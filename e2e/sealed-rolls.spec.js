// e2e/sealed-rolls.spec.js — 065 SEALED ROLLS (Andy oct24 "you just totally didnt do the epic+, legendary+ rolls … i
// don't want dice"). The SHOP sells a sealed EPIC+ / LEGENDARY+ ROLL: the tap pays the gems, asks lb_ticket_buy with ONLY
// the secret, the tier and a request id (never a price, a floor or luck), and opens the bought ticket in place — the
// cog-locked vessel rattles, unlocks, blasts open, and the server's pick lands (060 lb_ticket_roll / lb_ticket_claim). A definite no from the
// server (over the gem budget) gives the gems back. SHOTS=1 saves the seeded screenshots to claude/shots-shop-epic/.
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'e9'.repeat(24);
const TID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const WINDOW_MS = 60 * 60 * 1000;
const T = (Math.floor(Date.now() / WINDOW_MS) + 1) * WINDOW_MS + 60_000;
const SHOTS = process.env.SHOTS === '1';

async function boot(page, { gems = 2000, buy = null, serverPrice = 500, pending = null, pick = { mark: 'mk-eclipse', tier: 'legendary', shiny: false } } = {}) {
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
    const reply = buy || { ok: true, ticket: { id: TID, tier: b.p_tier, state: 'owned' }, price: serverPrice, left: 0, ...(pending && b.p_request === pending.req ? { again: true } : {}) };
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
  await page.addInitScript(({ secret, id, gems, pending }) => {
    if (sessionStorage.getItem('sr.seeded')) return;
    if (pending) localStorage.setItem('taw.s2.ticketbuy', JSON.stringify(pending));
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
  }, { secret: SECRET, id: row.id, gems, pending });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'shop').click();
  const shop = page.locator('.sp2');
  await shop.waitFor({ state: 'visible' });
  return { shop, calls };
}
const card = (shop, id) => shop.locator(`.sp2-card:has([data-stock="${id}"])`);
const gemsOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.gems')).bal);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `claude/shots-shop-epic/${name}.png` }); };

// 069: EPIC+ costs 500 and the wallet pays the price the card shows — a pre-069 server still answering price 150 is
// tolerated (desktop run), the 069 server's 500 (phone run) the same: never a broken purchase either way.
for (const vp of [{ w: 1366, h: 768, tag: 'desktop', serverPrice: 150 }, { w: 390, h: 844, tag: 'phone', serverPrice: 500 }]) {
  test(`${vp.tag}: buy a SEALED EPIC+ ROLL for 500 — server-sold, paid once, opens on the server's pick (server price ${vp.serverPrice})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const { shop, calls } = await boot(page, { serverPrice: vp.serverPrice });
    const leg = card(shop, 'epicroll');
    await leg.scrollIntoViewIfNeeded();
    await expect(leg.locator('.sp2-vessel img.va-base')).toHaveAttribute('src', /vessel-epic-base\.webp/); // the painted purple canister
    await expect(leg.locator('.sp2-vessel img.va-cog')).toHaveAttribute('src', /vessel-epic-cog\.webp/);
    await expect(leg.locator('.sp2-big')).toHaveText('EPIC+'); // the card word names the tier (the tiny badge stays blank in the shop)
    await expect(leg.locator('.sp2-price')).toHaveText('500');
    await expect(card(shop, 'legroll')).toHaveCount(0); // 069: LEGENDARY+ is not sold
    await shot(page, `${vp.tag}-1-shop`);
    await leg.click();
    const sealed = page.getByTestId('sealed-roll');
    await expect(sealed).toHaveAttribute('data-phase', 'sealed');
    expect(calls.buy).toHaveLength(1);
    expect(Object.keys(calls.buy[0]).sort()).toEqual(['p_request', 'p_secret', 'p_tier']); // never a price / floor / luck
    expect(calls.buy[0].p_tier).toBe('epic');
    expect(await gemsOf(page)).toBe(2000 - 500);
    await page.waitForTimeout(450);
    await shot(page, `${vp.tag}-2-sealed`);
    await page.getByTestId('sealed-roll-open').click();
    if (SHOTS) { await page.waitForTimeout(1250); await shot(page, `${vp.tag}-2b-opening`); } // mid cog-spin
    await expect(sealed).toHaveAttribute('data-phase', 'open', { timeout: 8000 });
    await expect(sealed).toHaveAttribute('data-tier', 'legendary'); // the server's pick lands (an UPGRADE out of the EPIC+ vessel)
    if (SHOTS) { await page.waitForTimeout(260); await shot(page, `${vp.tag}-2c-burst`); } // glow + shards mid-flight
    await page.waitForTimeout(900);
    await shot(page, `${vp.tag}-3-open`);
    expect(Object.keys(calls.roll[0]).sort()).toEqual(['p_secret', 'p_ticket']);
    await expect.poll(() => calls.claim.length).toBe(1);
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.markRolls')));
    expect(st.marks['mk-eclipse'].n).toBe(1);
    expect(st.sinceLegendary).toBe(20); // pity untouched
    expect(await gemsOf(page), 'opening is free — only the buy cost gems').toBe(1500);
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

// Andy: nothing scrolls unless it is a list, and the new thing must be SEEN — the SEALED ROLL sits in the shop's first view.
for (const [w, h] of [[1366, 768], [1280, 600], [390, 844]]) {
  test(`${w}x${h}: the SEALED EPIC+ ROLL is in the first view of BOOSTS (no scroll), every row full`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const { shop } = await boot(page);
    await expect(card(shop, 'epicroll')).toBeVisible();
    if (SHOTS) { await page.waitForTimeout(700); await shot(page, `${w}x${h}-shop-first-view`); }
    const m = await page.evaluate(() => {
      const g = document.querySelector('.sp2-grid').getBoundingClientRect();
      const box = (id) => document.querySelector(`.sp2-card:has([data-stock="${id}"])`).getBoundingClientRect();
      const bottom = Math.min(innerHeight, g.bottom);
      return ['epicroll'].map((id) => { const r = box(id); return { id, top: r.top, bottom: r.bottom, view: bottom, gTop: g.top }; });
    });
    const fit = await page.evaluate(() => [...document.querySelectorAll('.sp2-cell.is-ticket')].map((c) => { const b = c.querySelector('.sp2-big').getBoundingClientRect(); const k = c.querySelector('.kstc-card').getBoundingClientRect(); const V = c.querySelector('.sp2-vessel').getBoundingClientRect();
      // the PAINTED canister inside the vessel's 512 square (its transparent air trimmed: 16% top, 5% bottom, 17% a side) �
      // on the wide desktop card it stands BESIDE the word (oct28), on the phone above it: either way never on it
      const v = { left: V.left + V.width * 0.17, right: V.right - V.width * 0.17, top: V.top + V.height * 0.16, bottom: V.bottom - V.height * 0.05, height: V.height * 0.79 };
      const sideBySide = v.right <= b.left + 4 || v.left >= b.right - 4;
      return { l: b.left - k.left, r: k.right - b.right, v: v.height, overlap: sideBySide ? 0 : v.bottom - b.top }; }));
    for (const f of fit) {
      expect(f.l, 'the tier word stays inside its card').toBeGreaterThanOrEqual(0);
      expect(f.r).toBeGreaterThanOrEqual(0);
      expect(f.v, 'the canister keeps a readable size').toBeGreaterThanOrEqual(36);
      expect(f.overlap, 'the canister never sits on the tier word').toBeLessThanOrEqual(4);
    }
    for (const r of m) {
      expect(r.top, `${r.id} top`).toBeGreaterThanOrEqual(r.gTop - 1);
      expect(r.bottom, `${r.id} fully on screen`).toBeLessThanOrEqual(r.view + 1);
    }
    // 069: no LEGENDARY+ card, and NO HOLE — every shelf row (the scrolled-to last one too) runs edge to edge
    await expect(card(shop, 'legroll')).toHaveCount(0);
    await expect(card(shop, 'epicroll').locator('.sp2-price')).toHaveText('500');
    const rows = await page.evaluate(() => {
      const g = document.querySelector('.sp2-grid');
      const gl = g.getBoundingClientRect().left;
      const cells = [...g.querySelectorAll(':scope > .sp2-cell')].map((c) => { const r = c.getBoundingClientRect(); return { top: Math.round(r.top), l: r.left - gl, r: r.right - gl }; });
      const by = new Map();
      for (const c of cells) { const k = [...by.keys()].find((t) => Math.abs(t - c.top) < 4) ?? c.top; by.set(k, [...(by.get(k) || []), c]); }
      return [...by.values()].map((row) => ({ l: Math.min(...row.map((c) => c.l)), r: Math.max(...row.map((c) => c.r)) }));
    });
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const r of rows) {
      expect(Math.abs(r.l - rows[0].l), 'every row starts at the same edge').toBeLessThanOrEqual(2);
      expect(Math.abs(r.r - rows[0].r), 'every row is full (no hole)').toBeLessThanOrEqual(2);
    }
    if (SHOTS) {
      await page.evaluate(() => { const g = document.querySelector('.sp2-grid'); g.scrollTop = g.scrollHeight; const s = document.querySelector('.sp2'); s.scrollTop = s.scrollHeight; });
      await page.waitForTimeout(300);
      await shot(page, `${w}x${h}-shop-scrolled-end`);
    }
  });
}

// Andy oct25: tap outside closes — the reveal too, once the card has LANDED (never mid-open: the pick is committed
// first, so nothing can be lost, but it has to be seen). ✕ and Escape follow the same rule.
test('CLOSE: mid-open a tap outside / Escape do nothing; once the card lands, a tap outside closes it', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const { shop, calls } = await boot(page);
  await card(shop, 'epicroll').click();
  const sealed = page.getByTestId('sealed-roll');
  await expect(sealed).toHaveAttribute('data-phase', 'sealed');
  await expect(sealed.getByTestId('sealed-roll-close')).toBeVisible(); // sealed: the ticket just waits in GEARS
  await expect(page.getByTestId('sealed-roll-open')).toBeEnabled();
  await page.getByTestId('sealed-roll-open').click();
  await expect(sealed).toHaveAttribute('data-phase', 'opening');
  await expect(sealed.getByTestId('sealed-roll-close')).toHaveCount(0);
  await page.mouse.click(10, 10);
  await page.keyboard.press('Escape');
  await expect(sealed).toBeVisible();
  await expect(sealed).toHaveAttribute('data-phase', 'open', { timeout: 8000 });
  await expect(sealed.getByTestId('sealed-roll-close')).toBeVisible({ timeout: 4000 }); // = landed
  await expect.poll(() => calls.claim.length).toBe(1);
  await page.mouse.click(10, 10);
  await expect(sealed).toHaveCount(0);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.markRolls')));
  expect(st.marks['mk-eclipse'].n).toBe(1);
});

// 069: a LEGENDARY+ buy PAID before the shop stopped selling it (its answer lost) is still settled with its own request
// id — the server hands back the SAME ticket, nothing is re-charged, and nothing paid is ever stranded.
test('069: a pre-069 paid LEGENDARY+ buy still settles (same request, no new charge) before a new EPIC+ buy', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const pending = { req: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', tier: 'legendary', price: 750 };
  const { shop, calls } = await boot(page, { gems: 1250, pending });
  await card(shop, 'epicroll').click();
  const sealed = page.getByTestId('sealed-roll');
  await expect(sealed).toHaveAttribute('data-phase', 'sealed');
  await expect.poll(() => calls.buy.length).toBeGreaterThanOrEqual(1);
  expect(calls.buy.every((b) => b.p_request === pending.req && b.p_tier === 'legendary'), 'only the old request is asked').toBe(true);
  expect(await gemsOf(page), 'the old buy was already paid; nothing more is charged').toBe(1250);
  expect(await page.evaluate(() => localStorage.getItem('taw.s2.ticketbuy'))).toBeNull();
});

test('069: the server says not_sold → the gems come back', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const { shop, calls } = await boot(page, { buy: { ok: false, reason: 'not_sold' } });
  await card(shop, 'epicroll').click();
  await expect(shop.locator('.sp2-note')).toContainText('NOT IN THE SHOP');
  expect(calls.buy).toHaveLength(1);
  expect(await gemsOf(page)).toBe(2000);
});

// THE PACK OPENING (Andy oct27 "rare addicting feeling"): YOU open it — each tap ratchets the cog a notch (a slow
// tapper is carried by the auto-notch, a fast one is never held back); an UPGRADE tells itself first (the light + the
// scrim turn the pick's colour before any card shows); the card rises FACE-DOWN and waits for your tap to flip.
test('PACK OPENING: taps work the lock, the TELL shows the pick colour first, the card waits face-down for a flip', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const { shop, calls } = await boot(page, { pick: { mark: 'mk-kraken', tier: 'mythic', shiny: false } });
  await card(shop, 'epicroll').click();
  const sealed = page.getByTestId('sealed-roll');
  await expect(page.getByTestId('sealed-roll-open')).toBeEnabled();
  await expect(sealed).toHaveClass(/is-epic/); // the vessel's own violet light
  const t0 = Date.now();
  await page.getByTestId('sealed-roll-open').click();
  await expect(sealed).toHaveAttribute('data-phase', 'opening');
  for (let i = 0; i < 2; i += 1) { await page.waitForTimeout(120); await sealed.locator('.srr-vessel').click(); }
  await expect(sealed).toHaveAttribute('data-phase', 'reveal', { timeout: 6000 });
  const tapped = Date.now() - t0;
  expect(tapped, 'tapping opens it faster than waiting (auto ≈ 3.4 s)').toBeLessThan(2900);
  await expect(sealed).toHaveClass(/is-mythic/); // THE TELL: pink light before the card
  expect(calls.claim.length + calls.roll.length).toBeGreaterThan(0);
  // face-down: the back shows, the face hides, and it WAITS (no flip on its own inside a second)
  const back = sealed.locator('.srr-back');
  await expect(back).toHaveCSS('opacity', '1');
  await page.waitForTimeout(900);
  await expect(sealed).toHaveAttribute('data-phase', 'reveal');
  await page.mouse.click(40, 380); // a tap anywhere flips it
  await expect(sealed).toHaveAttribute('data-phase', 'open', { timeout: 600 });
  await expect(sealed.locator('.srr-stamp')).toHaveText('UPGRADE!');
  await expect(sealed.getByTestId('sealed-roll-close')).toBeVisible({ timeout: 3000 }); // landed
  await expect(back).toHaveCSS('opacity', '0');
});

test('PACK OPENING: nobody is stuck — with no taps the lock winds and the card flips by itself', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const { shop } = await boot(page, { pick: { mark: 'mk-flashpoint', tier: 'epic', shiny: false } });
  await card(shop, 'epicroll').click();
  const sealed = page.getByTestId('sealed-roll');
  await page.getByTestId('sealed-roll-open').click();
  await expect(sealed).toHaveAttribute('data-phase', 'reveal', { timeout: 6000 });
  await expect(sealed).toHaveClass(/is-epic/); // no upgrade: no tell
  await expect(sealed).toHaveAttribute('data-phase', 'open', { timeout: 4000 });
  await expect(sealed.getByTestId('sealed-roll-close')).toBeVisible({ timeout: 3000 });
});

// GIF=1 only: films the pack opening for Andy (CDP screencast frames + timestamps → claude/shots/canister/gif/<id>/;
// claude/canister/gif.py stitches them).
for (const [id, mark, tier] of [['epic', 'mk-flashpoint', 'epic'], ['legendary', 'mk-eclipse', 'legendary'], ['mythic', 'mk-kraken', 'mythic']]) {
  test(`GIF: the pack opening, ${id} pull`, async ({ page, context }) => {
    test.skip(!process.env.GIF, 'films only');
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const { shop } = await boot(page, { pick: { mark, tier, shiny: false } });
    await card(shop, 'epicroll').click();
    await expect(page.getByTestId('sealed-roll-open')).toBeEnabled();
    await page.waitForTimeout(500);
    const dir = `claude/shots/canister/gif/${id}`;
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const cdp = await context.newCDPSession(page);
    const stamps = [];
    let n = 0;
    cdp.on('Page.screencastFrame', async (f) => {
      const name = String(n++).padStart(4, '0');
      fs.writeFileSync(`${dir}/${name}.jpg`, Buffer.from(f.data, 'base64'));
      stamps.push([name, f.metadata.timestamp]);
      try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closed */ }
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, everyNthFrame: 1 });
    await page.waitForTimeout(500);
    const sealed = page.getByTestId('sealed-roll');
    await page.getByTestId('sealed-roll-open').click();
    for (let i = 0; i < 2; i += 1) { await page.waitForTimeout(520); await sealed.locator('.srr-vessel').click(); }
    await expect(sealed).toHaveAttribute('data-phase', 'reveal', { timeout: 6000 });
    await page.waitForTimeout(1300);
    await page.mouse.click(683, 600);
    await page.waitForTimeout(2200);
    await cdp.send('Page.stopScreencast');
    await page.waitForTimeout(200);
    fs.writeFileSync(`${dir}/stamps.json`, JSON.stringify(stamps));
  });
}
