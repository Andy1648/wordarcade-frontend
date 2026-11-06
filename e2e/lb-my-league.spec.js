// e2e/lb-my-league.spec.js — MY LEAGUE, the board's third tab: your league's own standings around you, how far to the next league,
// the main board untouched. At the three layouts and the rank extremes: #1 (LEGEND, nothing above), #2 (one place from it),
// #11 (first place in TITAN), #150, #2,000 and #12,000 (BRONZE, no floor). LG_SHOTS=<dir> saves screenshots.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SHOTS = process.env.LG_SHOTS || '';
const SECRET = 'd9'.repeat(24);
const FUTURE = new Date(Date.now() + 86400000).toISOString();
const LONG_NAME = 'WEPFKWPFPOKWQXZ';

async function boot(page, vp, rank) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const rows = Array.from({ length: rank + 30 }, (_, i) => ({
    id: `p${i}`, username: `PLAYER${i}`, level: 900, rebirths: 200000 - i, stars: 0, lifetime_words: 9000, lifetime_letters: 40000, wins_per_word: 10, econ: 13, submitted_at: FUTURE,
  }));
  rows[rank - 1] = { ...rows[rank - 1], id: 'me', username: LONG_NAME };
  await mockBoard(page, [], { caps: true, shared: { rows, secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, season2: true, weekly: true, s2Weekly: true }).catch(() => {});
  await page.route('**/rest/v1/profile_showcase*', (route) => route.fulfill({ json: [] }));
  await page.addInitScript(({ secret, name }) => {
    if (sessionStorage.getItem('lg.seeded')) return;
    sessionStorage.setItem('lg.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: name }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '13');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0.1, rc: 0, v: 10 }));
  }, { secret: SECRET, name: LONG_NAME });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'leaderboard').click();
  const lb = page.locator('.lb2');
  await lb.waitFor({ state: 'visible' });
  return lb;
}

const CASES = [
  [1, 'LEGEND', 'THE TOP OF THE BOARD'],
  [2, 'CHAMPION', '1 PLACE TO LEGEND'],
  [11, 'TITAN', '1 PLACE TO CHAMPION'],
  [150, 'CRYSTAL', '50 PLACES TO MASTER'],
  [2000, 'BRONZE', '400 PLACES TO SILVER'],
  [12000, 'BRONZE', '10.4K PLACES TO SILVER'],
];
const SIZES = [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }];

