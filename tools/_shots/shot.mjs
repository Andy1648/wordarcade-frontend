// Screenshot the season2 menu at several viewports against a local vite preview.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const base = process.env.BASE || 'http://localhost:4173';
const out = process.env.OUT || '/tmp/claude-0/-home-claude/dfeccb96-1985-5130-a2b7-72cc0d64d8d4/scratchpad/shots';
const path = process.env.PATHQ || '/?season2=1';
const seed = process.env.SEED || '';
fs.mkdirSync(out, { recursive: true });
const sizes = (process.env.SIZES ? process.env.SIZES.split(' ').map(s=>s.split('x').map(Number)) : [[390, 844], [1280, 800], [1366, 768]]);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  if (seed) await page.addInitScript(seed);
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  // skip splash / welcome if present
  for (const sel of ['button:has-text("COLLECT")', 'button:has-text("PLAY")', 'button:has-text("ENTER")', 'button:has-text("SKIP")']) {
    const b = page.locator(sel).first();
    if (await b.count() && await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(1500); }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(800);
  const name = `${process.env.TAG || 'menu'}-${w}x${h}.png`;
  await page.screenshot({ path: `${out}/${name}`, fullPage: false });
  console.log('wrote', name, await page.title());
  await ctx.close();
}
await browser.close();
