// Standalone menu-TTI measurement against a GZIP static server (mimics Vercel's compressed
// delivery). No playwright webServer involved — this owns the server AND drives chromium, so the
// measured transfer is the real gzipped critical path. Usage: node measure_gz.mjs <dist> <port>
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';

const DIST = process.argv[2] || 'dist';
const PORT = Number(process.argv[3] || 4188);
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain','.ico':'image/x-icon','.webmanifest':'application/manifest+json' };

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    const asset = resolve(DIST, '.' + p);
    if (p === '/' || !existsSync(asset) || !extname(asset)) p = '/index.html';
    const buf = await readFile(resolve(DIST, '.' + p));
    const gz = gzipSync(buf);
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream', 'Content-Encoding': 'gzip', 'Content-Length': gz.length, 'Cache-Control': 'no-cache' });
    res.end(gz);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(PORT, r));

const SLOW_3G = { offline: false, downloadThroughput: (400*1024)/8, uploadThroughput: (400*1024)/8, latency: 400 };
const median = (xs) => { const s = [...xs].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };

const browser = await chromium.launch();
const samples = [];
for (let i = 0; i < 3; i++) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    try { localStorage.setItem('wa_last_seen', String(Date.now())); } catch {}
    try { Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '3g', saveData: false, addEventListener(){}, removeEventListener(){} } }); } catch {}
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await client.send('Network.emulateNetworkConditions', SLOW_3G);
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'commit' });
  await page.locator('.homepage-corner-nav').first().waitFor({ state: 'visible', timeout: 90_000 });
  const tti = Date.now() - t0;
  samples.push(tti);
  console.log(`GZ TTI-RUN ${i+1}: ${tti}ms`);
  await context.close();
}
console.log(`GZ TTI | samples=[${samples.join(', ')}]ms | MEDIAN=${median(samples)}ms`);
await browser.close();
server.close();
