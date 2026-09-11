// squint-debug.mjs — sanity-check the squint analysis against a saved PNG.
import { chromium } from '@playwright/test';
import fs from 'fs';

const file = process.argv[2];
const b64 = fs.readFileSync(file).toString('base64');
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto('about:blank');
const out = await page.evaluate(
  ({ b64, blur, cell }) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.filter = 'none';
        ctx.drawImage(img, 0, 0);
        const edge = ctx.getImageData(0, 0, 1, 1).data;
        ctx.fillStyle = `rgb(${edge[0]},${edge[1]},${edge[2]})`;
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.filter = `blur(${blur}px)`;
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const srgb = (v) => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        const Lstar = (Y) => (Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y) / 100;
        const cols = Math.floor(c.width / cell);
        const rows = Math.floor(c.height / cell);
        const L = [];
        for (let ry = 0; ry < rows; ry++) {
          for (let rx = 0; rx < cols; rx++) {
            let s = 0;
            let n = 0;
            for (let y = ry * cell; y < (ry + 1) * cell; y++) {
              for (let x = rx * cell; x < (rx + 1) * cell; x++) {
                const i = (y * c.width + x) * 4;
                s += 0.2126 * srgb(d[i]) + 0.7152 * srgb(d[i + 1]) + 0.0722 * srgb(d[i + 2]);
                n++;
              }
            }
            L.push(Lstar(s / n));
          }
        }
        const sorted = [...L].sort((a, b) => a - b);
        const q = (p) => sorted[Math.floor(p * (sorted.length - 1))];
        const BINS = 40;
        const hist = new Array(BINS).fill(0);
        for (const v of L) hist[Math.min(BINS - 1, Math.max(0, Math.floor(v * BINS)))]++;
        let mode = 0;
        for (let b = 1; b < BINS; b++) if (hist[b] > hist[mode]) mode = b;
        resolve({
          size: [c.width, c.height],
          grid: [cols, rows],
          edgePixel: [edge[0], edge[1], edge[2]],
          min: sorted[0],
          p50: q(0.5),
          p90: q(0.9),
          p99: q(0.99),
          max: sorted[sorted.length - 1],
          ground: (mode + 0.5) / BINS,
          histTop: hist.map((n, i) => [((i + 0.5) / BINS).toFixed(3), n]).filter((x) => x[1] > 0).slice(0, 45),
        });
      };
      img.src = 'data:image/png;base64,' + b64;
    }),
  { b64, blur: 12, cell: 12 }
);
console.log(JSON.stringify(out, null, 1));
await browser.close();
