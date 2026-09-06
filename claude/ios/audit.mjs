// audit.mjs — iOS Safari (WebKit) audit for TYPE A WORD. Boots every screen in Playwright's WebKit at
// an iPhone viewport, collects console errors + capability support, and screenshots each. Run against
// a running preview server (http://localhost:4173). Usage: node claude/ios/audit.mjs
import { webkit, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173';

const SCREENS = [
  ['menu', '/?portal=1'],
  ['chain', '/chain?portal=1'],
  ['fuse', '/fuse?portal=1'],
  ['sat', '/sat-rush?portal=1'],
];

const iphone = devices['iPhone 13'];
const b = await webkit.launch();
const ctx = await b.newContext({ ...iphone });
const page = await ctx.newPage();
const report = [];

// Capability probe on the first load — the WebKit engine's real feature support.
async function probe() {
  return page.evaluate(() => ({
    dvh: (window.CSS && CSS.supports && CSS.supports('height', '100dvh')) || false,
    svh: (window.CSS && CSS.supports && CSS.supports('height', '100svh')) || false,
    visualViewport: 'visualViewport' in window,
    audioContext: !!(window.AudioContext || window.webkitAudioContext),
    serviceWorker: 'serviceWorker' in navigator,
    ua: navigator.userAgent,
    innerH: window.innerHeight,
    vvH: window.visualViewport ? Math.round(window.visualViewport.height) : null,
  }));
}

for (const [name, url] of SCREENS) {
  const errors = [];
  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500); // dictionary load + mount
  // check for horizontal overflow (a common iOS layout break) + the app root height vs viewport
  const layout = await page.evaluate(() => {
    const de = document.documentElement;
    return {
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      hOverflow: de.scrollWidth > de.clientWidth + 1,
      rootH: document.getElementById('root')?.getBoundingClientRect().height || 0,
      innerH: window.innerHeight,
    };
  });
  const cap = name === 'menu' ? await probe() : null;
  await page.screenshot({ path: path.join(OUT, `wk-${name}.png`) });
  report.push({ name, errors, layout, cap });
  console.log(`[${name}] errors=${errors.length} hOverflow=${layout.hOverflow} rootH=${layout.rootH} innerH=${layout.innerH}`);
  if (errors.length) console.log('   ', errors.slice(0, 3).join(' | '));
}

console.log('\n=== CAPABILITIES (WebKit) ===');
console.log(JSON.stringify(report.find((r) => r.cap)?.cap, null, 2));
fs.writeFileSync(path.join(__dirname, 'audit-result.json'), JSON.stringify(report, null, 2));
await b.close();
