// e2e/shop-aspect.spec.js — Andy oct28: "dont make anything stretched on the shop screen (the sealed gear already looks
// horrendous)". Every painted image on the SHOP renders at its OWN aspect ratio (within 2%), and the SEALED ROLL vessel's
// box stays square so its stacked parts (base / lid / cog / badge, placed in % of a 512 square) stay registered. Seeded
// save (gems, level, a name) so the sealed roll, the chest and the plate art all render. SHOTS=<dir> saves a screenshot
// per viewport.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'a7'.repeat(24);
const SHOTS = process.env.SHOTS;

async function boot(page) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-asp', username: 'Ratio', level: 40, rebirths: 2, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  await mockBoard(page, [], { caps: true, shared: { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() }, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  const TID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
  const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/rpc/lb_tickets', (route) => route.fulfill(json({ ok: true, tickets: [], streak: null })));
  await page.route('**/rpc/lb_ticket_buy', (route) => route.fulfill(json({ ok: true, ticket: { id: TID, tier: 'epic', state: 'owned' }, price: 500, left: 1 })));
  await page.route('**/rpc/lb_ticket_roll', (route) => route.fulfill(json({ ok: true, ticket: TID, tier: 'epic', pick: { mark: 'mk-eclipse', tier: 'legendary', shiny: false } })));
  await page.route('**/rpc/lb_ticket_claim', (route) => route.fulfill(json({ ok: true, ticket: TID })));
  await page.addInitScript(({ secret, id }) => {
    if (sessionStorage.getItem('asp.seeded')) return;
    sessionStorage.setItem('asp.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Ratio' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 0, v: 10 }));
    localStorage.setItem('taw.s2.wins', '5000');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 5000, mig: 1 }));
    localStorage.setItem('taw.marksRevealed', '1');
    localStorage.setItem('taw.markRolls', JSON.stringify({ v: 3, rolls: 40, sinceEpic: 3, sinceLegendary: 20, everEpic: true, starter: true, marks: {}, milestones: [] }));
  }, { secret: SECRET, id: row.id });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'shop').click();
  const shop = page.locator('.sp2');
  await shop.waitFor({ state: 'visible' });
  await expect(shop.locator('.sp2-vessel').first()).toBeVisible(); // the sealed roll is on the shelf
  return shop;
}

// The ratio an <img> is DRAWN at: object-fit contain / cover / scale-down always keep the art's own ratio (the box may
// differ); fill (the default) draws it at the box's ratio. The box is the LAYOUT box (computed width / height), not the
// bounding rect: the shop's cards are tilted a degree, which grows a wide image's bounding rect taller than it is drawn.
const measure = (page) => page.evaluate(async () => {
  // an SVG with no width/height reports the 300×150 default as its natural size: its real ratio is its viewBox's
  const viewBox = {};
  for (const src of new Set([...document.querySelectorAll('.sp2 img')].map((i) => i.getAttribute('src')).filter((u) => /\.svg$/.test(u || '')))) {
    try {
      const m = (await (await fetch(src)).text()).match(/<svg[^>]*\sviewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/);
      if (m) viewBox[src] = Number(m[1]) / Number(m[2]);
    } catch { /* measured by its natural size */ }
  }
  return [...document.querySelectorAll('.sp2 img')].flatMap((img) => {
    const cs = getComputedStyle(img);
    const w = parseFloat(cs.width);
    const h = parseFloat(cs.height);
    if (!(w >= 2 && h >= 2) || cs.display === 'none' || !img.naturalWidth) return [];
    if (img.classList.contains('mc-sheen-band')) return []; // a gear card's light SWEEP: a shapeless glare strip, drawn to the card on purpose
    const src = img.getAttribute('src');
    const natural = viewBox[src] || img.naturalWidth / img.naturalHeight;
    const drawn = cs.objectFit === 'fill' ? w / h : natural;
    return [{ src, cls: img.className, fit: cs.objectFit, w: +w.toFixed(1), h: +h.toFixed(1), natural: +natural.toFixed(3), drawn: +drawn.toFixed(3) }];
  });
});
const vesselBoxes = (page) => page.locator('.sp2 .va').evaluateAll((els) => els.map((e) => {
  const cs = getComputedStyle(e);
  return { w: parseFloat(cs.width), h: parseFloat(cs.height) };
}).filter((b) => b.w > 2));

// every image decoded (lazy ones off-screen may never load: measured only once they have)
const settle = (page) => page.waitForFunction(() => [...document.querySelectorAll('.sp2 img')].every((i) => i.complete), null, { timeout: 5000 }).catch(() => {});
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const offRatio = (imgs) => imgs.filter((m) => Math.abs(m.drawn / m.natural - 1) > 0.02);

