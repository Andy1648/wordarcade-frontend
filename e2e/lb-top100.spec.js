// e2e/lb-top100.spec.js — the TOP 100 board with descriptions (Andy oct28: "extend to top 100" + bios for the top
// accounts), held to the UI checklist (oct28): at 1366 / 1920 / 390, ZERO overlaps between the podium's name, bio,
// plate and numbers or between list rows, the bios are readable (>= 16px), and the board really goes to #100.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SHOTS = process.env.LB_SHOTS || '';
const SECRET = 'b8'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
const NAMES = ['yaoguangzai', 'NOVAKID', 'glyphqueen', 'TURBOTYPER', 'bonkmaster', 'sleepyfox', 'QWERTYGOD', 'mint_chip', 'DRIFTKING', 'lexi'];
const BIOS = ['too good', 'grinding since day one', 'no keyboard no problem', 'chromebook warrior', 'i type with my elbows', 'gg ez', 'rebirth addict', 'top 10 or bust', 'spelling bee dropout', 'hi mom'];
const ROWS = Array.from({ length: 120 }, (_, i) => ({
  id: `p${i}`, username: i < 10 ? NAMES[i] : `PLAYER${String(i).padStart(3, '0')}`, level: 900 - i * 7, rebirths: Math.max(0, 40 - Math.floor(i / 3)),
  stars: i < 5 ? 5 - i : 0, lifetime_words: 9000 - i * 50, lifetime_letters: 40000, wins_per_word: 10, econ: 13, submitted_at: FUTURE,
}));

async function boot(page, vp, me) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const meRow = { id: 'me', username: 'NOBUFF', stars: 0, lifetime_words: 6000, lifetime_letters: 30000, wins_per_word: 10, econ: 13, submitted_at: FUTURE, ...me };
  await mockBoard(page, [], { caps: true, shared: { rows: [...ROWS, meRow], secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, weekly: true, rebirth: { delayMs: 0 }, season2: true });
  await page.route('**/rest/v1/profile_showcase*', (route) => {
    const url = decodeURIComponent(route.request().url());
    const ids = ((url.match(/in\.\(([^)]*)\)/) || [])[1] || (url.match(/profile_id=eq\.([^&]+)/) || [])[1] || '').split(',').filter(Boolean);
    route.fulfill({ json: ids.map((id) => ({ profile_id: id, hero: null, bio: BIOS[Number(id.slice(1))] || null })) });
  });
  await page.addInitScript(({ secret, me }) => {
    if (sessionStorage.getItem('lb2.seeded')) return;
    sessionStorage.setItem('lb2.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'NOBUFF' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: me.level, f: 0.1, rc: me.rebirths, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', String(me.rebirths));
  }, { secret: SECRET, me: meRow });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'leaderboard').waitFor({ state: 'visible' });
  await navControl(page, 'leaderboard').click();
  const lb = page.locator('.lb2');
  await lb.waitFor({ state: 'visible' });
  await expect(lb.locator('.lb2-pod-bio')).toHaveCount(3, { timeout: 10_000 });
  await page.waitForTimeout(3000); // the finite arrival (podium rise, row pulses, the climb) has settled
  return lb;
}

/** Every pair of boxes in `groups` (each a list of rects) that overlaps by more than `tol` px. */
function overlapsIn(page) {
  return page.evaluate(() => {
    const out = [];
    const box = (el) => el.getBoundingClientRect();
    const hit = (a, b, tol = 1) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > tol && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > tol;
    // the podium: name / bio / plate / numbers inside each column never touch
    for (const col of document.querySelectorAll('.lb2-col')) {
      const parts = ['.lb2-pod-name', '.lb2-pod-bio', '.lb2-pod-plate', '.lb2-pod-stats'].map((s) => [s, col.querySelector(s)]).filter(([, e]) => e);
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        if (hit(box(parts[i][1]), box(parts[j][1]))) out.push(`podium ${col.dataset.place}: ${parts[i][0]} x ${parts[j][0]}`);
      }
    }
    // the list: the rows in view never overlap one another, and a bio never runs into its name
    const sc = document.querySelector('.lb2-scroll').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.lb2-row')].filter((r) => { const b = box(r); return b.bottom > sc.top && b.top < sc.bottom; });
    for (let i = 1; i < rows.length; i++) {
      if (hit(box(rows[i - 1]), box(rows[i]), 2)) out.push(`rows #${rows[i - 1].dataset.rank} x #${rows[i].dataset.rank}`);
    }
    for (const r of rows) {
      const name = r.querySelector('.lb2-name-line');
      const bio = r.querySelector('.lb2-bio');
      if (name && bio && hit(box(name), box(bio))) out.push(`row #${r.dataset.rank}: name x bio`);
    }
    return out;
  });
}

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`TOP 100 + bios @ ${vp.width}: no overlaps, readable bios, the board reaches #100`, async ({ page }) => {
    // YOU at #7: the list opens on the TOP 10 rows (4-10 carry their bios)
    const lb = await boot(page, vp, { level: 860, rebirths: 38 });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/lb-top-${vp.width}.png` });
    expect(await overlapsIn(page)).toEqual([]);
    const bios = lb.locator('.lb2-bio');
    expect(await bios.count(), 'rows 4-10 (minus your own) carry a bio').toBeGreaterThanOrEqual(5);
    for (const sel of ['.lb2-bio', '.lb2-pod-bio']) {
      const px = await lb.locator(sel).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(px, `${sel} is readable`).toBeGreaterThanOrEqual(16);
    }
    // the board is a TOP 100: the last list row is #100
    expect(await lb.locator('.lb2-row').last().getAttribute('data-rank')).toBe('100');
  });

  test(`TOP 100 @ ${vp.width}: a #61 player chases the player above (not just "TO TOP 50"), no overlaps`, async ({ page }) => {
    const lb = await boot(page, vp, { level: 500, rebirths: 20 });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/lb-61-${vp.width}.png` });
    expect(await overlapsIn(page)).toEqual([]);
    await expect(lb.locator('.lb2-row.is-me')).toHaveAttribute('data-rank', '61');
    await expect(lb.locator('.lb2-row.is-me .lb2-chase')).toContainText('PASS');
    await expect(lb.locator('.lb2-row.is-rival')).toHaveAttribute('data-rank', '60');
  });
}
