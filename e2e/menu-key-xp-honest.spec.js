// e2e/menu-key-xp-honest.spec.js — Andy oct9: "it says I get 18 XP/KEY but when I type the bar goes up like 4 — no more
// dumb things like that". The "+N XP / KEY" line on the menu and the "+N" a typed key pops (= what the bar gains) must
// be the SAME number — at load, and after the rate changes while the menu is open (here: a KEY tier bought in another tab).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const rateOf = (page) => page.locator('.hp-rate').first().textContent().then((t) => Number((/\+([\d,.]+)/.exec(t) || [])[1]?.replace(/,/g, '')));
const lastPop = (page) => page.evaluate(() => {
  const all = [...document.querySelectorAll('.menu-xp-pop-plus')].map((n) => n.textContent).filter((t) => t && !/CRIT/.test(t));
  return all.length ? Number(all[all.length - 1].replace(/[^\d.]/g, '')) : null;
});

test('the menu XP / KEY line is what a key actually pays', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('kx')) return;
    sessionStorage.setItem('kx', '1');
    for (const [k, v] of Object.entries({ 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.s2.keytier': '3', 'taw.s2.rebirths': '1', 'taw.s2.xp': JSON.stringify({ lv: 40, f: 0.1, rc: 1, v: 10 }) })) localStorage.setItem(k, v);
  });
  await page.goto('/?portal=1&season2=1');
  await page.locator('.hp-rate').first().waitFor();
  await page.waitForTimeout(800);
  const rate = await rateOf(page);
  expect(rate).toBeGreaterThan(1);
  for (const k of 'asdfgh') { await page.keyboard.press(k); await page.waitForTimeout(120); }
  expect(await lastPop(page), 'a key pops what the line says').toBe(rate);
});

test('a boost that ENDS while the menu is open: the line and the keys agree after it ends', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('kx')) return;
    sessionStorage.setItem('kx', '1');
    for (const [k, v] of Object.entries({ 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.s2.keytier': '3', 'taw.s2.rebirths': '1', 'taw.s2.xp': JSON.stringify({ lv: 40, f: 0.1, rc: 1, v: 10 }), 'taw.frenzyUntil': String(Date.now() + 3000) })) localStorage.setItem(k, v);
  });
  await page.goto('/?portal=1&season2=1');
  await page.locator('.hp-rate').first().waitFor();
  await page.waitForTimeout(800);
  const during = await rateOf(page);
  await page.waitForTimeout(4000); // FRENZY (×5 XP) has ended
  for (const k of 'asdfgh') { await page.keyboard.press(k); await page.waitForTimeout(150); }
  const pop = await lastPop(page);
  const line = await rateOf(page);
  console.log('frenzy line', during, '→ after', line, 'key pop', pop);
  expect(pop, 'the key pays what the line says once FRENZY ends').toBe(line);
});
