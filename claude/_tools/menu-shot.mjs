// menu-shot.mjs — capture the whole menu (Homepage) as a poster at 3 sizes,
// via the e2e backend mock + gotoMenu (skips intro, freezes motion).
// Usage: node menu-shot.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs'; import path from 'path';
import { installBackendMock, gotoMenu } from '../../e2e/support/backendMock.js';

const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const SIZES = [[1920, 1080], [1568, 675], [390, 844]];

const browser = await chromium.launch();
for (const [w, h] of SIZES) {
  const ctx = await browser.newContext({ baseURL: 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await installBackendMock(page);
  await gotoMenu(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `menu-${w}x${h}.png`) });
  console.log(`captured menu-${w}x${h}.png`);
  await ctx.close();
}
await browser.close();
console.log('done ->', OUT);
