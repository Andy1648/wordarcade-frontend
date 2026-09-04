// vercelJson.test.js — BUILD GUARD. vercel.json must be valid JSON, or Vercel
// rejects it with "Invalid vercel.json file provided" BEFORE building and every
// deployment errors. A stray backslash in the SPA rewrite regex ("\." instead of
// "\\.") shipped exactly that outage. This test fails the gate on an unparseable
// config, and pins the rewrite so /word-bomb, /chain, etc. keep serving index.html
// on refresh while real asset files are served as-is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const url = new URL('../../vercel.json', import.meta.url); // repo root
const raw = readFileSync(url, 'utf8');

test('vercel.json is valid JSON (invalid config = every deployment errors)', () => {
  assert.doesNotThrow(
    () => JSON.parse(raw),
    'vercel.json does not parse as JSON — Vercel will reject it before building',
  );
});

test('vercel.json SPA rewrite serves index.html for extension-less paths only', () => {
  const cfg = JSON.parse(raw);
  assert.ok(Array.isArray(cfg.rewrites) && cfg.rewrites.length > 0, 'rewrites[] missing');

  const spa = cfg.rewrites.find((r) => r.destination === '/index.html');
  assert.ok(spa, 'no rewrite to /index.html found');

  // The parsed `source` string is the regex Vercel compiles. Anchor it as Vercel does.
  const re = new RegExp('^' + spa.source + '$');

  // Extension-less client routes must rewrite to the SPA shell (no 404 on refresh).
  for (const p of ['/word-bomb', '/chain', '/', '/stats', '/shop']) {
    assert.ok(re.test(p), `${p} should rewrite to /index.html but did not match`);
  }
  // Anything with a file extension must be served as-is, never rewritten.
  for (const p of ['/assets/index-a1b2.js', '/favicon.ico', '/mascot.png', '/sw.js', '/run-mode.html']) {
    assert.ok(!re.test(p), `${p} must NOT rewrite to /index.html`);
  }
});
