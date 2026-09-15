// e2e/boot-payload.spec.js — the BOOT payload, measured as bytes ON THE WIRE.
//
// WHY THIS IS NOT JUST response.body().length: that returns the DECODED body. A CDN
// sends text assets brotli-compressed, so decoded bytes overstate the real transfer by
// several times. This spec records what the boot actually requests (empty cache, no
// gesture), then prices each response the way Vercel serves it:
//     text (js/css/html/svg/json)  -> brotli quality 11 of the dist file
//     media (avif/webp/png/woff2)  -> the file as-is; it is already compressed and
//                                     CDNs do not re-compress it
// vite preview serves everything uncompressed, so the sizes must be computed rather
// than read off the local socket. The real deployed preview is checked separately.
//
// Run: PW_PORT=4195 npx playwright test boot-payload --workers=1 --reporter=line
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = 'claude/boot-payload';
fs.mkdirSync(OUT, { recursive: true });

const IMAGE_BUDGET = 60_000; // the three boot mascot poses, together — THIS branch owns it

// The 250,000 goal for the whole boot CANNOT be judged on this branch alone, and the gate
// says so rather than failing misleadingly. This branch is cut from main, where two much
// larger things are still unfixed and both belong to PR #34 (perf/payload-diet):
//   - /firecracker.mp3 is still eagerly preloaded during render: ~4.29MB before any gesture
//   - Mascot.jsx still points at the PNGs: a further 189,280
// Measured here off main: 4,846,172. Measured with #34 merged in: see claude/boot-payload/.
// So the total is reported and RATCHETED, never silently passed.
const BOOT_BUDGET = 250_000;
const BOOT_RATCHET = 4_900_000; // off main, dominated by #34's two unfixed items

const TEXT = /\.(js|mjs|css|html|svg|json|txt)$/i;
const brotliCache = new Map();

function wireBytes(pathname) {
  // dist is the artifact the CDN serves; map the URL path onto it. A bare '/' (and any
  // SPA route) is served index.html, so resolve directories to their index.
  let rel = pathname.replace(/^\//, '');
  let file = path.join('dist', rel);
  if (rel === '' || (fs.existsSync(file) && fs.statSync(file).isDirectory())) {
    file = path.join('dist', rel, 'index.html');
    pathname = '/index.html';
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return null;
  if (brotliCache.has(file)) return brotliCache.get(file);
  const raw = fs.readFileSync(file);
  const size = TEXT.test(pathname)
    ? zlib.brotliCompressSync(raw, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length },
      }).length
    : raw.length;
  brotliCache.set(file, size);
  return size;
}

test('boot payload on an empty cache, before any gesture', async ({ page }) => {
  const seen = [];
  page.on('response', (res) => {
    const url = res.url();
    if (!url.includes('localhost')) return; // third-party fonts/analytics are not this budget
    seen.push(new URL(url).pathname);
  });

  // A fresh Playwright context is already an empty cache + empty storage — a genuine
  // hard refresh with nothing warm. Do NOT wait for networkidle here: the boot screen
  // runs a FIXED 1900ms timeline and hands off to the splash on its own, so waiting for
  // the network to settle first can step straight past the thing being measured (it did).
  await page.goto('/', { waitUntil: 'commit' });

  // The boot screen must actually be on screen, and taking AVIF.
  const img = page.locator('.loading-mascot').first();
  await expect(img).toBeVisible({ timeout: 5000 });
  const chosen = await img.evaluate((el) => el.currentSrc);
  expect(chosen, `loading mascot currentSrc was ${chosen}`).toMatch(/\.avif$/);
  const box = await img.boundingBox();
  expect(box.width, 'loading mascot must have real layout size').toBeGreaterThan(20);
  expect(box.height).toBeGreaterThan(20);
  const attrs = await img.evaluate((el) => ({ w: el.getAttribute('width'), h: el.getAttribute('height'), nw: el.naturalWidth }));
  expect(attrs.w).toBe('500');
  expect(attrs.h).toBe('500');
  expect(attrs.nw).toBe(500);
  await page.screenshot({ path: `${OUT}/boot-screen.png` });

  // Let the full boot timeline run (idle -> panic -> celebrate) so every pose it swaps
  // through is counted, then let the rest of the boot settle.
  await page.waitForTimeout(4000);
  await page.waitForLoadState('networkidle').catch(() => {});

  const uniq = [...new Set(seen)];
  const rows = uniq
    .map((p) => ({ p, bytes: wireBytes(p) }))
    .filter((r) => r.bytes !== null)
    .sort((a, b) => b.bytes - a.bytes);

  const total = rows.reduce((a, r) => a + r.bytes, 0);
  // Attribute mascot bytes by FORMAT, because two different components fetch them and
  // the extension says which: LoadingScreen takes avif/webp after this change, while
  // Mascot.jsx still takes png until PR #34 lands. Without this split the two get
  // conflated and the branch looks like it did nothing.
  const mascotRows = rows.filter((r) => /mascot-/.test(r.p));
  const bootPoses = mascotRows.filter((r) => /\.(avif|webp)$/.test(r.p));
  const legacyPng = mascotRows.filter((r) => /\.png$/.test(r.p));
  const mascotTotal = bootPoses.reduce((a, r) => a + r.bytes, 0);
  const legacyTotal = legacyPng.reduce((a, r) => a + r.bytes, 0);
  const missed = uniq.filter((p) => wireBytes(p) === null);

  const md = [
    '# Boot payload — bytes on the wire (brotli for text, as-is for media)',
    '',
    `TOTAL: ${total.toLocaleString()} bytes   (budget ${BOOT_BUDGET.toLocaleString()})`,
    `BOOT MASCOTS (avif/webp, LoadingScreen): ${mascotTotal.toLocaleString()} bytes   (budget ${IMAGE_BUDGET.toLocaleString()})`,
    `STILL PNG (Mascot.jsx, until PR #34): ${legacyTotal.toLocaleString()} bytes`,
    '',
    '## every response, largest first',
    ...rows.map((r) => `  ${String(r.bytes).padStart(8)}  ${r.p}`),
    '',
    `## not found in dist (not priced): ${missed.length ? missed.join(', ') : 'none'}`,
  ].join('\n');
  fs.writeFileSync(`${OUT}/boot.md`, md + '\n');
  console.log('\n' + md + '\n');

  // The criterion this branch actually owns.
  expect(mascotTotal, `boot mascots ${mascotTotal} exceeds ${IMAGE_BUDGET}`).toBeLessThan(IMAGE_BUDGET);
  // And the PNG path must be GONE from the boot screen specifically: if LoadingScreen ever
  // reverts to <img src=".png">, mascotTotal would still look fine while the bytes came back.
  expect(bootPoses.length, 'the boot screen must fetch avif/webp, not png').toBeGreaterThan(0);
  expect(total, `boot payload ${total} regressed past the ratchet ${BOOT_RATCHET}`).toBeLessThan(BOOT_RATCHET);
  if (total >= BOOT_BUDGET) {
    console.log(`
NOTE: total ${total.toLocaleString()} is above the ${BOOT_BUDGET.toLocaleString()} goal. Off main that is ${legacyTotal.toLocaleString()} of Mascot.jsx PNG + ~4.29MB of eagerly-preloaded audio, both owned by PR #34.`);
  }
});
