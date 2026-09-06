// Largest-empty-rectangle over THE RUN's card art (BE-PICKY headline number).
// "Ink" = a pixel far from the pink field colour (cards, black outlines/glyphs,
// the darker-magenta wall all qualify; the flat pink field + faint rays are treated
// as emptiness). Reports the largest all-empty axis-aligned rectangle as % of area.
import { chromium } from '@playwright/test';
const BASE = 'http://localhost:4173';
const width = parseInt(process.argv[2] || '1366', 10);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 31, into: 0 })); } catch {} });
await page.goto(`${BASE}/?portal=1`, { waitUntil: 'networkidle' });
await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
const runCard = page.locator('.game-card-magnet[data-game="run"] .game-card');
await runCard.waitFor({ state: 'visible' });
try { await runCard.click({ trial: true, timeout: 9000 }); } catch {}
await page.waitForTimeout(500);
const art = page.locator('.game-card-magnet[data-game="run"] .card-art');
const buf = await art.screenshot();
const b64 = buf.toString('base64');

const res = await page.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = 'data:image/png;base64,' + b64; });
  const GW = 160, GH = Math.round(GW * img.height / img.width);
  const c = document.createElement('canvas'); c.width = GW; c.height = GH;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, GW, GH);
  const d = ctx.getImageData(0, 0, GW, GH).data;
  // field pink ~ (255,79,163). Ink if far from it (and not near the lighter ray pink).
  const isInk = (r, g, b) => {
    const dField = Math.abs(r - 255) + Math.abs(g - 79) + Math.abs(b - 163);
    return dField > 110; // cards/black/wall are far; field + faint rays are near
  };
  const grid = new Uint8Array(GW * GH); // 1 = empty
  let emptyCount = 0;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = (y * GW + x) * 4;
    const e = isInk(d[i], d[i + 1], d[i + 2]) ? 0 : 1;
    grid[y * GW + x] = e; emptyCount += e;
  }
  const sample = [d[0], d[1], d[2], d[3]];
  // largest all-empty rectangle via histogram method
  const heights = new Int32Array(GW);
  let best = 0, bestRect = null;
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) heights[x] = grid[y * GW + x] ? heights[x] + 1 : 0;
    const st = [];
    for (let x = 0; x <= GW; x++) {
      const h = x === GW ? 0 : heights[x];
      let start = x;
      while (st.length && st[st.length - 1][1] >= h) {
        const [sx, sh] = st.pop();
        const area = sh * (x - sx);
        if (area > best) { best = area; bestRect = { x: sx, y: y - sh + 1, w: x - sx, h: sh }; }
        start = sx;
      }
      st.push([start, h]);
    }
  }
  return { GW, GH, pct: (best / (GW * GH) * 100), bestRect, emptyCount, total: GW * GH, sample };
}, b64);
console.log(`width ${width}: largest empty rectangle = ${res.pct.toFixed(1)}% of card-art area`);
console.log(`  grid ${res.GW}x${res.GH}, rect`, res.bestRect);
console.log(`  emptyCount ${res.emptyCount}/${res.total}, topLeft sample rgba`, res.sample);
await browser.close();
