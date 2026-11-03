// e2e/shop-badges.spec.js — overlap audit #2 (nov2, items 4 + 9): the shop's corner badges never sit on words. The ×N LEFT
// sticker, the EPIC gem and the POWER plate's next-form badge stay off every card's name / big number / what line and off
// the FORM heading + POWER line; the header row (tabs + RESTOCK) stays inside the panel; card names are never cut. Text is
// measured on its glyphs (a Range over the text), not on its box. At 1024 (the narrowest desktop), 1280×551, 1366, 1920,
// 390 and 360.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'b9'.repeat(24);
const SHOTS = process.env.SHOTS;

// every DEAL OF THE HOUR window (v3/stock.js dealOf — the same pins as shop-deal.spec.js): the deal card's ribbon + struck
// price change its layout, so an unpinned clock let CI pass or fail by the hour it ran (nov3: EXTEND's hour, 1280x551)
const DEAL_HOURS = { wins25: 1796085000000, luck2: 1796092200000, overdrive: 1796095800000, xp25: 1796103000000, extend: 1796117400000 };

async function boot(page, at) {
  await page.clock.setFixedTime(at);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-bg', username: 'Badges', level: 40, rebirths: 1, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  await mockBoard(page, [], { caps: true, shared: { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() }, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.route('**/rpc/lb_tickets', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, tickets: [], streak: null }) }));
  await page.addInitScript(({ secret, id }) => {
    if (sessionStorage.getItem('bg.seeded')) return;
    sessionStorage.setItem('bg.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Badges' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 1, v: 10 }));
    localStorage.setItem('taw.s2.keytier', '3'); // POWER 3: FORM 2 — the long "FORM 2 · POWER CELL" heading
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 5000, mig: 1 }));
  }, { secret: SECRET, id: row.id });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'shop').click();
  await page.locator('.sp2').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
}

const audit = (page) => page.evaluate(() => {
  const glyphs = (el) => { if (!el || !el.textContent.trim()) return null; const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return b.width ? b : null; };
  const box = (el) => (el ? el.getBoundingClientRect() : null);
  const hit = (a, b) => a && b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  const out = [];
  for (const cell of document.querySelectorAll('.sp2-grid > .sp2-cell')) {
    const id = cell.dataset.cell || 'chest';
    const words = ['.sp2-name', '.sp2-big', '.sp2-what', '.sp2-time'].map((s) => [s, glyphs(cell.querySelector(s))]);
    for (const [badge, b] of [['×N LEFT', box(cell.querySelector('.sp2-left'))], ['gem', box(cell.querySelector('.sp2-gem'))]]) {
      for (const [s, t] of words) if (hit(b, t)) out.push(`${id}: ${badge} on ${s}`);
    }
    // a card's name is never cut (no ellipsis: the glyphs fit the band)
    const name = cell.querySelector('.sp2-name');
    if (name && name.scrollWidth > name.clientWidth + 1) out.push(`${id}: name cut (${name.textContent})`);
  }
  // the POWER panel: the next-form badge off the FORM heading and the POWER line
  const next = box(document.querySelector('.sp2-next'));
  for (const s of ['.sp2-forever', '.sp2-pw']) if (hit(next, glyphs(document.querySelector(s)))) out.push(`next-form badge on ${s}`);
  const panel = box(document.querySelector('.sp2-power'));
  if (next && panel && (next.right > panel.right + 1 || next.left < panel.left - 1)) out.push(`next-form badge leaves the panel by ${Math.round(Math.max(next.right - panel.right, panel.left - next.left))}px`);
  // the shelf header: tabs + RESTOCK inside the stock column and the screen
  const col = box(document.querySelector('.sp2-stock'));
  for (const el of document.querySelectorAll('.sp2-tab, .sp2-timer')) {
    const r = box(el);
    if (r.right > Math.min(col.right, innerWidth) + 1) out.push(`${el.className.split(' ')[0]} runs off by ${Math.round(r.right - Math.min(col.right, innerWidth))}px`);
  }
  return out;
});

for (const [w, h] of [[1024, 768], [1280, 551], [1366, 768], [1920, 1080], [390, 844], [360, 640]]) {
  for (const [deal, at] of Object.entries(DEAL_HOURS)) {
    test(`${w}x${h} · ${deal}'s deal hour: no badge on a card's words, the POWER badge off its heading, the shelf header inside`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await boot(page, at);
      if (w < 1000) await page.setViewportSize({ width: w, height: 3000 }); // the phone page scrolls: measure every card
      await page.waitForTimeout(300);
      const bad = await audit(page);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/badges-${w}x${h}-${deal}.png`, fullPage: w < 1000 });
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }
}