for (const vp of SIZES) {
  for (const [rank, name, goal] of CASES) {
    test(`${vp.width}x${vp.height} #${rank}: ${name}, "${goal}", your row, nothing overlaps`, async ({ page }) => {
      test.setTimeout(90_000);
      const lb = await boot(page, vp, rank);
      await expect(lb.locator('.lb2-tab[data-tab="league"]')).toContainText(name, { timeout: 20_000 });
      await lb.locator('.lb2-tab[data-tab="league"]').click();
      const card = lb.getByTestId('lb2-league');
      await expect(card).toBeVisible();
      await expect(card.locator('.lb2-lg-name')).toHaveText(name);
      await expect(lb.getByTestId('lb2-league-goal')).toHaveText(goal);
      const me = lb.locator('.lb2-row.is-me');
      await expect(me).toBeVisible();
      if (rank > 1) await expect.poll(() => lb.locator('.lb2-row').count(), { message: 'your league around you, not just you' }).toBeGreaterThan(1);
      await page.waitForTimeout(1200);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/league-${vp.width}-${rank}.png` });

      const g = await page.evaluate(() => {
        const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
        const card2 = document.querySelector('[data-testid="lb2-league"]');
        const small = [...card2.querySelectorAll('span, b')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 13).map((e) => e.className);
        const spill = [...card2.querySelectorAll('span, b, img')].filter((e) => { const a = e.getBoundingClientRect(); const c = card2.getBoundingClientRect(); return a.width > 0 && (a.left < c.left - 1 || a.right > c.right + 1 || a.top < c.top - 1 || a.bottom > c.bottom + 1); }).map((e) => e.className);
        const texts = ['.lb2-lg-name', '.lb2-lg-rank', '.lb2-lg-goal'].map((s) => box(s));
        const rowRanks = [...document.querySelectorAll('.lb2-row')].map((r) => Number(r.dataset.rank));
        return { card: box('[data-testid="lb2-league"]'), list: box('.lb2-list'), climb: box('.lb2-climb'), head: box('.lb2-head'), small, spill, texts, rowRanks, top3: document.querySelectorAll('.lb2-top3').length, sw: document.documentElement.scrollWidth };
      });
      // the title's own letters (its box can be wider) stay clear of the three tabs
      const clash = await page.evaluate(() => {
        const t = document.querySelector('.lb2-title');
        const range = document.createRange();
        range.selectNodeContents(t);
        const a = range.getBoundingClientRect();
        const b = document.querySelector('.lb2-tabs').getBoundingClientRect();
        return { tabs: document.querySelectorAll('.lb2-tab').length, hit: a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5 };
      });
      expect(clash.tabs, 'all three tabs are up').toBe(3);
      expect(clash.hit, 'the title vs the tabs').toBe(false);
      const meets = (a, b) => !!a && !!b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
      expect(g.card.l).toBeGreaterThanOrEqual(0);
      expect(g.card.r).toBeLessThanOrEqual(vp.width);
      expect(g.small, 'nothing tiny').toEqual([]);
      expect(g.spill, 'nothing out of the strip').toEqual([]);
      expect(meets(g.card, g.list), 'strip vs the list').toBe(false);
      expect(g.climb, 'YOUR CLIMB would repeat this panel').toBeNull();
      expect(meets(g.card, g.head), 'strip vs the header').toBe(false);
      expect(meets(g.texts[0], g.texts[1]), 'league name vs your place').toBe(false);
      expect(g.top3, 'no medal rows on this tab').toBe(0);
      expect(g.sw).toBeLessThanOrEqual(vp.width);
      // the row right below you is really visible, never tucked behind your pinned row
      if (rank < 12000) {
        const under = await page.evaluate((r) => {
          const me = document.querySelector('.lb2-row.is-me').getBoundingClientRect();
          const next = document.querySelector(`.lb2-row[data-rank="${r + 1}"]`);
          return next ? next.getBoundingClientRect().top - me.bottom : null;
        }, rank);
        if (under != null) expect(under, 'the next row clears yours').toBeGreaterThanOrEqual(-16);
      }
      // only your league, you in it
      expect(g.rowRanks).toContain(rank);
      const lo = { 1: 1, 2: 2, 11: 11, 150: 101, 2000: 1601, 12000: 1601 }[rank];
      const hi = { 1: 1, 2: 10, 11: 50, 150: 300, 2000: Infinity, 12000: Infinity }[rank];
      for (const n of g.rowRanks) { expect(n).toBeGreaterThanOrEqual(lo); expect(n).toBeLessThanOrEqual(hi); }

      // back to ALL TIME: the main board is as it was
      await lb.locator('.lb2-tab[data-tab="all"]').click();
      await expect(lb.locator('.lb2-top3')).toHaveCount(1);
      await expect(card).toHaveCount(0);
    });
  }
}

test('no place on the board: no MY LEAGUE tab', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installBackendMock(page);
  await mockBoard(page, [], { caps: true, econ: true, boardEcon: true, season2: true }).catch(() => {});
  await page.addInitScript(() => { localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'leaderboard').click();
  const lb = page.locator('.lb2');
  await lb.waitFor({ state: 'visible' });
  await page.waitForTimeout(1500);
  await expect(lb.locator('.lb2-tab[data-tab="all"]')).toBeVisible();
  await expect(lb.locator('.lb2-tab[data-tab="league"]')).toHaveCount(0);
});
