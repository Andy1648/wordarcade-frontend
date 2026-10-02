// e2e/worlds.spec.js — STEP 50 (Andy oct2): every border tier is a WORLD behind the menu; crossing a
// tier swishes the new world up with ONE transform, and it holds up on a slow Chromebook (4x CPU
// throttle via CDP: the swish's frames are measured, not eyeballed).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

async function boot(page, seed, { motion = false } = {}) {
  if (motion) await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installBackendMock(page);
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('w.seeded')) return;
    sessionStorage.setItem('w.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  await page.goto('/?portal=1');
  await menuReady(page);
}

test('a fresh L1 menu has no world (the bare wall)', async ({ page }) => {
  await boot(page, {});
  await expect(page.locator('.world')).toHaveCount(0);
});

test('LV 10 is the first world, ROOFTOPS', async ({ page }) => {
  await boot(page, { 'taw.xp': JSON.stringify({ lv: 12, into: 0 }), 'taw.menuTierSeen': '1' });
  await expect(page.locator('.world')).toHaveAttribute('data-world', 'rooftops');
});

test('a rebirth never sends the player back a world', async ({ page }) => {
  await boot(page, { 'taw.xp': JSON.stringify({ lv: 1, into: 0 }), 'taw.rebirths': '1', 'taw.menuTierSeen': '9' });
  await expect(page.locator('.world')).toHaveAttribute('data-world', 'jungle'); // tier 9, not tier 1
});

test('the swish is ONE composited transform and costs no more than the menu does without it, at 4x CPU throttle', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 10, into: 0 }));
    window.__frames = [];
    let last = performance.now();
    const tick = (t) => {
      window.__frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const sample = async () => {
    await page.evaluate(() => { window.__frames = []; });
    await page.waitForTimeout(900);
    const f = (await page.evaluate(() => window.__frames.slice(1))).sort((a, b) => a - b);
    return { p50: f[Math.floor(f.length / 2)] || 0, p95: f[Math.floor(f.length * 0.95)] || 0, n: f.length };
  };
  // BASELINE on THIS machine: the same menu arriving with the world already seen (no swish).
  await page.addInitScript(() => { if (!sessionStorage.getItem('w.base')) { sessionStorage.setItem('w.base', '1'); localStorage.setItem('taw.menuTierSeen', '1'); } });
  await page.goto('/?portal=1');
  await menuReady(page);
  const base = await sample();
  // THE SWISH: seen tier 0, now tier 1 → the world swishes in on arrival.
  await page.evaluate(() => localStorage.setItem('taw.menuTierSeen', '0'));
  await page.reload();
  await menuReady(page);
  const stack = page.locator('.world-stack.is-swish');
  await expect(stack).toHaveCount(1);
  const anims = await stack.evaluate((el) => el.getAnimations().length);
  expect(anims, 'exactly one animation on the moving element').toBe(1);
  const swish = await sample();
  test.info().annotations.push({ type: 'frames', description: JSON.stringify({ base, swish }) });
  console.log('[worlds] 4x throttle — no swish', JSON.stringify(base), '| swish', JSON.stringify(swish));
  expect(swish.p50, 'median frame during the swish vs the same menu without it').toBeLessThanOrEqual(Math.max(20, base.p50 * 1.25 + 4));
  await expect(page.locator('.world-stack.is-swish')).toHaveCount(0);
  await expect(page.locator('.world')).toHaveAttribute('data-world', 'rooftops');
});
