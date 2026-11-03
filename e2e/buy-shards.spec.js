// e2e/buy-shards.spec.js — the shop's BUY moment: the bought card cracks open from its RIM — 10 painted gold crystal
// blades (fx/shards) start on the card's edge and fly OUT, so no blade ever crosses the card's face (the BOUGHT! stamp, the
// price). Finite transform/opacity, pooled, on screen, gone at rest; the stamp still slams. Real motion, clock seeked.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { navControl } from './support/menu.js';

test.describe.configure({ timeout: 60_000 });
test.use({ reducedMotion: 'no-preference' });

const SHOTS = process.env.SHARD_SHOTS || '';
const T = 1796085000000; // a fixed hour whose DEAL is WINS (shop-buy-moment.spec.js): XP is at its shelf price

async function boot(page, w, h) {
  await page.clock.setFixedTime(T);
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('bs.seeded')) return;
    sessionStorage.setItem('bs.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 1, v: 10 }));
    localStorage.setItem('taw.s2.wins', '5000');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 1000, mig: 1 }));
  });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'shop').click();
  await page.locator('.sp2').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
}

const state = (page, id) => page.evaluate((cid) => {
  const parts = [...document.querySelectorAll('.sp2 .gsb-s')];
  const live = (a) => (a.playState === 'running' || a.playState === 'paused') && a.effect && (a.currentTime || 0) >= (a.effect.getTiming().delay || 0);
  const playing = parts.filter((p) => p.getAnimations().some(live) && Number(getComputedStyle(p).opacity) > 0.05);
  const c = document.querySelector(`[data-cell="${cid}"]`).getBoundingClientRect();
  return {
    srcs: playing.map((p) => p.getAttribute('src')),
    playing: playing.length,
    inf: parts.some((p) => p.getAnimations().some((a) => a.effect && a.effect.getTiming().iterations === Infinity)),
    // a blade's centre inside the card's face (inset 12% — the stamp + price band) = it crossed the face
    onFace: playing.filter((p) => {
      const r = p.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      return x > c.left + c.width * 0.12 && x < c.right - c.width * 0.12 && y > c.top + c.height * 0.12 && y < c.bottom - c.height * 0.12;
    }).length,
    sizes: playing.map((p) => { const r = p.getBoundingClientRect(); return Math.max(r.width, r.height); }).sort((a, b) => a - b),
    visible: parts.filter((p) => Number(getComputedStyle(p).opacity) > 0.01).length,
  };
}, id);

for (const [w, h] of [[1366, 768], [390, 844]]) {
  test(`${w}x${h}: a buy cracks the card open from its rim — 10 gold blades, never over the stamp or price`, async ({ page }) => {
    await boot(page, w, h);
    const cell = page.locator('[data-cell="xp25"]');
    await cell.scrollIntoViewIfNeeded();
    await page.locator('.sp2-card:has([data-stock="xp25"])').click();
    await expect.poll(async () => (await state(page, 'xp25')).playing, { timeout: 4000, intervals: [20] }).toBeGreaterThan(5);
    await page.evaluate(() => { window.__fz = document.getAnimations().map((a) => { a.pause(); return [a, a.currentTime || 0]; }); });
    const frames = [];
    for (const ms of [40, 120, 220, 380]) {
      await page.evaluate((t) => { for (const [a, t0] of window.__fz) a.currentTime = t0 + t; }, ms);
      frames.push(await state(page, 'xp25'));
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/buy-${w}-${ms}.png` });
    }
    await page.evaluate(() => { for (const [a] of window.__fz) a.play(); });
    const mid = frames[2];
    expect(mid.playing).toBe(10);
    for (const s of mid.srcs) expect(s).toMatch(/\/fx\/shards\/gold-[0-3]\.webp$/);
    expect(mid.inf).toBe(false);
    expect(mid.sizes[Math.floor(mid.sizes.length / 2)]).toBeGreaterThan(30);
    for (const f of frames) expect(f.onFace, 'no blade crosses the card face (stamp / price)').toBe(0);
    await expect.poll(async () => (await state(page, 'xp25')).visible, { timeout: 4000 }).toBe(0);
    await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0)).toBeLessThan(1000);
  });
}
