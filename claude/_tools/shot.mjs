// shot.mjs — screenshot + largest-empty-rectangle harness (Playwright + Chromium).
// Usage: node shot.mjs <outDir>
// Measures each .card inside #row-artled/#row-poster/#row-cab/#row-data on the
// proto page, at 1920/1366/390, via PIXEL analysis (flat field = empty, anything
// else = ink), and saves per-direction section screenshots.
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:4173/proto-cards-2.html';
const WIDTHS = [1920, 1366, 390];
const ROWS = [
  ['artled', '#row-artled', 'ART-LED'],
  ['poster', '#row-poster', 'POSTER'],
  ['cab', '#row-cab', 'ARCADE CABINET'],
  ['data', '#row-data', 'DATA-FORWARD'],
];
const MODES = ['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse'];

// In-page: decode a PNG data URL onto a canvas, find the field colour from the
// border ring, mark ink pixels, and compute the largest all-empty rectangle as a
// % of area. Returns {pct, w, h}.
async function measure(page, dataUrl) {
  return await page.evaluate(async (durl) => {
    const img = new Image();
    img.src = durl;
    await img.decode();
    const GW = 128, GH = Math.max(1, Math.round(128 * img.height / img.width));
    const cv = document.createElement('canvas');
    cv.width = GW; cv.height = GH;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, GW, GH);
    const d = ctx.getImageData(0, 0, GW, GH).data;
    const at = (x, y) => { const i = (y * GW + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    // Field colour = median of a border ring of samples.
    const ring = [];
    for (let x = 0; x < GW; x += 4) { ring.push(at(x, 0)); ring.push(at(x, GH - 1)); }
    for (let y = 0; y < GH; y += 4) { ring.push(at(0, y)); ring.push(at(GW - 1, y)); }
    const med = (arr, k) => { const s = arr.map(c => c[k]).sort((a, b) => a - b); return s[s.length >> 1]; };
    const field = [med(ring, 0), med(ring, 1), med(ring, 2)];
    const TH = 42; // channel distance beyond which a pixel counts as ink
    // occupancy grid: 1 = ink
    const g = new Uint8Array(GW * GH);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const [r, gr, b] = at(x, y);
      const dist = Math.max(Math.abs(r - field[0]), Math.abs(gr - field[1]), Math.abs(b - field[2]));
      if (dist > TH) g[y * GW + x] = 1;
    }
    // largest all-empty (g==0) rectangle via histogram method
    const heights = new Int32Array(GW);
    let best = 0;
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) heights[x] = g[y * GW + x] ? 0 : heights[x] + 1;
      const stack = []; // indices
      for (let x = 0; x <= GW; x++) {
        const h = x === GW ? 0 : heights[x];
        let start = x;
        while (stack.length && stack[stack.length - 1][1] >= h) {
          const [sx, sh] = stack.pop();
          const area = sh * (x - sx);
          if (area > best) best = area;
          start = sx;
        }
        stack.push([start, h]);
      }
    }
    return { pct: +(100 * best / (GW * GH)).toFixed(1), w: GW, h: GH };
  }, dataUrl);
}

const results = {};
const browser = await chromium.launch();
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600); // fonts settle
  for (const [key, sel, label] of ROWS) {
    // section screenshot (the whole row, all 5 modes together)
    const row = page.locator(sel);
    const shotPath = path.join(OUT, `${key}-${width}.png`);
    await row.screenshot({ path: shotPath });
    const cards = row.locator('.card');
    const n = await cards.count();
    for (let i = 0; i < n; i++) {
      const el = cards.nth(i);
      const buf = await el.screenshot();
      const durl = 'data:image/png;base64,' + buf.toString('base64');
      const m = await measure(page, durl);
      const kk = `${key}|${MODES[i]}|${width}`;
      results[kk] = m.pct;
    }
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'empty-rect.json'), JSON.stringify(results, null, 1));

// Pretty table to stdout
console.log('\nLARGEST-EMPTY-RECTANGLE (% of card area)\n');
for (const [key, , label] of ROWS) {
  console.log(label);
  for (const w of WIDTHS) {
    const row = MODES.map(m => `${m.padEnd(15)} ${String(results[`${key}|${m}|${w}`]).padStart(5)}%`).join('   ');
    console.log(`  @${w}:`);
    for (const m of MODES) console.log(`     ${m.padEnd(16)} ${String(results[`${key}|${m}|${w}`]).padStart(5)}%`);
  }
  console.log('');
}
console.log('shots + empty-rect.json in', OUT);
