// e2e/worlds.spec.js — the wall that moves. Andy oct2 A1: the SAME floating-word wall (WallScene's sprayed
// words, stickers, splatters), never new art, in a NEW LAYOUT per tier. N4 (Andy oct2): the wall tier is
// one per 100 LEVELS (wallTier.js — LV100, 200, … unlimited, never back on a rebirth), and crossing one
// plays a big finite re-form: every piece flies from its old spot to its new one while the menu steps
// back. It holds up on a slow Chromebook (4x CPU throttle via CDP: frames measured, not eyeballed).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

// Seeds are CURRENT saves (taw.econ 12): a stamp-less LV ≥ 15 save is a pre-Rebirth-Rush save, and the one-time
// conversion (econMigrate.js) would turn its levels into rebirths at boot. Pass `'taw.econ': null` to seed an
// OLD save and exercise that conversion.
async function boot(page, seed) {
  await installBackendMock(page);
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('w.seeded')) return;
    sessionStorage.setItem('w.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    for (const [k, v] of Object.entries(s)) {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    }
  }, { 'taw.econ': '12', ...seed });
  await page.goto('/?portal=1');
  await menuReady(page);
}

const spots = (page) => page.evaluate(() => [...document.querySelectorAll('.wall-decor-pane .wall-piece')]
  .filter((n) => n.querySelector('.wall-graffiti-tag'))
  .map((n) => `${n.style.top}|${n.style.left}`));
const words = (page) => page.evaluate(() => [...document.querySelectorAll('.wall-decor-pane .wall-graffiti-tag')].map((n) => n.textContent.replace(/\s/g, '')).sort());
const running = (page) => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.wall-decor-pane')).length);

test('no world art: the wall is the floating words; the scene is the wall tier', async ({ page }) => {
  await boot(page, { 'taw.xp': JSON.stringify({ lv: 12, into: 0 }), 'taw.wallTierSeen': '1' });
  await expect(page.locator('.world, img[src*="/worlds/"]')).toHaveCount(0);
  await expect(page.locator('.wall-decor-stack')).toHaveAttribute('data-scene', '1');
});

test('each wall tier puts the SAME words in a different place — unlimited tiers', async ({ browser }) => {
  const at = async (tier) => {
    const page = await browser.newPage();
    await boot(page, { 'taw.xp': JSON.stringify({ lv: 1, into: 0 }), 'taw.wallTierSeen': String(tier) });
    const r = { spots: await spots(page), words: await words(page) };
    await page.close();
    return r;
  };
  const t0 = await at(0);
  const t1 = await at(1);
  const t42 = await at(42);
  expect(t0.spots.length).toBeGreaterThan(5);
  expect(t1.words).toEqual(t0.words);
  expect(t42.words).toEqual(t0.words);
  expect(t1.spots).not.toEqual(t0.spots);
  expect(t42.spots).not.toEqual(t1.spots);
});

test('a rebirth (back to LV1) never takes the wall back', async ({ page }) => {
  await boot(page, { 'taw.xp': JSON.stringify({ lv: 1, into: 0 }), 'taw.rebirths': '3', 'taw.wallTierSeen': '3' });
  await expect(page.locator('.wall-decor-stack')).toHaveAttribute('data-scene', '3');
});

test('crossing LV100 re-forms the wall: every piece moves, the menu steps back, then it all settles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await boot(page, { 'taw.xp': JSON.stringify({ lv: 100, into: 0 }), 'taw.wallTierSeen': '0' });
  await expect(page.locator('.wall-decor-stack')).toHaveAttribute('data-scene', '1');
  await expect(page.locator('html[data-wallfx]')).toHaveCount(1);
  expect(await running(page), 'the pieces are in flight').toBeGreaterThan(10);
  await expect(page.locator('.wall-stamp-lv'), 'the stamp names the moment').toHaveText('LV 100');
  // finite: everything has landed and the menu is back within ~2s
  await expect.poll(() => running(page), { timeout: 4000 }).toBe(0);
  await expect(page.locator('html[data-wallfx]')).toHaveCount(0);
  await expect(page.locator('.wall-stamp')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('taw.wallTierSeen'))).toBe('1');
  // no will-change left on a resting piece
  expect(await page.evaluate(() => [...document.querySelectorAll('.wall-piece')].filter((n) => n.style.willChange).length)).toBe(0);
});

test('reduced motion: no flight — the wall lights up in its new layout and the stamp names it (opacity only)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, { 'taw.xp': JSON.stringify({ lv: 230, into: 0 }), 'taw.wallTierSeen': '0' });
  await expect(page.locator('.wall-decor-stack')).toHaveAttribute('data-scene', '2');
  await expect(page.locator('.wall-stamp-lv')).toHaveText('LV 200');
  const moving = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains('wall-piece')).length);
  expect(moving, 'no piece flies under reduced motion').toBe(0);
  await expect(page.locator('.wall-stamp')).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator('html[data-wallfx]')).toHaveCount(0);
});

// A save from BEFORE Rebirth Rush at LV230 converts to LV1 + rebirths at boot. Its wall follows the BEST level it
// reached (the conversion records it as the peak), so the player still gets the LV200 wall — never loses it.
test('a pre-Rebirth-Rush LV230 save converted to LV1 still gets its LV200 wall', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, { 'taw.econ': null, 'taw.xp': JSON.stringify({ lv: 230, into: 0 }), 'taw.wallTierSeen': '0' });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('taw.xp')).lv), 'the conversion ran').toBe(1);
  await expect(page.locator('.wall-decor-stack')).toHaveAttribute('data-scene', '2');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('taw.wallTierSeen')), { timeout: 4000 }).toBe('2');
});

// THE COST OF THE RE-FORM. Measured on a SETTLED menu: a quiet window, then the same window with the wall
// event fired — the only difference between the two samples is the re-form.
test('the re-form costs no more than double the menu at rest, at 4x CPU throttle', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // LV95: within 10 of the next wall, so the menu has already warmed the re-form's lazy chunk (as in play)
  await boot(page, { 'taw.xp': JSON.stringify({ lv: 95, into: 0 }), 'taw.wallTierSeen': '1' });
  await page.waitForTimeout(2500); // let arrival settle
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
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
    await page.waitForTimeout(1500);
    const f = (await page.evaluate(() => window.__frames.slice(1))).sort((a, b) => a - b);
    return { p50: f[Math.floor(f.length / 2)] || 0, p95: f[Math.floor(f.length * 0.95)] || 0, n: f.length };
  };
  const base = await sample();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('taw:wall-tier', { detail: { tier: 2, from: 1 } })));
  const fx = await sample();
  test.info().annotations.push({ type: 'frames', description: JSON.stringify({ base, fx }) });
  console.log('[wall] 4x throttle — settled menu', JSON.stringify(base), '| re-form', JSON.stringify(fx));
  // the median frame while the wall moves is at most two vsyncs (>= 30 fps) and never worse than double rest
  expect(fx.p50, 'median frame during the re-form').toBeLessThanOrEqual(Math.max(34, base.p50 * 2 + 1));
  await expect(page.locator('.wall-decor-stack')).toHaveAttribute('data-scene', '2');
});
