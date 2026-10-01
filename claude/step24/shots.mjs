// shots.mjs <base> <outDir> — the board at phone + desktop, fresh (unclaimed) and claimed.
import { chromium } from '@playwright/test';
const [BASE, OUT] = process.argv.slice(2);
const b = await chromium.launch();
for (const [w, h, tag] of [[390, 844, 'phone'], [1280, 551, 'desk1280'], [1920, 1080, 'desk1920']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?portal=1`);
  await p.locator('.hp-m-title, .homepage-logo').first().waitFor();
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/${tag}-menu.png` });
  await p.locator('.is-board').first().click();
  await p.locator('.lb-panel').waitFor();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/${tag}-board.png` });
  await p.locator('.lb-claim-input').fill('sh1tlord');
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/${tag}-blocked.png` });
  await ctx.close();
}
await b.close();
