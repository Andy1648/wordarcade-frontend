// scripts/build-sat-costs.mjs — BUILD-TIME pass over src/data/satRush/words.json.
//
// Run it, commit the result. Nothing here runs in the app: the game reads the `costMs` field, it
// never recomputes it, so the cost model can't drift per device or cost a millisecond at runtime.
//
//   node scripts/build-sat-costs.mjs           rewrite words.json in place
//   node scripts/build-sat-costs.mjs --dry     report only, write nothing
//
// TWO JOBS
//  1. TRIM long contexts. A 196-character sentence is a reading-speed test wearing a vocabulary
//     test's clothes — it makes the x5 ante unreachable however well you know the word. Any
//     context over MAX_CONTEXT_CHARS is cut at the last sentence boundary that fits.
//  2. COMPUTE costMs — how long the card actually asks for, at the measured rates:
//       reading  200 wpm = 16.7 chars/sec   over gloss + context
//       typing    35 wpm =  2.9 chars/sec   over the word
//     costMs = round(1000*(gloss.length + context.length)/16.7 + 1000*word.length/2.9)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, '../src/data/satRush/words.json');

export const MAX_CONTEXT_CHARS = 140;
export const READ_CHARS_PER_SEC = 16.7; // 200 wpm
export const TYPE_CHARS_PER_SEC = 2.9; // 35 wpm

/** costMs for a card — the single formula, exported so the tests use it rather than a copy. */
export function costMsFor(card) {
  const read = ((card.gloss || '').length + (card.context || '').length) / READ_CHARS_PER_SEC;
  const type = (card.word || '').length / TYPE_CHARS_PER_SEC;
  return Math.round(1000 * read + 1000 * type);
}

/**
 * Trim a context to at most MAX_CONTEXT_CHARS, cutting at the LAST sentence boundary that fits.
 * If no boundary lands in a sensible place (a single long sentence), fall back to a hard cut at
 * the last word boundary so we never slice a word in half.
 */
export function trimContext(text, max = MAX_CONTEXT_CHARS) {
  const t = String(text || '');
  if (t.length <= max) return t;
  // THE BLANK IS SACRED. Every context carries exactly one `___` — it is the prompt, and a card
  // whose blank got cut is unplayable. ("affluent" has its blank at char 139 of 143, so a naive
  // cut at 140 removed it; the schema test caught that.) Never return a string that drops it: if
  // the blank sits past the cap, leave the context untouched and let the caller report it.
  const blank = t.indexOf('___');
  if (blank !== -1 && blank + 3 > max) return t;
  const head = t.slice(0, max);
  const boundary = Math.max(head.lastIndexOf('.'), head.lastIndexOf('!'), head.lastIndexOf('?'));
  // A boundary in the first few words would leave a stub, so require it past a third of the cap.
  if (boundary > max / 3 && boundary > blank + 2) return t.slice(0, boundary + 1).trimEnd();
  const space = head.lastIndexOf(' ');
  const cut = space > max / 3 && space > blank + 2 ? head.slice(0, space) : head;
  return cut.trimEnd();
}

const dry = process.argv.includes('--dry');
const cards = JSON.parse(readFileSync(DATA, 'utf8'));

const trimmed = [];
const skipped = [];
for (const card of cards) {
  const before = card.context || '';
  if (before.length > MAX_CONTEXT_CHARS) {
    const after = trimContext(before);
    if (after === before) skipped.push({ word: card.word, len: before.length });
    else {
      trimmed.push({ word: card.word, from: before.length, to: after.length, after });
      card.context = after;
    }
  }
  card.costMs = costMsFor(card);
}

const costs = cards.map((c) => c.costMs).sort((a, b) => a - b);
const at = (p) => costs[Math.min(costs.length - 1, Math.floor(costs.length * p))];

console.log(`SAT RUSH cost build — ${cards.length} cards`);
console.log('');
console.log(`TRIMMED ${trimmed.length} context${trimmed.length === 1 ? '' : 's'} over ${MAX_CONTEXT_CHARS} chars:`);
for (const t of trimmed) {
  console.log(`  ${t.word.padEnd(16)} ${String(t.from).padStart(3)} -> ${String(t.to).padStart(3)} chars`);
  console.log(`      "${t.after}"`);
}
if (!trimmed.length) console.log('  (none)');
if (skipped.length) {
  console.log('');
  console.log(`LEFT ALONE — trimming would have cut the ___ blank (${skipped.length}):`);
  for (const sk of skipped) console.log(`  ${sk.word.padEnd(16)} ${sk.len} chars, blank near the end`);
}
console.log('');
console.log(`costMs   p10 ${at(0.1)}  p50 ${at(0.5)}  p90 ${at(0.9)}  max ${costs[costs.length - 1]}`);
console.log(`over 12000ms: ${costs.filter((c) => c > 12000).length} card(s)`);

if (dry) {
  console.log('\n--dry: nothing written.');
} else {
  writeFileSync(DATA, `${JSON.stringify(cards, null, 2)}\n`);
  console.log(`\nwrote ${DATA}`);
}
