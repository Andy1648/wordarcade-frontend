// e2e/lb-rank-digits.spec.js — Andy nov2 "rankings in 1000's overlap - see for yourself on leaderboard". Our audits
// only ever seeded top-100 ranks. YOUR rank is seeded at 1 / 10 / 100 / 1,000 / 9,999 and, at 1366 / 1920 / 390, the
// rank never runs into the face or the name, its number is never clipped, never below 13px (16px on a phone), and the
// profile card's rank stays off the name.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'c7'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
const SHOTS = process.env.LB_SHOTS || '';

async function boot(page, vp, rank) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  // rank - 1 players ahead of you (every one has a rebirth; you have none)
  const rows = Array.from({ length: rank - 1 }, (_, i) => ({
    id: `p${i}`, username: `PLAYER${i}`, level: 900 - (i % 800), rebirths: 1 + Math.max(0, 40 - Math.floor(i / 250)), stars: 0,
    lifetime_words: 9000, lifetime_letters: 40000, wins_per_word: 10, econ: 13, submitted_at: FUTURE,
  }));
  const me = { id: 'me', username: 'WEPFKWPFPOKWQXZ', level: 40, rebirths: 0, stars: 0, lifetime_words: 6000, lifetime_letters: 30000, wins_per_word: 10, econ: 13, submitted_at: FUTURE };
  await mockBoard(page, [], { caps: true, shared: { rows: [...rows, me], secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, weekly: true, s2Weekly: true, rebirth: { delayMs: 0 }, season2: true });
  await page.route('**/rest/v1/profile_showcase*', (route) => route.fulfill({ json: [] }));
  await page.addInitScript(({ secret }) => {
    if (sessionStorage.getItem('lbd.seeded')) return;
    sessionStorage.setItem('lbd.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'WEPFKWPFPOKWQXZ' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0.1, rc: 0, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', '0');
  }, { secret: SECRET });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'leaderboard').click();
  const lb = page.locator('.lb2');
  await lb.waitFor({ state: 'visible' });
  await expect(lb.locator('.lb2-row.is-me, .lb2-col.is-me').first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500); // the finite arrival has settled
  return lb;
}

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  for (const rank of [1, 10, 100, 1000, 9999]) {
    test(`@${vp.width} YOUR rank #${rank} stays in its column`, async ({ page }) => {
      test.setTimeout(90_000);
      const lb = await boot(page, vp, rank);
      if (rank === 1) {
        await expect(lb.locator('.lb2-col--1.is-me')).toBeVisible();
        return; // the podium: no rank column to overflow
      }
      const row = lb.locator('.lb2-row.is-me');
      await expect(row).toHaveAttribute('data-rank', String(rank));
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/rank-${rank}-${vp.width}.png` });
      const m = await row.evaluate((el) => {
        const box = (s) => { const e = el.querySelector(s); return e ? e.getBoundingClientRect() : null; };
        // the rank's DRAWN number (its text), not its cell — a number spilling out of a fixed cell is the bug
        const rk = el.querySelector('.lb2-rk');
        const rg = document.createRange(); rg.selectNodeContents(rk);
        const ink = rk.querySelector('.lb2-seal') ? rk.getBoundingClientRect() : rg.getBoundingClientRect();
        const hit = (a, b) => !!(a && b) && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        return {
          face: hit(ink, box('.lb2-face')), name: hit(ink, box('.lb2-name')), you: hit(ink, box('.lb2-you')),
          px: parseFloat(getComputedStyle(rk).fontSize), seal: !!rk.querySelector('.lb2-seal'),
        };
      });
      expect({ face: m.face, name: m.name, you: m.you }, `#${rank} runs into its row`).toEqual({ face: false, name: false, you: false });
      if (!m.seal) expect(m.px, `#${rank} number size`).toBeGreaterThanOrEqual(vp.width < 1000 ? 16 : 13);
      if (rank === 9999) {
        // the profile card: its rank sits beside the name, never on it
        await row.click();
        const card = page.locator('.pc-head');
        await expect(card).toBeVisible();
        // the SETTLED card: FitText measures after layout, so its first frame can still show the long name at full width
        // (CI's slower runner caught that frame) - poll until it has fitted, and fail if the overlap stays
        await expect.poll(() => card.evaluate((el) => {
          const a = el.querySelector('.pc-rank').getBoundingClientRect(); const b = el.querySelector('.pc-name').getBoundingClientRect();
          return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        }), { message: 'the profile card rank runs into the name', timeout: 3000 }).toBe(false);
      }
    });
  }
}
