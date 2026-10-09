// e2e/menu-key-xp-honest.spec.js — Andy oct9: "it says I get 18 XP/KEY but when I type the bar goes up like 4 — no more
// dumb things like that". A typed menu key must pay EXACTLY what the economy says it pays — at load, and after the rate
// changes while the menu is open (here: a FRENZY boost that ends).
// The "+N XP / KEY" line under the bar is GONE (Andy oct9: "no need to write how much xp/key below the progression bar
// bc thats not always the case"), so the expected number comes from the formula + the STATS tile (the TOTAL
// MULTIPLIER on a key, v4: BASE 1 XP), never from a menu line.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

// KEY T3 (2^3 = ×8) × R1 (×3) × BASE 1 XP = 24 XP a key, no gear, no boost.
const EXPECTED = 2 ** 3 * 3;

const lastPop = (page) => page.evaluate(() => {
  const all = [...document.querySelectorAll('.menu-xp-pop-plus')].map((n) => n.textContent).filter((t) => t && !/CRIT/.test(t));
  return all.length ? Number(all[all.length - 1].replace(/[^\d.]/g, '')) : null;
});
const statsTile = (page) => page.locator('[data-nav="stats"] .kb-rval-big').first().textContent()
  .then((t) => Number(String(t).replace(/[^\d.]/g, '')));

async function boot(page, extra = {}) {
  await page.setViewportSize({ width: 1366, height: 657 });
  await installBackendMock(page);
  await page.addInitScript((more) => {
    if (sessionStorage.getItem('kx')) return;
    sessionStorage.setItem('kx', '1');
    for (const [k, v] of Object.entries({ 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.s2.keytier': '3', 'taw.s2.rebirths': '1', 'taw.s2.xp': JSON.stringify({ lv: 40, f: 0.1, rc: 1, v: 10 }), ...more })) localStorage.setItem(k, v);
  }, extra);
  await page.goto('/?portal=1&season2=1');
  await page.locator('.menu-xp-bar').first().waitFor();
  await page.waitForTimeout(800);
}

test('a menu key pays what the economy says (KEY × REBIRTH), and no rate line is printed under the bar', async ({ page }) => {
  await boot(page);
  await expect(page.locator('.hp-rate, .hp-per')).toHaveCount(0);
  await expect(page.locator('.menu-xp-cluster')).not.toContainText('/ KEY');
  expect(await statsTile(page), 'STATS shows the total multiplier on a key').toBe(EXPECTED);
  for (const k of 'asdfgh') { await page.keyboard.press(k); await page.waitForTimeout(120); }
  expect(await lastPop(page), 'a key pops exactly KEY × REBIRTH').toBe(EXPECTED);
});

test('a boost that ENDS while the menu is open: keys go back to the base pay once it ends', async ({ page }) => {
  await boot(page, { 'taw.frenzyUntil': String(Date.now() + 3000) });
  await page.waitForTimeout(4000); // FRENZY (×5 XP) has ended
  for (const k of 'asdfgh') { await page.keyboard.press(k); await page.waitForTimeout(150); }
  expect(await lastPop(page), 'the key pays the base rate once FRENZY ends').toBe(EXPECTED);
  expect(await statsTile(page), 'and STATS agrees').toBe(EXPECTED);
});
