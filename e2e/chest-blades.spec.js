// e2e/chest-blades.spec.js — THE DAILY CHEST, painted (nov3): the chest is the PAINTED body + lid (chest-*-v2.webp, never
// the vector pair), every tier STEP-UP tap cracks it with 6 painted blades in the tier's colour (COMMON stays quiet) and
// the final open throws 12 — finite transform/opacity, on screen, gone at rest. Real motion; the clock seeked.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

test.use({ timezoneId: 'UTC', reducedMotion: 'no-preference' });
test.describe.configure({ timeout: 60_000 });
const SHOTS = process.env.SHARD_SHOTS || '';

const SECRET = 'd'.repeat(48);
const NOON = Date.UTC(2026, 9, 9, 12, 0, 0);
const TODAY = '2026-10-09';

async function boot(page, { gems = 100, drop = null, rng = null, open = true } = {}) {
  await page.clock.setFixedTime(NOON);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  if (rng != null) await page.addInitScript((r) => { Math.random = () => r; }, rng);
  const row = { id: 'me-dd', username: 'Dropper', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, id, gems, drop }) => {
    if (sessionStorage.getItem('dd.seeded')) return;
    sessionStorage.setItem('dd.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Dropper' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 0, v: 10 }));
    localStorage.setItem('taw.s2.wins', '0'); // nothing affordable: the dot is the drop's alone
    localStorage.setItem('taw.s2.keytier', '0');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: gems, mig: 1 }));
    // every look already SEEN (v3/shopDots.js): the LOOKS dot stays out, so the UPGRADES dot is the drop's alone
    localStorage.setItem('taw.s2.shopseen.looks', JSON.stringify(['chrome', 'inferno', 'void', 'prism', 'toxic', 'ember', 'frost', 'gold', 'plasma', 'nova', 'eclipse',
      'thock', 'clack', 'cream', 'marble', 'typewriter', 'silent', 'arcade', 'vinyl', 'glass', 'steel', 'bass', 'crystal']));
    if (drop) localStorage.setItem('taw.s2.drop', JSON.stringify(drop));
  }, { secret: SECRET, id: row.id, gems, drop });
  await page.goto('/?portal=1&season2=1');
  if (!open) return null;
  await navControl(page, 'shop').click();
  const shop = page.locator('.sp2');
  await shop.waitFor({ state: 'visible' });
  // Andy oct10: the drop is a BOOSTS shelf item — its popup holds the tap-to-open chest
  await shop.getByTestId('daily-chest-card').click();
  await page.locator('.sp2-pop').waitFor({ state: 'visible' });
  return shop;
}

const blades = (page) => page.evaluate(() => {
  const ps = [...document.querySelectorAll('[data-testid="daily-drop"] .gsb-s')];
  const live = (a) => (a.playState === 'running' || a.playState === 'paused') && a.effect && (a.currentTime || 0) >= (a.effect.getTiming().delay || 0);
  const on = ps.filter((p) => p.getAnimations().some(live));
  return {
    srcs: on.map((p) => p.getAttribute('src')),
    n: on.length,
    inf: ps.some((p) => p.getAnimations().some((a) => a.effect && a.effect.getTiming().iterations === Infinity)),
    pts: on.map((p) => { const r = p.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, Math.max(r.width, r.height)]; }),
    visible: ps.filter((p) => Number(getComputedStyle(p).opacity) > 0.01).length,
  };
});
async function frozen(page, ms, shot) {
  // freeze everything; the BLADES are set to `ms` from their own start (a late poll must not seek past their end)
  await page.evaluate((t) => {
    window.__fz = document.getAnimations().map((a) => { a.pause(); return [a, a.currentTime || 0]; });
    for (const [a] of window.__fz) if (a.effect && a.effect.target && a.effect.target.classList.contains('gsb-s')) a.currentTime = t;
  }, ms);
  const b = await blades(page);
  if (SHOTS && shot) await page.locator('.sp2-pop-in').screenshot({ path: `${SHOTS}/${shot}.png` });
  await page.evaluate(() => { for (const [a] of window.__fz) a.play(); });
  return b;
}

for (const [w, h] of [[1366, 768], [390, 844]]) {
  test(`${w}x${h}: the painted chest climbs to MYTHIC — tier blades on each step-up, 12 pink on the open`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page, { rng: 0.999 });
    const dd = page.getByTestId('daily-drop');
    await expect(dd).toHaveAttribute('data-phase', 'ready');
    expect(await dd.locator('.dd-base').getAttribute('src')).toBe('/art/drop/chest-base-v2.webp');
    expect(await dd.locator('.dd-lid').getAttribute('src')).toBe('/art/drop/chest-lid-v2.webp');
    await page.waitForTimeout(400); // the popup's scale-in has landed
    if (SHOTS) await page.locator('.sp2-pop-in').screenshot({ path: `${SHOTS}/chest-${w}-ready.png` });
    const tap = dd.locator('.dd-tap');
    const sets = ['cyan', 'violet', 'gold'];
    for (let i = 0; i < 3; i += 1) {
      await tap.click();
      await expect.poll(async () => (await blades(page)).n, { timeout: 3000, intervals: [20] }).toBeGreaterThan(2);
      const b = await frozen(page, 200, i === 2 ? `chest-${w}-step-gold` : null);
      expect(b.n).toBe(6);
      for (const s of b.srcs) expect(s).toMatch(new RegExp(`/fx/shards/${sets[i]}-[0-3][.]webp$`));
      await expect.poll(async () => (await blades(page)).visible, { timeout: 3000 }).toBe(0);
    }
    await tap.click(); // the 4th tap: MYTHIC opens
    await expect.poll(async () => (await blades(page)).n, { timeout: 3000, intervals: [20] }).toBeGreaterThan(5);
    const b = await frozen(page, 220, `chest-${w}-open`);
    expect(b.n).toBe(12);
    for (const s of b.srcs) expect(s).toMatch(/\/fx\/shards\/pink-[0-3]\.webp$/);
    expect(b.inf).toBe(false);
    const sizes = b.pts.map((p) => p[2]).sort((a, c) => a - c);
    expect(sizes[Math.floor(sizes.length / 2)]).toBeGreaterThan(30);
    for (const [x, y] of b.pts) {
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(w);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(h);
    }
    await expect.poll(async () => (await blades(page)).visible, { timeout: 4000 }).toBe(0);
    await expect(dd).toHaveAttribute('data-phase', 'claimed');
    await page.waitForTimeout(500);
    if (SHOTS) await page.locator('.sp2-pop-in').screenshot({ path: `${SHOTS}/chest-${w}-claimed.png` });
  });
}
