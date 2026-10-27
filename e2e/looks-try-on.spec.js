// e2e/looks-try-on.spec.js — LOOKS TRY-ON (Andy oct26 "i want to playtest all the key looks"). In UPGRADES → LOOKS a tap on
// any pop-style card (owned or locked) starts a 10 s try: keys (or the phone's TYPE pad) throw THAT style's real menu pop —
// the pooled MenuXpFx node wearing the look's painted burst — with a TRYING chip + the BUY in a sticky bar. Nothing is
// credited, nothing loops. The owner flag ?trylooks=1 wears any style for the page load without ever saving it.
// SHOTS=<dir> records a frame strip of trying 3 styles (not part of the gate).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const SHOTS = process.env.SHOTS;

async function boot(page, { flag = '' } = {}) {
  await installBackendMock(page);
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('tryon.seeded')) return;
    sessionStorage.setItem('tryon.seeded', '1');
    Object.entries({
      'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': p, 'taw.econ': '12',
      'taw.s2.xp': JSON.stringify({ lv: 30, f: 0.2, rc: 0, v: 10 }),
      'taw.s2.gems': JSON.stringify({ bal: 50, mig: 1 }),
    }).forEach(([k, v]) => localStorage.setItem(k, v));
  }, PATCH_ID);
  await page.goto(`/?portal=1&season2=1${flag}`);
  await menuReady(page);
  await navControl(page, 'shop').click();
  await page.locator('.sp2').waitFor({ state: 'visible' });
  await page.locator('.sp2-tab[data-shelf="looks"]').click();
  await page.locator('.sp2-look[data-look="inferno"]').waitFor({ state: 'visible' });
}

const xpSave = (page) => page.evaluate(() => localStorage.getItem('taw.s2.xp'));
/** visible try-on pops wearing the `id` burst */
const burstsOf = (page, id) => page.evaluate((id) => [...document.querySelectorAll('.sp2-tryfx .menu-xp-pop-art')]
  .filter((i) => (i.getAttribute('src') || '').includes(`burst-${id}`) && i.style.display === 'block').length, id);

test('tap a LOCKED style → keys throw its real burst pop; chip + BUY stay up; nothing credited; ends after ~10 s', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page);
  const card = page.locator('.sp2-look[data-look="inferno"]');
  await expect(card).toHaveClass(/is-locked|is-buy/);
  await card.locator('.sp2-look-name').click();
  const bar = page.getByTestId('sp2-try');
  await expect(bar).toBeVisible();
  await expect(bar.locator('.sp2-try-chip')).toHaveText('TRYING · INFERNO');
  await expect(bar.locator('.sp2-look-buy')).toBeVisible();
  await expect(card).toHaveClass(/is-trying/);
  const before = await xpSave(page);
  await page.waitForTimeout(150); // the look palette is a lazy leaf
  await page.keyboard.type('asdf', { delay: 90 });
  await expect.poll(() => burstsOf(page, 'inferno')).toBeGreaterThan(0);
  expect(await page.locator('.sp2-tryfx .menu-xp-pop-plus').filter({ hasText: /XP/ }).count()).toBeGreaterThan(0);
  expect(await xpSave(page)).toBe(before); // a try never credits XP
  // nothing at rest loops: zero infinite animations on the shop
  expect(await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).length)).toBe(0);
  // another pick swaps the try
  await page.locator('.sp2-look[data-look="gold"] .sp2-look-stage').click();
  await expect(bar.locator('.sp2-try-chip')).toHaveText('TRYING · GOLD');
  await page.waitForTimeout(1300);
  await page.keyboard.type('jkl', { delay: 90 });
  await expect.poll(() => burstsOf(page, 'gold')).toBeGreaterThan(0);
  // ~10 s later the try is over: the bar goes, keys throw nothing
  await expect(bar).toBeHidden({ timeout: 12_000 });
  await page.waitForTimeout(1600);
  await page.keyboard.type('zx', { delay: 90 });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.sp2-tryfx')).length)).toBe(0);
});

