// e2e/payload-behaviour.spec.js — the payload diet must not cost behaviour.
// The audio element is now built on the first gesture instead of during render, so
// the thing to prove is that the music STILL LOADS once a gesture happens — a diet
// that silently kills the soundtrack is not a win.
import { test, expect } from '@playwright/test';

function audioWatcher(page) {
  const hits = [];
  page.on('request', (r) => {
    if (/\.mp3(\?|$)/i.test(r.url())) hits.push(r.url());
  });
  return hits;
}

test('no audio before a gesture, but the music DOES load on the first gesture', async ({ page }) => {
  const hits = audioWatcher(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  expect(hits, 'audio must not be requested before any gesture').toHaveLength(0);

  // A real gesture: the document-level pointerdown listener in App.jsx is what
  // starts the music on a no-splash load.
  await page.mouse.click(5, 5);
  await expect.poll(() => hits.length, { timeout: 10_000, message: 'music never loaded after a gesture' })
    .toBeGreaterThan(0);
  expect(hits[0]).toContain('/firecracker.mp3');
});

test('the mascot takes AVIF and reserves its box before the image arrives', async ({ page }) => {
  const got = [];
  page.on('response', (r) => {
    if (/mascot-/.test(r.url())) got.push(new URL(r.url()).pathname);
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  const img = page.locator('.mascot-img').first();
  await expect(img).toBeVisible();

  // The <picture> must actually resolve to AVIF in a browser that supports it.
  const chosen = await img.evaluate((el) => el.currentSrc);
  expect(chosen, `currentSrc was ${chosen}`).toMatch(/\.avif$/);

  // width/height attributes present => the browser knows the aspect ratio up front.
  const attrs = await img.evaluate((el) => ({ w: el.getAttribute('width'), h: el.getAttribute('height'), nw: el.naturalWidth, nh: el.naturalHeight }));
  expect(attrs.w).toBe('500');
  expect(attrs.h).toBe('500');
  expect(attrs.nw).toBe(500);
  expect(attrs.nh).toBe(500);
  console.log('MASCOT REQUESTS:', JSON.stringify(got));
});
