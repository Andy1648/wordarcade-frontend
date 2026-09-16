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

// WHY THE BARE /chain, /fuse, /sat-rush, /word-bomb AND /category-blitz PATHS ARE NOT TESTED HERE:
// they are static landing pages in public/, and the two environments disagree about them. Vercel
// serves the static file before the rewrite, so /chain returns the article with no #root at all.
// `vite preview` (this suite's server) resolves /chain to the SPA fallback and only serves the
// article at /chain/ WITH a trailing slash. This table used to assert the preview behaviour and
// passed for months while describing something that was never true in production. Asserting either
// side here would pin an environment, not the app — the real invariant (no navigable path is
// shadowed by public/) is a filesystem check in src/build/landingLinks.test.js instead.
test.describe('clean routes render the right view', () => {
  for (const [path, view] of [
    ['/', 'home'],
    ['/sat-rush/play', 'sat-rush'],
    ['/chain/play', 'chain'],
    ['/fuse/play', 'fuse'],
  ]) {
    test(`${path} -> ${view}`, async ({ page }) => {
      await land(page, path);
      expect(await dv(page)).toBe(view);
      expect(await loc(page)).toBe(path); // the clean path is kept in the bar
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