test('leaving the LOOKS tab ends the try', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page);
  await page.locator('.sp2-look[data-look="void"] .sp2-look-stage').click();
  await expect(page.getByTestId('sp2-try')).toBeVisible();
  await page.locator('.sp2-tab[data-shelf="codes"]').click();
  await page.locator('.sp2-tab[data-shelf="looks"]').click();
  await expect(page.getByTestId('sp2-try')).toHaveCount(0);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the TYPE pad fires the tried style (no text box) and the bar stays in view', async ({ page }) => {
    await boot(page);
    const card = page.locator('.sp2-look[data-look="toxic"]');
    await card.scrollIntoViewIfNeeded();
    await card.locator('.sp2-look-stage').tap();
    const pad = page.getByTestId('sp2-try-pad');
    await expect(pad).toBeVisible();
    await expect(pad).toBeInViewport();
    await expect(page.getByTestId('sp2-try').locator('.sp2-try-chip')).toBeInViewport();
    const box = await pad.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('.sp2 input, .sp2 textarea').count()).toBe(0);
    await page.waitForTimeout(150);
    for (let i = 0; i < 4; i++) { await pad.tap(); await page.waitForTimeout(90); }
    await expect.poll(() => burstsOf(page, 'toxic')).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test('no owner flag: a locked style has no EQUIP', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page);
  await expect(page.getByTestId('wear-legend')).toHaveCount(0);
});

test('?trylooks=1: EQUIP any style for the session — the menu wears it, the save never does', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page, { flag: '&trylooks=1' });
  const saved = await page.evaluate(() => localStorage.getItem('taw.equipped'));
  await page.getByTestId('wear-legend').click();
  await expect(page.locator('.sp2-look[data-look="legend"]')).toHaveClass(/is-on/);
  expect(await page.evaluate(() => localStorage.getItem('taw.equipped'))).toBe(saved);
  expect(await page.evaluate(() => localStorage.getItem('taw.owned') || '')).not.toContain('legend');
  await page.locator('.sp2-back, [aria-label="Back to menu"]').first().click();
  await menuReady(page);
  await page.waitForTimeout(600);
  await expect.poll(async () => {
    await page.keyboard.type('qw', { delay: 90 });
    return page.evaluate(() => [...document.querySelectorAll('.menu-xp-pop-art')].filter((i) => /burst-legend/.test(i.getAttribute('src') || '') && i.style.display === 'block').length);
  }, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('taw.equipped'))).toBe(saved);
});

if (SHOTS) {
  // the frame strip: trying 3 styles, one frame per pop at its readable hold (frozen for the still — not app behaviour)
  test.describe('strip', () => {
    test.use({ reducedMotion: 'no-preference' });
    for (const vp of [{ width: 1366, height: 768, tag: '1366x768', touch: false }, { width: 390, height: 844, tag: '390x844', touch: true }]) {
      test(`strip ${vp.tag}`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch, reducedMotion: 'no-preference' });
        const page = await ctx.newPage();
        await boot(page);
        let f = 0;
        for (const id of ['inferno', 'frost', 'legend']) {
          const card = page.locator(`.sp2-look[data-look="${id}"]`);
          await card.scrollIntoViewIfNeeded();
          await card.locator('.sp2-look-stage').click();
          await page.waitForTimeout(300);
          // a finger tap at the pad's spot (locator.tap() would scroll the sticky bar to its in-flow place first)
          const pb = vp.touch ? await page.getByTestId('sp2-try-pad').boundingBox() : null;
          for (let k = 0; k < 3; k++) {
            if (pb) await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2); else await page.keyboard.press('KeyA');
            await page.waitForTimeout(120);
          }
          await page.waitForTimeout(140);
          await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
          await page.screenshot({ path: `${SHOTS}/${vp.tag}-${++f}-${id}.png` });
          await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
          await page.waitForTimeout(1600);
        }
        await ctx.close();
      });
    }
  });
}
