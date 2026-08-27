// generationAssets.test.js — BUILD-TIME SAFETY GATE (fix/dict-safety).
// Fails the suite if any GENERATION/DISPLAY asset contains a slur or profanity,
// or if any ACCEPTANCE asset contains a slur. This is the regression guard that
// keeps the public-wordlist sources from re-leaking blocked terms into what the
// game shows (or accepts) to high-school players.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isBlockedForDisplay, isSlur } from './blockedTerms.js';

const rel = (p) => fileURLToPath(new URL(p, import.meta.url));
const tokens = (p) => readFileSync(rel(p), 'utf8').split(/\s+/).filter(Boolean);

// ---- GENERATION / DISPLAY assets: NO blocked term of any kind ----
test('words.recall.txt (CHAIN common-word supply / top-3k DISPLAY) has no blocked term', () => {
  const bad = tokens('../solo/words.recall.txt').filter(isBlockedForDisplay);
  assert.equal(bad.length, 0, `recall displays blocked terms: ${bad.slice(0, 5).join(', ')}`);
});

test('satRush/words.json (SAT words DISPLAY) has no blocked term', () => {
  const data = JSON.parse(readFileSync(rel('../data/satRush/words.json'), 'utf8'));
  const list = Array.isArray(data) ? data : (data.words || Object.values(data).flat());
  const bad = list
    .map((e) => (typeof e === 'string' ? e : e.word))
    .filter((w) => w && isBlockedForDisplay(w));
  assert.equal(bad.length, 0, `SAT words display blocked terms: ${bad.slice(0, 5).join(', ')}`);
});

test('fragmentPools.json (fragments DISPLAY) has no blocked fragment', () => {
  const pools = JSON.parse(readFileSync(rel('../solo/fragmentPools.json'), 'utf8'));
  const frags = [];
  for (const v of Object.values(pools)) frags.push(...String(v).trim().split(/\s+/));
  const bad = frags.filter(isBlockedForDisplay);
  assert.equal(bad.length, 0, `fragment pool shows blocked terms: ${bad.slice(0, 5).join(', ')}`);
});

// ---- ACCEPTANCE assets: NO slur (mild profanity may remain accepted) ----
test('words.accept.txt (acceptance) contains no slur', () => {
  const bad = tokens('../solo/words.accept.txt').filter(isSlur);
  assert.equal(bad.length, 0, `accept list would score slurs: ${bad.slice(0, 5).join(', ')}`);
});

test('words.accept-ext.txt (extended acceptance) contains no slur', () => {
  const bad = tokens('../solo/words.accept-ext.txt').filter(isSlur);
  assert.equal(bad.length, 0, `accept-ext would score slurs: ${bad.slice(0, 5).join(', ')}`);
});
