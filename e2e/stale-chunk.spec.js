// e2e/stale-chunk.spec.js — G1 (Andy oct3, Sentry JAVASCRIPT-REACT-H/J/K): after a deploy, an open tab
// lazy-loads a chunk that no longer exists ("Failed to fetch dynamically imported module:
// LeaderboardScreen-…", "reading 'default'"). The fix (lib/chunkReload.js lazyWithReload) treats a
// failed or empty chunk as a stale build: ONE guarded reload onto the new deploy (the service worker
// is asked to update first), the screen stays on its loading fallback meanwhile, never a broken screen.
// The proof Andy asked for: serve build A, open the app, swap the server to build B (A's LeaderboardScreen
// chunk is gone — 404, exactly like Vercel after a deploy), open the leaderboard → it recovers.
import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml', '.mp3': 'audio/mpeg' };

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

/** Build B = build A with the LeaderboardScreen chunk renamed (a deploy re-hashes it) + a marker. */
function makeBuilds() {
  const dist = path.resolve('dist');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'taw-chunk-'));
  const A = path.join(root, 'A');
  const B = path.join(root, 'B');
  fs.cpSync(dist, A, { recursive: true });
  fs.cpSync(dist, B, { recursive: true });
  const assets = path.join(B, 'assets');
  const old = fs.readdirSync(assets).find((f) => /^LeaderboardScreen-[\w-]+\.js$/.test(f));
  if (!old) throw new Error('no LeaderboardScreen chunk in dist/assets');
  const neu = 'LeaderboardScreen-DEPLOYB0.js';
  fs.renameSync(path.join(assets, old), path.join(assets, neu));
  for (const f of walk(B)) {
    if (!/\.(js|html|css|json)$/.test(f)) continue;
    const t = fs.readFileSync(f, 'utf8');
    if (t.includes(old)) fs.writeFileSync(f, t.split(old).join(neu));
  }
  const idx = path.join(B, 'index.html');
  fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace('</head>', '<meta name="taw-build" content="B"></head>'));
  return { A, B, old };
}

function serve(dirRef) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const file = path.join(dirRef.dir, decodeURIComponent(u.pathname));
    const exists = file.startsWith(dirRef.dir) && fs.existsSync(file) && fs.statSync(file).isFile();
    if (!exists && u.pathname.startsWith('/assets/')) { res.writeHead(404); res.end('gone'); return; } // a deploy removed it
    const f = exists ? file : path.join(dirRef.dir, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const CRASH_WATCH = () => {
  // records whether the generic crash screen EVER showed, even for a frame before a reload
  const seen = () => { try { if (document.body && /SOMETHING BROKE|THIS SCREEN BROKE/.test(document.body.innerText)) sessionStorage.setItem('crashSeen', '1'); } catch { /* */ } };
  new MutationObserver(seen).observe(document, { childList: true, subtree: true, characterData: true });
};

for (const sw of ['block', 'allow']) {
  test(`a tab left open across a deploy opens the leaderboard (service worker: ${sw}) — no broken screen`, async ({ browser }) => {
    test.setTimeout(90000);
    const { A, B } = makeBuilds();
    const dirRef = { dir: A };
    const server = await serve(dirRef);
    const base = `http://127.0.0.1:${server.address().port}`;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: sw });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    try {
      await page.addInitScript(CRASH_WATCH);
      await installBackendMock(page);
      await mockBoard(page, [{ username: 'Daan', level: 144, rebirths: 9, lifetime_words: 1196 }]);
      await page.addInitScript(() => { try { localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); } catch { /* */ } });
      await page.goto(`${base}/?portal=1`);
      await page.locator('.homepage-wrap').waitFor({ state: 'attached', timeout: 30000 });
      if (sw === 'allow') await page.waitForFunction(() => !!navigator.serviceWorker && !!navigator.serviceWorker.controller, null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(800);

      dirRef.dir = B; // THE DEPLOY: A's LeaderboardScreen chunk is gone from the server

      await page.locator('.homepage-nav-btn.is-board').click();
      // it recovers: either the chunk still came from a cache, or ONE reload put the tab on build B —
      // and at no point is the crash screen up
      await expect(page.getByText(/SOMETHING BROKE|THIS SCREEN BROKE/)).toHaveCount(0);
      const recovered = async () => {
        if (await page.locator('.lb-body').first().isVisible().catch(() => false)) return 'board';
        if ((await page.locator('meta[name="taw-build"]').count()) && (await page.locator('.homepage-wrap').count())) return 'reloaded';
        return null;
      };
      await expect.poll(recovered, { timeout: 30000 }).not.toBeNull();
      if ((await recovered()) === 'reloaded') {
        // on the new build the leaderboard opens
        await page.locator('.homepage-nav-btn.is-board').click();
        await expect.poll(recovered, { timeout: 20000 }).toBe('board');
      }
      await expect(page.getByText(/SOMETHING BROKE|THIS SCREEN BROKE/)).toHaveCount(0);
      expect(await page.evaluate(() => sessionStorage.getItem('crashSeen')), 'the crash screen never flashed').toBeNull();
      expect(errors.filter((e) => /reading 'default'|destructure/i.test(e)), 'no "reading default" crash').toEqual([]);
    } finally {
      await ctx.close();
      server.close();
    }
  });
}

test('with the one retry of this tab already spent, the stale screen says NEW VERSION — never the generic crash', async ({ browser }) => {
  test.setTimeout(90000);
  const { A, B } = makeBuilds();
  const dirRef = { dir: A };
  const server = await serve(dirRef);
  const base = `http://127.0.0.1:${server.address().port}`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  try {
    await page.addInitScript(CRASH_WATCH);
    await installBackendMock(page);
    await mockBoard(page, []);
    await page.addInitScript(() => { try { localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); sessionStorage.setItem('taw.chunkReload', '1'); } catch { /* */ } });
    await page.goto(`${base}/?portal=1`);
    await page.locator('.homepage-wrap').waitFor({ state: 'attached', timeout: 30000 });
    await page.waitForTimeout(800);
    dirRef.dir = B;
    await page.locator('.homepage-nav-btn.is-board').click();
    // either the chunk was already warm (the board opens) or the stale screen says what happened
    const outcome = async () => {
      if (await page.getByText(/NEW VERSION READY/).first().isVisible().catch(() => false)) return 'new-version';
      if (await page.locator('.lb-body').first().isVisible().catch(() => false)) return 'board';
      return null;
    };
    await expect.poll(outcome, { timeout: 20000 }).not.toBeNull();
    if ((await outcome()) === 'new-version') await expect(page.getByRole('button', { name: 'RELOAD NOW' })).toBeVisible();
    await expect(page.getByText(/SOMETHING BROKE|THIS SCREEN BROKE/)).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('crashSeen')), 'the generic crash screen never showed').toBeNull();
    test.info().annotations.push({ type: 'outcome', description: String(await outcome()) });
    console.log('[stale-chunk spent] outcome', await outcome());
  } finally {
    await ctx.close();
    server.close();
  }
});
