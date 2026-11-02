// artImmutable.test.js — build-failing guard for the long-cache headers (vercel.json serves
// public/ images, fonts and audio `immutable` for a year to cut CDN requests). A file whose
// content changes under the SAME name would stay stale for returning players, so changed art
// must ship under a new filename. New files must be recorded: `node scripts/art-manifest.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MANIFEST, cachedFiles, hashOf, keyOf } from '../../scripts/art-manifest.mjs';

const recorded = JSON.parse(readFileSync(MANIFEST, 'utf8'));

test('long-cached public files never change content under the same name', () => {
  const changed = [];
  const missing = [];
  for (const p of cachedFiles()) {
    const k = keyOf(p);
    if (!recorded[k]) missing.push(k);
    else if (recorded[k] !== hashOf(p)) changed.push(k);
  }
  assert.deepEqual(changed, [], `Changed under the same name (rename the file, e.g. foo-v2.webp, and update its references): ${changed.join(', ')}`);
  assert.deepEqual(missing, [], `New files not recorded — run: node scripts/art-manifest.mjs\n${missing.join('\n')}`);
});

test('vercel.json keeps HTML revalidating and only hashed/asset paths immutable', () => {
  const cfg = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  const sources = cfg.headers.map((h) => h.source);
  assert.ok(sources.includes('/assets/(.*)'));
  for (const s of sources) assert.ok(!/html/.test(s), `HTML must never be long-cached: ${s}`);
});
