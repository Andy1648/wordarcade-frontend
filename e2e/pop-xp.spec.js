// e2e/pop-xp.spec.js — POP STYLES PAY AGAIN (oct24, Andy: "each gives an XP MULTIPLIER (like v1)"): the LOOKS cards say
// what each pop pays, and a worn pop multiplies the XP a menu key credits (LEGEND = ×3 the CLASSIC key).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

async function boot(page, pop) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installBackendMock(page);
  await page.addInitScript(({ p, pop }) => {
    if (sessionStorage.getItem('px.seeded')) return;
    sessionStorage.setItem('px.seeded', '1');
    Object.entries({ 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': p, 'taw.s2.xp': JSON.stringify({ lv: 300, f: 0, rc: 0, v: 10 }),
      'taw.owned': JSON.stringify(['classic', 'thock', 'clack', 'cream', 'legend']), 'taw.equipped': JSON.stringify({ popStyle: pop, soundPack: 'thock' }) })
      .forEach(([k, v]) => localStorage.setItem(k, v));
  }, { p: PATCH_ID, pop });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
}
// XP gained by typing N letters on the menu (the bar's stored fraction × need is the season-2 save; read the raw XP total)
async function xpFor(page, n) {
  const read = () => page.evaluate(() => { const o = JSON.parse(localStorage.getItem('taw.s2.xp') || '{}'); return { lv: o.lv, f: o.f }; });
  const a = await read();
  await page.keyboard.type('qwrtzxpvqw'.slice(0, n), { delay: 120 });
  await page.waitForTimeout(1500);
  const b = await read();
  return { a, b };
}

test('LOOKS: each paid pop says what it pays (+5% XP … ×3 XP)', async ({ page }) => {
  await boot(page, 'classic');
  await page.locator('[data-nav="shop"]:visible').first().click();
  await page.getByRole('tab', { name: /LOOKS/i }).click();
  await expect(page.getByTestId('pop-xp-chrome')).toHaveText('+5% XP');
  await expect(page.getByTestId('pop-xp-plasma')).toHaveText('+95% XP');
  await expect(page.getByTestId('pop-xp-legend')).toHaveText('×3 XP');
});

test('a worn LEGEND pop pays ×3 the CLASSIC key (same save, same keys)', async ({ browser }) => {
  const gain = async (pop) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await boot(page, pop);
    const { a, b } = await xpFor(page, 8);
    await ctx.close();
    expect(b.lv).toBe(a.lv); // LV 300: 8 keys never level up, so the stored fraction is the XP
    return b.f - a.f;
  };
  const classic = await gain('classic');
  const legend = await gain('legend');
  expect(classic).toBeGreaterThan(0);
  expect(legend / classic).toBeGreaterThan(2.7);
  expect(legend / classic).toBeLessThan(3.3);
});
