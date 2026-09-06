// cap.mjs — generic screenshot + largest-empty-rectangle for ONE row of cards.
// Usage: node cap.mjs <outDir> <url> <rowSelector> <cardSelector> <labelsCSV> [widthsCSV]
import { chromium } from '@playwright/test';
import fs from 'fs'; import path from 'path';

const [outDir, url, rowSel, cardSel, labelsCSV, widthsCSV] = process.argv.slice(2);
const labels = labelsCSV.split(',');
const WIDTHS = (widthsCSV || '1920,1366,390').split(',').map(Number);
fs.mkdirSync(outDir, { recursive: true });

async function measure(page, dataUrl) {
  return await page.evaluate(async (durl) => {
    const img = new Image(); img.src = durl; await img.decode();
    const GW = 128, GH = Math.max(1, Math.round(128 * img.height / img.width));
    const cv = document.createElement('canvas'); cv.width = GW; cv.height = GH;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, GW, GH);
    const d = ctx.getImageData(0, 0, GW, GH).data;
    const at = (x, y) => { const i = (y * GW + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const ring = [];
    for (let x = 0; x < GW; x += 4) { ring.push(at(x, 0)); ring.push(at(x, GH - 1)); }
    for (let y = 0; y < GH; y += 4) { ring.push(at(0, y)); ring.push(at(GW - 1, y)); }
    const med = (a, k) => { const s = a.map(c => c[k]).sort((x, y) => x - y); return s[s.length >> 1]; };
    const field = [med(ring, 0), med(ring, 1), med(ring, 2)]; const TH = 42;
    const g = new Uint8Array(GW * GH);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const [r, gr, b] = at(x, y);
      if (Math.max(Math.abs(r - field[0]), Math.abs(gr - field[1]), Math.abs(b - field[2])) > TH) g[y * GW + x] = 1;
    }
    const heights = new Int32Array(GW); let best = 0;
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) heights[x] = g[y * GW + x] ? 0 : heights[x] + 1;
      const st = [];
      for (let x = 0; x <= GW; x++) {
        const h = x === GW ? 0 : heights[x]; let start = x;
        while (st.length && st[st.length - 1][1] >= h) { const [sx, sh] = st.pop(); const ar = sh * (x - sx); if (ar > best) best = ar; start = sx; }
        st.push([start, h]);
      }
    }
    return +(100 * best / (GW * GH)).toFixed(1);
  }, dataUrl);
}

const results = {};
const browser = await chromium.launch();
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const row = page.locator(rowSel);
  await row.screenshot({ path: path.join(outDir, `row-${width}.png`) });
  const cards = row.locator(cardSel); const n = await cards.count();
  for (let i = 0; i < n; i++) {
    const buf = await cards.nth(i).screenshot();
    results[`${labels[i]}|${width}`] = await measure(page, 'data:image/png;base64,' + buf.toString('base64'));
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'empty-rect.json'), JSON.stringify(results, null, 1));
console.log('LARGEST-EMPTY-RECTANGLE (%)');
for (const w of WIDTHS) { console.log(` @${w}:`); for (const l of labels) console.log(`    ${l.padEnd(16)} ${String(results[`${l}|${w}`]).padStart(5)}%`); }
console.log('saved to', outDir);
