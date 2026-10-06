// claude/shoot-menu-list.mjs — before/after shots of the v2 menu list (PR feat/menu-list-final) + the card
// centring gaps. usage: node claude/shoot-menu-list.mjs <before|after> [baseURL]
import { chromium } from '@playwright/test';
import { installBackendMock } from '../e2e/support/backendMock.js';
const tag = process.argv[2] || 'after';
const base = process.argv[3] || 'http://localhost:4317';
const SIZES = [[1366, 657], [1280, 551], [1920, 1080], [390, 844]];
const browser = await chromium.launch();
for (const [w, h] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      const save = JSON.stringify({ lv: 4, f: 0.4, rc: 0, v: 10 });
      localStorage.setItem('taw.xp', save);
      localStorage.setItem('taw.xpv10', save);
      localStorage.setItem('taw.econ', '12');
      localStorage.setItem('taw.wins', '320');
      localStorage.setItem('taw.winsLifetime', '320');
    } catch { /* blocked */ }
  });
  await installBackendMock(page);
  await page.goto(`${base}/?portal=1`);
  await page.locator('.homepage-logo, .hp-m-title').first().waitFor();
  await page.waitForTimeout(1500);
  const gaps = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.homepage-cards-grid .game-card-magnet')].filter((c) => c.offsetParent);
    if (!cards.length) return null;
    const rs = cards.map((c) => c.getBoundingClientRect());
    const left = Math.min(...rs.map((r) => r.left));
    const right = Math.max(...rs.map((r) => r.right));
    return { left: Math.round(left * 10) / 10, right: Math.round((innerWidth - right) * 10) / 10 };
  });
  console.log(`${w}x${h}`, JSON.stringify(gaps));
  await page.screenshot({ path: `claude/mockups/v2/shots/menu-list-${tag}-${w}x${h}.png` });
  await ctx.close();
}
await browser.close();
