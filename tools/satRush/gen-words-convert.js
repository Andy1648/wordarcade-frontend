// gen-words-convert.js  — STAGE 3 of the SAT Rush word pipeline.
//
// Merges the verified batch (.scratch/passing.json) into the shipped
// src/data/satRush/words.json, sorted stably by (tier asc, word asc) so the
// diff stays readable. Refuses to introduce a duplicate word (belt-and-braces;
// verify already guarantees this) and re-runs the parity checks the contract
// test enforces before writing, so a bad merge can never reach disk.
//
// Run:  node tools/satRush/gen-words-convert.js
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRATCH = join(HERE, '.scratch');
const WORDS_PATH = join(HERE, '..', '..', 'src', 'data', 'satRush', 'words.json');

const lower = (s) => String(s).toLowerCase();

const existing = JSON.parse(readFileSync(WORDS_PATH, 'utf8'));
const passing = JSON.parse(readFileSync(join(SCRATCH, 'passing.json'), 'utf8'));

const beforeByTier = {};
for (const r of existing) beforeByTier[r.tier] = (beforeByTier[r.tier] || 0) + 1;

// Merge with a hard stop on any duplicate word or sentence.
const words = new Map(existing.map((r) => [lower(r.word), r]));
const sentences = new Map(existing.map((r, i) => [lower(r.context).trim(), `existing "${r.word}"`]));
const added = [];
for (const r of passing) {
  const w = lower(r.word);
  if (words.has(w)) throw new Error(`convert aborted: duplicate word "${r.word}" already present`);
  const s = lower(r.context).trim();
  if (sentences.has(s)) throw new Error(`convert aborted: duplicate sentence for "${r.word}" (also ${sentences.get(s)})`);
  words.set(w, r);
  sentences.set(s, `new "${r.word}"`);
  added.push(r);
}

// Clean EVERY row's alts against the merged headword set. Adding a new headword
// can invalidate an EXISTING row's alt (e.g. old "desultory" listed "haphazard"
// as an alt, and this batch adds "haphazard" as its own word) — the contract's
// "no alt is itself a headword" rule would then fail. Strip any such alt (and,
// belt-and-braces, wrong-length or self alts) from all rows, reporting drops.
const headwords = new Set([...words.keys()]);
const altScrub = [];
for (const r of words.values()) {
  const kept = [];
  const dropped = [];
  for (const a of r.alts) {
    const al = lower(a);
    if (String(a).length !== r.word.length) dropped.push(`${a} (len)`);
    else if (al === lower(r.word)) dropped.push(`${a} (self)`);
    else if (headwords.has(al)) dropped.push(`${a} (headword)`);
    else if (kept.some((x) => lower(x) === al)) dropped.push(`${a} (dup)`);
    else kept.push(a);
  }
  if (dropped.length) {
    altScrub.push(`  ${r.word}: dropped ${dropped.join(', ')}`);
    r.alts = kept;
  }
}

const merged = [...words.values()].sort(
  (a, b) => a.tier - b.tier || lower(a.word).localeCompare(lower(b.word))
);

writeFileSync(WORDS_PATH, JSON.stringify(merged, null, 2) + '\n');

const afterByTier = {};
for (const r of merged) afterByTier[r.tier] = (afterByTier[r.tier] || 0) + 1;

console.log(`gen-words-convert: merged ${added.length} new rows -> src/data/satRush/words.json`);
console.log(`  total: ${existing.length} -> ${merged.length}`);
console.log('  before per tier:', JSON.stringify(beforeByTier));
console.log('  after  per tier:', JSON.stringify(afterByTier));
if (altScrub.length) {
  console.log(`  scrubbed alts on ${altScrub.length} row(s) that collided with the merged headword set:`);
  for (const line of altScrub) console.log(line);
}
