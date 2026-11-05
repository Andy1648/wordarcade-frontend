// e2e/leagues.spec.js — nov2 (Andy: "im not really feeling the titles … just the rankings — like top x amount are a certain
// rank"): the titles are gone (no TITLE row, no ladder) and your RANK LEAGUE (leagues.js — the band your board place sits in)
// wears their spots: the menu's profile plate, the profile, the board's podium + YOUR CLIMB. At 1366 / 1920 / 390: the league
// shows, nothing overlaps the name, the text stays ≥ 13 px. LEAGUE_SHOT_DIR=<folder> saves a screenshot per surface.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { navControl } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

const SHOTS = process.env.LEAGUE_SHOT_DIR;
const SECRET = 'c9'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
const row = (id, username, o) => ({ id, username, level: 10, rebirths: 0, stars: 0, lifetime_words: 500, lifetime_letters: 2500, wins_per_word: 10, econ: 13, submitted_at: FUTURE, ...o });
// ten rows above you → you are #11: TITAN (#11–50)
const ABOVE = Array.from({ length: 10 }, (_, i) => row(`r${i}`, `RIVAL${i}`, { stars: 10 - i, rebirths: 5 }));

async function boot(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  const shared = { rows: [...ABOVE.map((x) => ({ ...x })), row('me', 'NOBUFF', { rebirths: 3, level: 60 })], secrets: new Map([[SECRET, 'me']]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, weekly: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript((secret) => {
    if (sessionStorage.getItem('lg.seeded')) return;
    sessionStorage.setItem('lg.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'NOBUFF' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.lb.lastRank', '11');
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 60, f: 0.1, rc: 3, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', '3');
  }, SECRET);
  await page.goto('/?portal=1&season2=1');
}

const overlap = (a, b) => a && b && Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;

for (const [w, h] of [[1366, 768], [1920, 1080], [390, 844]]) {
  test(`@${w}: the menu plate + the profile wear your league (no title row, no ladder)`, async ({ page }) => {
    await boot(page, w, h);
    const plate = page.getByTestId('profile-plate').filter({ visible: true }).first();
    await expect(plate.locator('.hp-rankplate-n')).toHaveText('TITAN', { timeout: 15_000 });
    await expect(plate.locator('.hp-rankplate-n')).toHaveAttribute('data-league', 'titan');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/menu-${w}.png` });
    await plate.click();
    const pf = page.getByTestId('profile-popup');
    await pf.waitFor({ state: 'visible' });
    await expect(pf.getByTestId('profile-title')).toHaveCount(0);
    const lg = pf.getByTestId('profile-league');
    await expect(lg).toHaveAttribute('data-league', 'titan');
    await expect(lg.locator('.lg-badge-name')).toHaveText('TITAN');
    await expect(lg.locator('.lg-badge-n')).toHaveText('#11');
    const [name, badge] = await Promise.all([pf.locator('.pf-name').boundingBox(), lg.boundingBox()]);
    expect(overlap(name, badge), 'league badge overlaps the name').toBeFalsy();
    const px = await lg.locator('.lg-badge-name, .lg-badge-n').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
    expect(Math.min(...px)).toBeGreaterThanOrEqual(13);
    const box = await pf.boundingBox();
    expect(badge.x + badge.width, 'badge inside the card').toBeLessThanOrEqual(box.x + box.width + 1);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/profile-${w}.png` });
  });

  test(`@${w}: the board's podium wears LEGEND / CHAMPION; YOUR CLIMB names your league`, async ({ page }) => {
    await boot(page, w, h);
    await navControl(page, 'leaderboard').click();
    const lb = page.locator('.lb2');
    await expect(lb.locator('.lb2-col--1')).toHaveAttribute('data-id', 'r0', { timeout: 10_000 });
    await expect(lb.locator('.lb2-col--1 .lb2-pod-plate')).toHaveAttribute('data-league', 'legend');
    await expect(lb.locator('.lb2-col--2 .lb2-pod-plate')).toHaveAttribute('data-league', 'champion');
    if (w > 480) await expect(lb.getByTestId('lb2-climb-league')).toHaveAttribute('data-league', 'titan');
    // the podium badge never runs over its column's name
    const hits = await lb.locator('.lb2-col').evaluateAll((cols) => cols.filter((c) => {
      const b = c.querySelector('.lb2-pod-plate'); const n = c.querySelector('.lb2-pod-name-t');
      if (!b || !n || !b.offsetParent) return false;
      const x = b.getBoundingClientRect(); const y = n.getBoundingClientRect();
      return Math.min(x.right, y.right) - Math.max(x.left, y.left) > 1 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 1;
    }).length);
    expect(hits, 'podium badge over a name').toBe(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/board-${w}.png` });
  });
}
