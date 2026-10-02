// claude/wordlists/build-common.mjs — STEP 55: write src/solo/words.common.txt.
//
// words.common.txt = every hand-curated probe word (categories.mjs) that the FIRST-RUN solo accept
// set rejects, after the safety filters. It is a SEPARATE hand-curated asset (like words.famous.txt)
// rather than an edit to words.accept.txt because the generated lists are rebuilt from word-list ∩
// the frequency corpus by scripts/build-words.mjs — and word-list is lowercase-only, so it has no
// "october"/"london"; a regeneration would silently drop anything hand-appended there.
//
// SAFETY: a word is DROPPED (and printed) if isBlockedForDisplay (slur OR profanity, the strict
// display tier — stricter than the acceptance tier, which only drops slurs) or isNameBlocked
// (leaderboard name filter: exact term + leet/ROOT substring match) flags it.
//
// Run (from repo root):  node claude/wordlists/build-common.mjs
// then measure:          node claude/wordlists/measure.mjs claude/wordlists/after.json
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { CATEGORIES } from './categories.mjs';
import { isBlockedForDisplay, isSlur } from '../../src/moderation/blockedTerms.js';
import { isNameBlocked } from '../../src/leaderboard/nameFilter.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOLO = join(ROOT, 'src', 'solo');
const read = (f) => readFileSync(join(SOLO, f), 'utf8');

const firstRun = new Set(read('words.recall.txt').split(' '));
for (const w of read('words.accept.txt').split(' ')) firstRun.add(w);
for (const w of read('words.famous.txt').split(/\s+/)) if (w) firstRun.add(w.toLowerCase());

const out = [];
const seen = new Set();
const dropped = [];
const perCat = {};
for (const [cat, words] of Object.entries(CATEGORIES)) {
  perCat[cat] = 0;
  for (const w of words) {
    if (!/^[a-z]{3,}$/.test(w) || seen.has(w) || firstRun.has(w)) continue;
    seen.add(w);
    if (isSlur(w) || isBlockedForDisplay(w) || isNameBlocked(w)) { dropped.push(`${w} (${cat})`); continue; }
    out.push(w);
    perCat[cat]++;
  }
}
writeFileSync(join(SOLO, 'words.common.txt'), out.join('\n') + '\n');
console.log(`words.common.txt: ${out.length} words`, perCat);
console.log(`dropped by safety filters: ${dropped.length ? dropped.join(', ') : '(none)'}`);
