// x7b-zoom.mjs — tight shot of the wordmark only, both variants, at 3x, plus a
// per-layer breakdown so it is obvious WHICH layer is swamping the lockup.
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173';
const browser = await chromium.launch();

async function shot(q, name, only) {
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 3,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.goto(`/?portal=1${q}`);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(1400);
  if (only) {
    // Hide every layer except the named one, so each can be seen on its own.
    await page.addStyleTag({
      content: `.x7b-logo .x7b-layer, .x7b-logo .x7b-flow { visibility: hidden !important; }
                .x7b-logo .${only} { visibility: visible !important; }`,
    });
    await page.waitForTimeout(120);
  }
  const el = page.locator('.homepage-logo').first();
  // page.screenshot({clip}) rather than el.screenshot(): an ELEMENT screenshot came back
  // uniformly ~27% darker than the same pixels in a full-page capture, on BOTH variants,
  // which made the lockup look like it had a colour bug when it did not. Clipping a page
  // capture to the element's box gives the pixels the player actually sees.
  const box = await el.boundingBox();
  const pad = 8;
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    },
  });
  const info = await el.evaluate((n) => {
    const kids = [...n.children].map((c) => {
      const cs = getComputedStyle(c);
      const r = c.getBoundingClientRect();
      return {
        cls: c.className,
        font: cs.fontFamily.split(',')[0].replace(/"/g, ''),
        color: cs.color,
        stroke: cs.webkitTextStrokeWidth,
        w: Number(r.width.toFixed(1)),
      };
    });
    return { ready: n.classList.contains('is-ready'), kids };
  });
  console.log(name, JSON.stringify(info));
  await ctx.close();
}

await shot('', 'today');
await shot('&x7b=1', 'x7b-all');
for (const l of ['x7b-depth', 'x7b-solid', 'x7b-inline', 'x7b-flow']) {
  await shot('&x7b=1', `x7b-only-${l.replace('x7b-', '')}`, l);
}
await browser.close();
console.log('->', OUT);
