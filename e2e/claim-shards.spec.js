// e2e/claim-shards.spec.js — a CLAIM cracks its button open: the painted cyan crystal blades (fx/shards) burst from it —
// 8 from an achievement tile, 12 from the hero's big CLAIM, 10 from a mastery-road node — finite transform/opacity
// one-shots, on screen, gone at rest, and the gems still fly to the pill. Real motion; the page clock is frozen + seeked.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { isPhoneMenu, navControl } from './support/menu.js';

test.describe.configure({ timeout: 60_000 });
test.use({ reducedMotion: 'no-preference' });

const SHOTS = process.env.SHARD_SHOTS || '';
const SECRET = 'c3'.repeat(24);
const toReach = (lv) => { let s = 0; for (let l = 1; l < lv; l++) s += Math.round(30 + 1.2 * l * l); return s; };

async function open(page, seed) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-claim', username: 'Claimer', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, id, seed }) => {
    if (sessionStorage.getItem('cs.seeded')) return;
    sessionStorage.setItem('cs.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Claimer' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 100 }));
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
  }, { secret: SECRET, id: row.id, seed });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'stats').waitFor({ state: 'visible' });
  await page.locator(isPhoneMenu(page) ? '.hp-m-navbtn.is-ach' : '.homepage-nav-btn.is-ach').click();
  const ach = page.locator('.av3-overlay');
  await ach.waitFor({ state: 'visible' });
  return ach;
}

const state = (page) => page.evaluate(() => {
  const parts = [...document.querySelectorAll('.av3-overlay .gsb-s')];
  const live = (a) => (a.playState === 'running' || a.playState === 'paused') && a.effect && (a.currentTime || 0) >= (a.effect.getTiming().delay || 0);
  const playing = parts.filter((p) => p.getAnimations().some(live));
  return {
    srcs: playing.map((p) => p.getAttribute('src')),
    playing: playing.length,
    inf: parts.some((p) => p.getAnimations().some((a) => a.effect && a.effect.getTiming().iterations === Infinity)),
    boxes: playing.map((p) => { const r = p.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, s: Math.max(r.width, r.height) }; }),
    visible: parts.filter((p) => Number(getComputedStyle(p).opacity) > 0.01).length,
  };
});

// click like a thumb (a real pointer on the button's centre), freeze the clock, seek, check, let it finish
async function claimAndCheck(page, btn, { n, shot, w, h }) {
  await btn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400); // the overlay's entrance has settled
  const b = await btn.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect.poll(async () => (await state(page)).playing, { timeout: 4000, intervals: [20] }).toBeGreaterThan(3);
  await page.evaluate(() => { window.__fz = document.getAnimations().map((a) => { a.pause(); return [a, a.currentTime || 0]; }); });
  let mid = null;
  for (const ms of [80, 200, 380]) {
    await page.evaluate((t) => { for (const [a, t0] of window.__fz) a.currentTime = t0 + t; }, ms);
    if (ms === 200) mid = await state(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/claim-${shot}-${ms}.png` });
  }
  await page.evaluate(() => { for (const [a] of window.__fz) a.play(); });
  expect(mid.playing).toBe(n);
  for (const s of mid.srcs) expect(s).toMatch(/\/fx\/shards\/cyan-[0-3]\.webp$/);
  expect(mid.inf).toBe(false);
  const sizes = mid.boxes.map((x) => x.s).sort((a, c) => a - c);
  expect(sizes[Math.floor(sizes.length / 2)]).toBeGreaterThan(30);
  for (const x of mid.boxes) {
    expect(x.x).toBeGreaterThanOrEqual(0);
    expect(x.x).toBeLessThanOrEqual(w);
    expect(x.y).toBeGreaterThanOrEqual(0);
    expect(x.y).toBeLessThanOrEqual(h);
  }
  await expect.poll(async () => (await state(page)).visible, { timeout: 4000 }).toBe(0);
}

for (const [w, h] of [[1366, 768], [390, 844]]) {
  test(`${w}x${h}: an achievement CLAIM bursts painted blades — 8 from a tile, 12 from the hero`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const ach = await open(page, { 'taw.s2.count': { words: 150, bots: 6, epic: 3, mp: 1, chain: 2, reb: 1, power: 1, marks: ['a'] } });
    await claimAndCheck(page, ach.locator('[data-ach="type"] .av3-claim'), { n: 8, shot: `tile-${w}`, w, h });
    await page.waitForTimeout(1200); // the stamp settles
    const big = ach.locator('.av3-claim--big');
    if (await big.count()) await claimAndCheck(page, big.first(), { n: 12, shot: `hero-${w}`, w, h });
    expect((JSON.parse(await page.evaluate(() => localStorage.getItem('taw.s2.gems')))).bal).toBeGreaterThan(100); // the gems still pay
  });
}

test('1366x768: a mastery-road CLAIM bursts 10 painted blades', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const ach = await open(page, {
    'taw.s2.count': { words: 40, bots: 1 },
    'taw.mastery': { chain: toReach(9) + 40 },
    'taw.s2.road': { chain: [0] },
  });
  await expect(ach.getByTestId('mastery-panel')).toBeVisible();
  const btn = ach.locator('[data-testid^="road-claim-"]').first();
  await claimAndCheck(page, btn, { n: 10, shot: 'road-1366', w: 1366, h: 768 });
});