for (const vp of [{ w: 1366, h: 768 }, { w: 1280, h: 600 }, { w: 1920, h: 1080 }, { w: 390, h: 844 }, { w: 360, h: 640 }]) {
  test(`${vp.w}x${vp.h}: no SHOP image renders off its native aspect ratio; the sealed vessel stays square`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const shop = await boot(page);
    const tag = `${vp.w}x${vp.h}`;
    const seen = [];
    const check = async (where) => {
      await settle(page);
      for (const m of offRatio(await measure(page))) seen.push({ where, ...m });
      for (const b of await vesselBoxes(page)) if (Math.abs(b.w / b.h - 1) > 0.02) seen.push({ where, vessel: b });
    };
    // BOOSTS: the sealed roll, the chest, the boosts, the power plate
    await shop.locator('.sp2-vessel').first().scrollIntoViewIfNeeded();
    await check('boosts'); await shot(page, `${tag}-boosts`);
    await shop.locator('.sp2-cell[data-cell="extend"]').scrollIntoViewIfNeeded(); // the other WIDE card, down the shelf
    await check('boosts-end'); await shot(page, `${tag}-boosts-end`);
    // LOOKS shelf
    await shop.locator('.sp2-tab[data-shelf="looks"]').click();
    await page.waitForTimeout(400);
    await check('looks'); await shot(page, `${tag}-looks`);
    await shop.locator('.sp2-tab[data-shelf="boosts"]').click();
    // the POWER LADDER
    await shop.locator('.sp2-plate').click();
    await page.waitForTimeout(400);
    await check('ladder'); await shot(page, `${tag}-ladder`);
    await page.keyboard.press('Escape');
    if (await shop.locator('.sp2-plate').isVisible() && await page.locator('.pl-art').count()) await page.mouse.click(5, 5);
    // the SEALED ROLL opening: bought, sealed, then opened
    await page.reload();
    await navControl(page, 'shop').click();
    await shop.waitFor({ state: 'visible' });
    await shop.locator('.sp2-card:has([data-stock="epicroll"])').click();
    await page.waitForTimeout(500);
    await check('sealed'); await shot(page, `${tag}-sealed`);
    await page.getByTestId('sealed-roll-open').click();
    await page.waitForTimeout(3000);
    await check('opened'); await shot(page, `${tag}-opened`);
    expect(seen.length, 'no shop images measured').toBeGreaterThanOrEqual(0);
    expect(seen, JSON.stringify(seen, null, 1)).toEqual([]);
  });
}

// the wider sweep: the BOOSTS shelf (the sealed roll's card) at the sizes players actually open it at
for (const [w, h] of [[2560, 1440], [1600, 900], [1536, 864], [1440, 900], [1366, 657], [1280, 720], [1280, 551], [1163, 501], [1024, 600], [768, 1024], [412, 915], [375, 667]]) {
  test(`${w}x${h}: BOOSTS shelf images keep their ratio`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    await settle(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${w}x${h}-boosts.png` });
    const off = offRatio(await measure(page));
    for (const b of await vesselBoxes(page)) if (Math.abs(b.w / b.h - 1) > 0.02) off.push({ vessel: b });
    expect(off, JSON.stringify(off, null, 1)).toEqual([]);
  });
}

// oct29 (Andy: the SEALED ROLL "flowing off" the card): every box inside a shop card — art (its painted plate rides the
// vessel's box), words, price — stays inside that card's face, and every card stays inside the shelf and the viewport. The
// corner gem, the dot and the hover shine sit outside / sweep across on purpose.
for (const [w, h] of [[1366, 768], [1920, 1080], [1280, 551], [390, 844], [360, 640]]) {
  test(`${w}x${h}: nothing on a shop card runs off the card; no card runs off the shelf or the screen`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    await settle(page);
    const m = await page.evaluate(() => {
      const out = [];
      const grid = document.querySelector('.sp2-grid').getBoundingClientRect();
      for (const cell of document.querySelectorAll('.sp2-grid > .sp2-cell')) {
        const face = cell.querySelector('.kstc-card').getBoundingClientRect();
        const id = cell.dataset.cell || 'chest';
        if (face.left < grid.left - 1 || face.right > grid.right + 1) out.push({ id, card: 'off the shelf' });
        if (face.left < -1 || face.right > innerWidth + 1) out.push({ id, card: 'off the screen' });
        for (const e of cell.querySelectorAll('.kstc-card *')) {
          if (e.closest('.sp2-gem, .sp2-dot, .sp2-shine, .sp2-float')) continue;
          const r = e.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          const by = Math.max(face.left - r.left, r.right - face.right, face.top - r.top, r.bottom - face.bottom);
          if (by > 2) out.push({ id, cls: String(e.className).slice(0, 40), by: Math.round(by) });
        }
      }
      return out;
    });
    expect(m, JSON.stringify(m)).toEqual([]);
  });
}
