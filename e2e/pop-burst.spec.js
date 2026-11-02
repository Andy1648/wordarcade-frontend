// e2e/pop-burst.spec.js — a worn POP STYLE throws its own PAINTED burst behind every +N pop on the menu (popLooks art,
// MenuXp dressArt): the pooled pop's burst child shows the look's art; CLASSIC shows none; the burst never loops.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

async function boot(page, pop) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installBackendMock(page);
  await page.addInitScript(({ p, pop }) => {
    if (sessionStorage.getItem('pb.seeded')) return;
    sessionStorage.setItem('pb.seeded', '1');
    Object.entries({ 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': p, 'taw.owned': JSON.stringify(['classic', 'thock', 'clack', 'cream', pop]),
      'taw.equipped': JSON.stringify({ popStyle: pop, soundPack: 'thock' }), 'taw.s2.xp': JSON.stringify({ lv: 30, f: 0.2, rc: 0, v: 10 }) }).forEach(([k, v]) => localStorage.setItem(k, v));
  }, { p: PATCH_ID, pop });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
}

test('INFERNO worn: the +N pops carry the painted inferno burst', async ({ page }) => {
  await boot(page, 'inferno');
  // shown AND laid out (a 0-size box = still display:none from the CSS); the look's data loads at idle, so keep typing
  await expect.poll(async () => { await page.keyboard.press('KeyQ'); await page.waitForTimeout(120); return page.evaluate(() => [...document.querySelectorAll('.menu-xp-pop-art')].filter((i) => /burst-inferno/.test(i.getAttribute('src') || '') && i.getBoundingClientRect().width > 20).length); }, { timeout: 10_000 }).toBeGreaterThan(0);
  if (process.env.SHOTS) {
    // freeze a fresh pop at its peak so the screenshot shows the burst under the number
    await page.waitForTimeout(900);
    await page.keyboard.press('KeyW'); await page.waitForTimeout(40); await page.keyboard.press('KeyE');
    await page.waitForTimeout(160);
    await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
    const box = await page.evaluate(() => { const els = [...document.querySelectorAll('.menu-xp-pop-art')].filter((i) => i.getBoundingClientRect().width > 20).sort((a, b) => +getComputedStyle(b).opacity * +getComputedStyle(b.parentElement).opacity - +getComputedStyle(a).opacity * +getComputedStyle(a.parentElement).opacity); const r = els[0].getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await page.screenshot({ path: 'claude/shots/pop-menu-inferno.png' });
    await page.screenshot({ path: 'claude/shots/pop-menu-inferno-zoom.png', clip: { x: Math.max(0, box.x - 90), y: Math.max(0, box.y - 70), width: 300, height: 230 } });
  }
  const inf = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains('menu-xp-pop-art')).length);
  expect(inf).toBe(0);
});

test('CLASSIC: no burst art under the pops', async ({ page }) => {
  await boot(page, 'classic');
  for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyQ'); await page.waitForTimeout(120); }
  await page.waitForTimeout(300);
  const shown = await page.evaluate(() => [...document.querySelectorAll('.menu-xp-pop-art')].filter((i) => i.style.display !== 'none' && i.getAttribute('src')).length);
  expect(shown).toBe(0);
});
