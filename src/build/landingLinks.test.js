// src/build/landingLinks.test.js
//
// THE ARTICLE/PLAY INVARIANT.
//
// Vercel serves a STATIC FILE BEFORE it applies a rewrite. public/chain/index.html therefore wins
// over the SPA rewrite, and https://typeaword.com/chain returns an article with no #root on the
// page — the app never boots there. Every link that pointed at /chain (the share builders, the
// result-card deep links, the end-of-run "TRY THIS MODE" button, and the URL the app itself wrote
// into the address bar mid-run) was landing players on an article instead of in the game.
//
// The local gate CANNOT catch this: `vite preview` resolves /chain to the SPA fallback and only
// serves the article at /chain/ WITH a trailing slash, so e2e/router.spec.js asserted — and
// passed — the exact opposite of production behaviour. That is why this is a pure filesystem
// assertion with no server in it: it is true in every environment, or it is false in every one.
//
// RULE: a path the app navigates to must not be shadowed by a file in public/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

import { PLAY_PATHS } from '../router.js';
import { MODE_PATH } from '../progress/nextMode.js';
import { inviteLink, dailyLink, satRushLink, chainLink, fuseLink, modeShareLink } from '../share/links.js';

const PUBLIC = resolve(process.cwd(), 'public');

/** The static file Vercel would answer `pathname` with, or null if the request falls through to
 *  the SPA rewrite. Mirrors "static before rewrites": an exact file, or a directory's index.html. */
function staticShadow(pathname) {
  const clean = String(pathname).split('?')[0].split('#')[0];
  const rel = clean.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!rel) return null; // '/' is the SPA shell itself, never a public/ article
  const asFile = join(PUBLIC, rel);
  if (existsSync(asFile) && statSync(asFile).isFile()) return `public/${rel}`;
  const asDir = join(asFile, 'index.html');
  if (existsSync(asDir)) return `public/${rel}/index.html`;
  return null;
}

function pathOf(url) {
  return new URL(url, 'https://typeaword.com').pathname;
}

/** Every public/<dir>/index.html — the landing pages. */
function landingPages() {
  return readdirSync(PUBLIC)
    .filter((d) => statSync(join(PUBLIC, d)).isDirectory())
    .filter((d) => existsSync(join(PUBLIC, d, 'index.html')))
    .map((d) => ({ slug: d, file: join(PUBLIC, d, 'index.html') }));
}

/** The PLAY call-to-action hrefs on a landing page (class list starts with lp-btn). */
function ctaHrefs(html) {
  const out = [];
  const re = /<a\s+class="lp-btn[^"]*"\s+href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

test('the landing pages this invariant is about actually exist', () => {
  const slugs = landingPages().map((p) => p.slug).sort();
  for (const expected of ['chain', 'fuse', 'sat-rush', 'word-bomb', 'category-blitz']) {
    assert.ok(slugs.includes(expected), `public/${expected}/index.html is missing`);
  }
});

test('every /play path reaches the SPA (nothing in public/ shadows it)', () => {
  assert.ok(PLAY_PATHS.length >= 3, 'expected a play path per solo mode');
  for (const p of PLAY_PATHS) {
    assert.equal(staticShadow(p), null, `${p} is shadowed by ${staticShadow(p)} — it would serve an article, not the game`);
  }
});

test('every share / deep link opens the app, never an article', () => {
  const links = [
    ['satRushLink', satRushLink('https://typeaword.com')],
    ['chainLink', chainLink('https://typeaword.com')],
    ['fuseLink', fuseLink('https://typeaword.com')],
    ['dailyLink', dailyLink('https://typeaword.com')],
    ['inviteLink', inviteLink('WXYZ', 'https://typeaword.com')],
    ...['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse'].map((m) => [
      `modeShareLink(${m})`,
      modeShareLink(m, 'https://typeaword.com'),
    ]),
  ];
  for (const [name, url] of links) {
    const p = pathOf(url);
    assert.equal(staticShadow(p), null, `${name} -> ${url} is shadowed by ${staticShadow(p)}`);
  }
});

test('the end-of-run TRY-THIS-MODE button opens the app, never an article', () => {
  // TryModeRow does window.location.assign(pick.path) — a real page load, so a shadowed path here
  // drops the player onto an SEO page at the exact moment they asked to keep playing.
  for (const [mode, p] of Object.entries(MODE_PATH)) {
    assert.equal(staticShadow(p), null, `MODE_PATH[${mode}] = ${p} is shadowed by ${staticShadow(p)}`);
  }
});

test('each landing page PLAY button leads into the app, not to another landing page', () => {
  for (const { slug, file } of landingPages()) {
    const hrefs = ctaHrefs(readFileSync(file, 'utf8'));
    assert.ok(hrefs.length > 0, `public/${slug}/index.html has no lp-btn CTA`);
    for (const href of hrefs) {
      if (/^https?:/i.test(href)) continue; // off-site link, not a play CTA
      const p = pathOf(href);
      assert.equal(staticShadow(p), null, `public/${slug}: PLAY -> ${href} lands on ${staticShadow(p)}`);
    }
  }
});

test('a solo landing page sends you into ITS OWN mode, not the menu', () => {
  // Regression pin: all three SAT Rush CTAs pointed at '/', so the SAT article's PLAY button
  // dropped you on the mode-select menu and you still had to find SAT Rush yourself.
  for (const slug of ['chain', 'fuse', 'sat-rush']) {
    const hrefs = ctaHrefs(readFileSync(join(PUBLIC, slug, 'index.html'), 'utf8'));
    assert.ok(hrefs.length > 0, `public/${slug} has no CTA`);
    for (const href of hrefs) {
      assert.equal(pathOf(href), `/${slug}/play`, `public/${slug}: PLAY -> ${href}, expected /${slug}/play`);
    }
  }
});
