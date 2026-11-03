// e2e/levelup-blades.spec.js — the menu LEVEL N card throws the PAINTED crystal blades (fx/shards): their own pool
// (.menu-xp-blade, never the key pops' .menu-xp-shard), 8–12 of them, finite transform/opacity one-shots that stay on
// screen, read at size, and are gone at rest — season 1 and season 2 (where LEVEL N is the one centre card kept).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

test.describe.configure({ timeout: 60_000 });
test.use({ reducedMotion: 'no-preference' });

const SHOTS = process.env.SHARD_SHOTS || '';

const state = (page) => page.evaluate(() => {
  const parts = [...document.querySelectorAll('.menu-xp-blade')];
  const live = (a) => (a.playState === 'running' || a.playState === 'paused') && a.effect && (a.currentTime || 0) >= (a.effect.getTiming().delay || 0);
  const playing = parts.filter((p) => p.getAnimations().some(live));
  return {
    srcs: playing.map((p) => p.getAttribute('src')),
    playing: playing.length,
    inf: parts.some((p) => p.getAnimations().some((a) => a.effect && a.effect.getTiming().iterations === Infinity)),
    boxes: playing.map((p) => { const r = p.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }),
    visible: parts.filter((p) => Number(getComputedStyle(p).opacity) > 0.01).length,
  };
});

for (const [name, w, h, query, key] of [
  ['s1 1366', 1366, 768, '', 'taw.xp'],
  ['s1 390', 390, 844, '', 'taw.xp'],
  ['s2 1366', 1366, 768, '&season2=1', 'taw.s2.xp'],
]) {
  test(`${name}: a level-up throws 8–12 painted blades, on screen, finite, gone at rest`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.addInitScript((k) => {
      try { localStorage.setItem(k, JSON.stringify({ lv: 9, f: 0.99999, rc: 0, v: 10 })); } catch { /* blocked */ }
    }, key);
    await installBackendMock(page);
    await page.goto(`/?portal=1${query}`);
    await page.locator('.menu-xp-bar').first().waitFor({ state: 'visible' });
    // the sprites load once the menu has settled (MenuXp BLADE_LOAD_MS)
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.menu-xp-blade')].filter((i) => i.getAttribute('src') && i.complete && i.naturalWidth > 0).length), { timeout: 10_000 }).toBe(24);
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true })));
    await expect.poll(async () => (await state(page)).playing, { timeout: 4000, intervals: [20] }).toBeGreaterThan(5);
    await page.evaluate(() => { window.__fz = document.getAnimations().map((a) => { a.pause(); return [a, a.currentTime || 0]; }); });
    let mid = null;
    for (const ms of [80, 200, 380]) {
      await page.evaluate((t) => { for (const [a, t0] of window.__fz) a.currentTime = t0 + t; }, ms);
      if (ms === 200) mid = await state(page);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/levelup-${name.replace(/\s/g, '-')}-${ms}.png` });
    }
    await page.evaluate(() => { for (const [a] of window.__fz) a.play(); });
    expect(mid.playing).toBeGreaterThanOrEqual(8);
    expect(mid.playing).toBeLessThanOrEqual(12);
    for (const s of mid.srcs) expect(s).toMatch(/\/fx\/shards\/(cyan|gold)-[0-3]\.webp$/);
    expect(mid.inf).toBe(false);
    const sizes = mid.boxes.map((b) => Math.max(b.w, b.h)).sort((a, b) => a - b);
    expect(sizes[Math.floor(sizes.length / 2)]).toBeGreaterThan(28);
    for (const b of mid.boxes) { // on screen: a blade's centre never leaves the viewport
      expect(b.x + b.w / 2).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w / 2).toBeLessThanOrEqual(w);
      expect(b.y + b.h / 2).toBeGreaterThanOrEqual(0);
      expect(b.y + b.h / 2).toBeLessThanOrEqual(h);
    }
    await expect.poll(async () => (await state(page)).visible, { timeout: 4000 }).toBe(0);
  });
}
