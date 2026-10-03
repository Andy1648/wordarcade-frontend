// e2e/sw-update.spec.js — N3 (Andy oct2): "the leaderboard icon sometimes doesn't show until refresh".
// The service worker answers a returning visit from the PREVIOUS deploy's precache; the new SW takes
// control in the background but the page stays on the old build until a manual refresh. This serves
// build A, lets its SW take control, swaps the server to build B (a marker in index.html + a new
// precache revision, exactly what a deploy changes), navigates ONCE, and requires B on screen without
// the test reloading. On main the page stays on A forever → this fails; lib/swUpdate.js fixes it.
import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { installBackendMock } from './support/backendMock.js';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml', '.mp3': 'audio/mpeg' };

function makeBuilds() {
  const dist = path.resolve('dist');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'taw-sw-'));
  const A = path.join(root, 'A');
  const B = path.join(root, 'B');
  fs.cpSync(dist, A, { recursive: true });
  fs.cpSync(dist, B, { recursive: true });
  const idx = path.join(B, 'index.html');
  fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace('</head>', '<meta name="taw-build" content="B"></head>'));
  const sw = path.join(B, 'sw.js');
  const src = fs.readFileSync(sw, 'utf8');
  const next = src.replace(/(url:"index\.html",revision:")[0-9a-f]+"/, '$1b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b"');
  if (next === src) throw new Error('sw.js precache entry for index.html not found');
  fs.writeFileSync(sw, next);
  return { A, B };
}

function serve(dirRef) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let file = path.join(dirRef.dir, decodeURIComponent(u.pathname));
    if (!file.startsWith(dirRef.dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dirRef.dir, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('a deploy is on screen after ONE visit — the updated service worker reloads the menu onto it', async ({ page }) => {
  test.setTimeout(90000);
  const { A, B } = makeBuilds();
  const dirRef = { dir: A };
  const server = await serve(dirRef);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await page.setViewportSize({ width: 1280, height: 551 });
    await installBackendMock(page);
    await page.addInitScript(() => { try { localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); } catch { /* */ } });
    await page.goto(`${base}/?portal=1`);
    await page.locator('.homepage-wrap').waitFor({ state: 'attached', timeout: 30000 });
    await page.waitForFunction(() => !!navigator.serviceWorker && !!navigator.serviceWorker.controller, null, { timeout: 30000 });
    await expect(page.locator('meta[name="taw-build"]')).toHaveCount(0);

    dirRef.dir = B; // the deploy
    await page.goto(`${base}/?portal=1`); // the player's next visit — served from the old precache
    await page.locator('.homepage-wrap').waitFor({ state: 'attached', timeout: 30000 });
    // no reload from the test: the new SW takes control and the menu reloads itself onto build B
    await expect(page.locator('meta[name="taw-build"]')).toHaveAttribute('content', 'B', { timeout: 30000 });
  } finally {
    server.close();
  }
});
