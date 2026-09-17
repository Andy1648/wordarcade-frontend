// routeShadow.test.js — THE GUARD FOR THE BUG THAT SHIPPED.
//
// WHAT WENT WRONG: every mode has an SEO landing page at `public/<mode>/index.html`. On Vercel the
// FILESYSTEM is matched BEFORE `vercel.json`'s SPA rewrite, so `/chain` serves that HTML file and the
// single-page app NEVER RECEIVES THE PATH. The router still listed `/chain` as the CHAIN deep link —
// dead code in production. Nothing failed: `vite preview` resolves `/chain` to the SPA (the opposite
// of Vercel), so the e2e suite asserted a route that could not work on the deploy, and passed.
//
// WHAT THIS ASSERTS, from the two sources of truth (the router's tables and the actual files on
// disk) rather than from a hand-written list that can drift:
//   1. NO path the SPA claims is shadowed by a `public/<path>/index.html`. A static file at the same
//      path always wins on Vercel, so a collision means the route is unreachable in production.
//   2. Every landing page HAS a `/play` deep link the SPA owns, so the acquisition path
//      (crawled landing page -> PLAY button -> in the mode) is never half-built.
//   3. Every landing page's PLAY button actually points at that `/play` path — the link is the
//      handover, and it used to point at `/` (SAT Rush) or `/?chain=1` (CHAIN/FUSE).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { LANDING_MODES, PLAY_PATHS, ROUTE_PATHS, canonicalPathForView } from './router.js';

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const landingFile = (mode) => resolve(PUBLIC_DIR, mode, 'index.html');

// The paths for which the APP IS THE ONLY CORRECT ANSWER: every play path, plus the canonical URL
// each deep-linkable view puts in the address bar. One of these being shadowed is the production bug.
//
// NOT included, deliberately: the bare `/<mode>` aliases still listed in MENU_PATHS and in the
// router's fallback table. Those ARE shadowed on Vercel and that is fine — they are landing pages,
// and the aliases exist only for the paths that still reach the app anyway (dev, and the service
// worker's navigateFallback, which hands any navigation the app shell). They are best-effort; the
// paths below are load-bearing.
const SPA_OWNED = [...new Set([...PLAY_PATHS, ...['home', 'sat-rush', 'chain', 'fuse'].map(canonicalPathForView)])];

test('no SPA route is shadowed by a static landing page (Vercel serves the file, not the app)', () => {
  // Sanity: the menu path aliases must not be *canonical* for anything — that was the old bug shape.
  assert.equal(canonicalPathForView('home'), '/');
  for (const path of SPA_OWNED) {
    if (path === '/') continue; // the root index.html IS the app
    const shadow = resolve(PUBLIC_DIR, '.' + path, 'index.html');
    assert.equal(
      existsSync(shadow),
      false,
      `${path} is an SPA route but public${path}/index.html exists — Vercel serves the file and the app never sees the path`
    );
  }
});

test('every landing page has a /play deep link, and every /play path has a landing page', () => {
  for (const mode of LANDING_MODES) {
    assert.ok(existsSync(landingFile(mode)), `public/${mode}/index.html is missing`);
    assert.ok(PLAY_PATHS.includes(`/${mode}/play`), `/${mode}/play is not a declared play path`);
  }
  for (const path of PLAY_PATHS) {
    const mode = path.slice(1, -'/play'.length);
    assert.ok(existsSync(landingFile(mode)), `${path} has no landing page at public/${mode}/index.html`);
  }
});

test("each landing page's PLAY button hands off to that mode's /play path", () => {
  for (const mode of LANDING_MODES) {
    const html = readFileSync(landingFile(mode), 'utf-8');
    const ctas = [...html.matchAll(/<a class="lp-btn[^"]*" href="([^"]*)">PLAY[^<]*<\/a>/g)];
    assert.ok(ctas.length > 0, `${mode} landing page has no PLAY button`);
    for (const [, href] of ctas) {
      assert.equal(href, `/${mode}/play`, `${mode} landing page PLAY button points at ${href}`);
    }
  }
});

test('the sitemap lists the crawlable landing pages, never the /play app routes', () => {
  for (const path of ROUTE_PATHS) {
    assert.equal(path.endsWith('/play'), false, `${path} is an app route and must not be crawlable`);
  }
  for (const mode of LANDING_MODES) {
    assert.ok(ROUTE_PATHS.includes(`/${mode}`), `/${mode} is missing from the crawlable routes`);
  }
});
