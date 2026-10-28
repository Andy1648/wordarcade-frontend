// e2e/pop-kit.spec.js — a worn POP STYLE is a whole themed KIT (oct27, Andy: "the pop styles still look a bit lazy …
// apply the color style to the crit as well and even the progress bar … make the key animations last slightly longer"):
// the +N number wears the look's painted texture, a CRIT throws the look's own painted crit burst, the menu XP bar's fill
// is the look's painted strip, and every key pop lives longer. CLASSIC keeps the plain dress.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const IDS = (process.env.KIT_IDS || 'chrome,inferno,void,prism,toxic,ember,frost,gold,plasma,nova,eclipse,legend').split(',');

async function boot(page, pop, vp = { width: 1366, height: 768 }) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript(({ p, pop }) => {
    if (sessionStorage.getItem('pk.seeded')) return;
    sessionStorage.setItem('pk.seeded', '1');
    Object.entries({ 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': p, 'taw.owned': JSON.stringify(['classic', 'thock', 'clack', 'cream', pop]),
      'taw.equipped': JSON.stringify({ popStyle: pop, soundPack: 'thock' }), 'taw.s2.xp': JSON.stringify({ lv: 30, f: 0.55, rc: 0, v: 10 }) }).forEach(([k, v]) => localStorage.setItem(k, v));
  }, { p: PATCH_ID, pop });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
}

const kitNums = (page, id) => page.evaluate((id) => [...document.querySelectorAll('.menu-xp-pop-plus.is-kit')]
  .filter((n) => (n.style.backgroundImage || '').includes(`bar-${id}`)).length, id);

test('INFERNO worn: textured +N, the painted crit burst, the painted bar fill, longer pops', async ({ page }) => {
  await boot(page, 'inferno');
  await expect(page.locator('.kx-fill.is-skin .kx-fill-skin')).toHaveCount(1);
  expect(await page.locator('.kx-fill-skin').getAttribute('style')).toContain('bar-inferno');
  // the whole bar is the kit: its frame colour, the painted cap on the edge, the crit art waiting on the goal plate
  await expect(page.locator('.kx.is-kit[data-kit=inferno] .kx-cap img')).toHaveCount(1);
  await expect(page.locator('.kx-slam')).toHaveAttribute('src', /crit-inferno/);
  // the look's data loads at idle after the menu paints: keep typing until a pop wears it
  await expect.poll(async () => { await page.keyboard.press('KeyQ'); await page.waitForTimeout(120); return kitNums(page, 'inferno'); }, { timeout: 10_000 }).toBeGreaterThan(0);
  // a key pop now lives ×1.3 its tier length (T0 850 ms → 1105 ms)
  const dur = await page.evaluate(() => Math.max(...document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains('menu-xp-pop')).map((a) => a.effect.getTiming().duration)));
  expect(dur).toBeGreaterThanOrEqual(1100);
  // every key crits from here (the rng the menu rolls with) → the look's own crit burst
  await page.evaluate(() => { Math.random = () => 0; });
  for (let i = 0; i < 2; i++) { await page.keyboard.press('KeyW'); await page.waitForTimeout(150); }
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.menu-xp-pop.is-crit .menu-xp-pop-art')]
    .filter((i) => /crit-inferno/.test(i.getAttribute('src') || '') && i.style.display === 'block').length)).toBeGreaterThan(0);
  const inf = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).length);
  expect(inf).toBeLessThanOrEqual(1); // the menu's one sanctioned loop at most — the kit adds none
});

test('CLASSIC: a plain number, no crit art, the plain bar', async ({ page }) => {
  await boot(page, 'classic');
  await expect(page.locator('.kx-fill-skin')).toHaveCount(0);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyQ'); await page.waitForTimeout(120); }
  await page.waitForTimeout(200);
  expect(await page.locator('.menu-xp-pop-plus.is-kit').count()).toBe(0);
});

// SHOTS=1: one frozen frame per look — a +N pop, a CRIT and the bar — for Andy's strip
test('SHOTS: every kit', async ({ browser }) => {
  test.skip(!process.env.SHOTS, 'screenshots only');
  test.setTimeout(400000);
  for (const id of IDS) {
    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await boot(page, id);
    await page.keyboard.press('KeyQ'); await page.waitForTimeout(260);
    await page.evaluate(() => { Math.random = () => 0; });
    await page.keyboard.press('KeyW'); await page.waitForTimeout(380);
    await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
    await page.screenshot({ path: `claude/shots/popkit/${id}.png` });
    // and a lone +N pop at its peak (no crit)
    await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
    await page.evaluate(() => { Math.random = () => 0.99; });
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyE'); await page.waitForTimeout(330);
    await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
    await page.screenshot({ path: `claude/shots/popkit/${id}-pop.png` });
    await ctx.close();
  }
});
