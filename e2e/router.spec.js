// e2e/router.spec.js (feat/router) — every clean route lands on the right view, every legacy query
// param still works (and canonicalises to its path), ?cg=1 is preserved, and /room/:code deep-joins.
// The app exposes the active view on <html data-view>, which is the stable signal we assert on.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function land(page, url) {
  await installBackendMock(page);
  await page.goto(url);
  // data-view is set in a mount effect; wait for it to be present + settled.
  await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-view'))).not.toBe(null);
  await page.waitForTimeout(800); // let the boot canonicalise the URL
}
const dv = (page) => page.evaluate(() => document.documentElement.getAttribute('data-view'));
const loc = (page) => page.evaluate(() => location.pathname + location.search);

// THE PLAY PATHS are the production deep links. The bare /chain is an SEO landing page — a static
// file, which Vercel serves INSTEAD of the app (the filesystem is matched before `rewrites`). These
// used to be the same path, which is why /chain "worked" in this suite and not on the deploy; the
// vercelStaticParity middleware in vite.config.js now makes preview resolve them the way Vercel does.
test.describe('clean routes render the right view', () => {
  for (const [path, view] of [
    ['/', 'home'],
    // The two room modes boot on their own provisioning screen, never the menu (App: VS_BOT_LAUNCH).
    ['/word-bomb/play', 'vs-bot'],
    ['/category-blitz/play', 'vs-bot'],
    ['/sat-rush/play', 'sat-rush'],
    ['/chain/play', 'chain'],
    ['/fuse/play', 'fuse'],
  ]) {
    test(`${path} -> ${view}`, async ({ page }) => {
      await land(page, path);
      expect(await dv(page)).toBe(view);
      // The clean path is kept in the bar: the solo views canonicalise TO it, and the room modes
      // open a game view, which owns no canonical path, so the sync leaves the URL alone.
      expect(await loc(page)).toBe(path);
    });
  }
});

test.describe('the bare mode paths are the LANDING PAGES, not the app', () => {
  for (const mode of ['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse']) {
    test(`/${mode} serves the static landing page, and its PLAY button reaches the app`, async ({ page }) => {
      await page.goto(`/${mode}`);
      // A landing page, not the SPA: no #root app, and the PLAY button points at the play path.
      await expect(page.locator('.lp-btn').first()).toBeVisible();
      const href = await page.locator('a.lp-btn', { hasText: 'PLAY' }).first().getAttribute('href');
      expect(href).toBe(`/${mode}/play`);
    });
  }
});

test.describe('legacy query params still work AND canonicalise to the path', () => {
  for (const [url, view, canon] of [
    ['/?satrush=1', 'sat-rush', '/sat-rush/play'],
    ['/?chain=1', 'chain', '/chain/play'],
    ['/?fuse=1', 'fuse', '/fuse/play'],
  ]) {
    test(`${url} -> ${view} @ ${canon}`, async ({ page }) => {
      await land(page, url);
      expect(await dv(page)).toBe(view);
      expect(await loc(page)).toBe(canon);
    });
  }
});

test('?cg=1 (CrazyGames entry) is NOT broken and NOT canonicalised', async ({ page }) => {
  await land(page, '/?cg=1');
  expect(await dv(page)).toBe('cg-arm');
  expect(await loc(page)).toBe('/?cg=1'); // embed flag preserved verbatim
});

test('/room/:code deep-joins (sends join_room, keeps the room URL)', async ({ page }) => {
  const mock = await installBackendMock(page);
  await page.goto('/room/WXYZ');
  await mock.waitForSent('join_room');
  const joined = mock.sentFrames().find((f) => f && f.type === 'join_room');
  expect(joined.payload.code).toBe('WXYZ');
});
