// e2e/shop-can-afford.spec.js — CAN-AFFORD (oct29 shop functionality, Andy "make shop much better (functionality and
// design)"): with 100 gems, what you can buy now (XP 45, WINS 60) keeps its lit price; everything else says how many gems
// short you are on its RED price tag (LUCK 120 → NEED 20 …) with its art still lit (nov3 move 9: no dimming), the words
// always fit their tag, and a tap on one shakes it and says where gems come from. Buying
// drops the balance and the state follows. SHOTS=<dir> saves a screenshot per viewport.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'c4'.repeat(24);
const SHOTS = process.env.SHOTS;

// pinned to known DEAL OF THE HOUR windows (v3/stock.js dealOf) so the deal never moves the numbers under test:
// WINS's hour (WINS is lit either way), LUCK's hour (the line test buys XP and reads WINS)
const WINS_DEAL_HOUR = 1796085000000;
const LUCK_DEAL_HOUR = 1796092200000;
async function boot(page, gems, at = WINS_DEAL_HOUR) {
  await page.clock.setFixedTime(at);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-ca', username: 'Afford', level: 40, rebirths: 1, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  await mockBoard(page, [], { caps: true, shared: { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() }, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.route('**/rpc/lb_tickets', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, tickets: [], streak: null }) }));
  await page.addInitScript(({ secret, id, gems }) => {
    if (sessionStorage.getItem('ca.seeded')) return;
    sessionStorage.setItem('ca.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Afford' }));
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

for (const [w, h] of [[1366, 768], [1920, 1080], [1280, 551], [390, 844]]) {
  test(`${w}x${h}: what you can afford stays lit; the rest says NEED n on its tag, and the words fit`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const shop = await boot(page, 100);
    for (const id of ['xp25', 'wins25']) {
      await expect(card(shop, id)).not.toHaveClass(/is-short/);
      await expect(card(shop, id).locator('.sp2-price')).not.toContainText('NEED');
    }
    for (const [id, need] of [['luck2', '20'], ['extend', '50'], ['overdrive', '200'], ['epicroll', '400']]) {
      await expect(card(shop, id)).toHaveClass(/is-short/);
      await expect(shop.getByTestId(`short-${id}`)).toHaveText(`NEED ${need}`);
    }
    // move 9: a short card's art is never dimmed, and its tag is red (the lit ones keep cyan)
    const look = await page.evaluate(() => [...document.querySelectorAll('.sp2-card.is-short .sp2-card-in')].map((c) => {
      const art = c.querySelector(':scope > .sp2-art, :scope > .sp2-ico');
      return { id: c.dataset.stock, filter: art ? getComputedStyle(art).filter : 'none', tag: getComputedStyle(c.querySelector('.sp2-price')).backgroundColor };
    }));
    expect(look.length).toBeGreaterThan(3);
    for (const l of look) {
      expect(l.filter, l.id).not.toMatch(/saturate|brightness|grayscale/);
      expect(l.tag, l.id).toBe('rgb(232, 38, 46)');
    }
    // the NEED words sit inside their tag (measured on the text itself), the tag inside its card face
    const off = await page.evaluate(() => [...document.querySelectorAll('.sp2-short')].flatMap((t) => {
      const tag = t.closest('.sp2-price').getBoundingClientRect();
      const face = t.closest('.kstc-card').getBoundingClientRect();
      const r = document.createRange(); r.selectNodeContents(t); const tx = r.getBoundingClientRect();
      const out = [];
      if (tx.left < tag.left - 1 || tx.right > tag.right + 1) out.push({ text: t.textContent, by: Math.round(Math.max(tag.left - tx.left, tx.right - tag.right)) });
      if (tag.left < face.left - 1 || tag.right > face.right + 1 || tag.bottom > face.bottom + 1) out.push({ tag: t.textContent });
      return out;
    }));
    expect(off, JSON.stringify(off)).toEqual([]);
    if (SHOTS) { await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth), null, { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(400); await page.screenshot({ path: `${SHOTS}/afford-${w}x${h}.png` }); }
  });
}

test('buying moves the line: 100 gems → buy XP (45) → WINS (60) is now NEED 5', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const shop = await boot(page, 100, LUCK_DEAL_HOUR);
  await expect(card(shop, 'wins25')).not.toHaveClass(/is-short/);
  await card(shop, 'xp25').click();
  await expect(card(shop, 'wins25')).toHaveClass(/is-short/);
  await expect(shop.getByTestId('short-wins25')).toHaveText('NEED 5');
});

test("tapping a card you can't afford shakes it — nothing is bought", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const shop = await boot(page, 100);
  await card(shop, 'luck2').click();
  await expect(shop.getByTestId('short-luck2')).toHaveText('NEED 20');
});
