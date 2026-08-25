// scripts/build-accept-ext.mjs
// Builds the ACCEPTANCE-ONLY extension asset — src/solo/words.accept-ext.txt — and
// re-runs the CHAIN s→s bank exploit against the enlarged accept set.
//
// WHY: the shipped accept set (RECALL ∪ words.accept.txt ≈ 88k) is FREQUENCY-filtered
// (only word-list words that also appear in Norvig's count_1w corpus). ~180k real
// word-list words (3-15, a-z) are therefore rejected as "NOT IN OUR WORD LIST" even
// though they are valid English. This extension = every word-list word (3-15, a-z) NOT
// already accepted, used ONLY to validate human input (never for generation). Generation
// (words.recall.txt, fragment pools, top-3000, reveal words) is untouched.
//
// Source: the `word-list` npm package (v4.1.0, MIT) — the atebits/Words en.txt list,
// a permissive/public real-word dictionary (the same MEMBERSHIP filter build-words.mjs
// already uses). Filtered a-z, length 3-15, lowercase, deduped.
//
// Run:  node scripts/build-accept-ext.mjs
// Regenerates the committed asset and prints the counts, brotli size, and the CHAIN
// bank-exploit link count. Do NOT wire it into the build.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { brotliCompressSync, constants as zc } from 'node:zlib';
import { createChainEngine } from '../src/solo/chain.js';
import { mulberry32 } from '../src/solo/shared.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SOLO = join(ROOT, 'src', 'solo');
const AZ = /^[a-z]+$/;
const MIN = 3;
const MAX = 15;

// ---- 1. Build the extension (word-list ∩ [3..15] a-z) MINUS the current accept union.
const wordList = readFileSync(join(ROOT, 'node_modules', 'word-list', 'words.txt'), 'utf8').trim().split('\n');
const recall = readFileSync(join(SOLO, 'words.recall.txt'), 'utf8').split(' ');
const acceptExtra = readFileSync(join(SOLO, 'words.accept.txt'), 'utf8').split(' ');

const union = new Set(recall); // current shipped accept set (RECALL ∪ accept.txt)
for (const w of acceptExtra) union.add(w);

const bigFiltered = new Set(); // all word-list words in the 3-15 a-z band (the full target vocab)
for (const raw of wordList) {
  const w = raw.trim().toLowerCase();
  if (w.length < MIN || w.length > MAX) continue;
  if (!AZ.test(w)) continue;
  bigFiltered.add(w);
}

const ext = []; // the increment we ship: real words not already accepted
for (const w of bigFiltered) if (!union.has(w)) ext.push(w);
ext.sort(); // membership-only asset; sorted for a stable, diff-friendly file

writeFileSync(join(SOLO, 'words.accept-ext.txt'), ext.join(' '));

// The runtime accept set once the extension is merged in.
const merged = new Set(union);
for (const w of ext) merged.add(w);

// ---- 2. Sizes.
const raw = readFileSync(join(SOLO, 'words.accept-ext.txt'));
const brotli = brotliCompressSync(raw, { params: { [zc.BROTLI_PARAM_QUALITY]: 11 } });
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

// ---- 3. CHAIN s→s bank-exploit re-run against the ENLARGED accept set.
// Replicates chain.test.js runBot(endOnS=true): a bank bot with full vocabulary that
// always answers the shortest unused word ending in 's' for the required letter, at a
// deterministic ~1500 + 220·len ms. Heat is the only thing that can stop it.
const _topCommon = recall.slice(0, 3000);
function byFirst(words, sort) {
  const m = new Map();
  for (const w of words) {
    const c = w[0];
    let a = m.get(c);
    if (!a) m.set(c, (a = []));
    a.push(w);
  }
  if (sort) for (const a of m.values()) a.sort(sort);
  return m;
}
const BOT_REACT = 1500;
const BOT_PER_CHAR = 220;
function runBankBot(accept, rng) {
  const endSByFirst = runBankBot._cache.get(accept) || (() => {
    const arr = [...accept].filter((w) => w[w.length - 1] === 's');
    const m = byFirst(arr, (a, b) => a.length - b.length);
    runBankBot._cache.set(accept, m);
    return m;
  })();
  const eng = createChainEngine({ accept, topCommon: _topCommon, rng });
  let links = 0;
  for (let g = 0; g < 20000; g++) {
    const bucket = endSByFirst.get(eng.state.requiredLetter) || [];
    const word = bucket.find((w) => !eng.state.used.has(w));
    if (!word) break;
    if (BOT_REACT + BOT_PER_CHAR * word.length > eng.currentTMax()) break;
    if (!eng.submit(word).ok) break;
    links += 1;
  }
  return links;
}
runBankBot._cache = new Map();

function worstOver(accept, runs = 500, seed = 999) {
  const rng = mulberry32(seed);
  let worst = 0;
  for (let i = 0; i < runs; i++) worst = Math.max(worst, runBankBot(accept, rng));
  return worst;
}

const sinkOld = [...union].filter((w) => w[0] === 's' && w[w.length - 1] === 's').length;
const sinkNew = [...merged].filter((w) => w[0] === 's' && w[w.length - 1] === 's').length;
const bankOld = worstOver(union);
const bankNew = worstOver(merged);

// ---- Report.
console.log('=== ACCEPTANCE EXTENSION ===');
console.log(`word-list source:        ${wordList.length} words (word-list v4.1.0, MIT / atebits Words)`);
console.log(`full 3-15 a-z vocab:     ${bigFiltered.size} words (the target accept set)`);
console.log(`current accept union:    ${union.size} words (RECALL ∪ words.accept.txt)`);
console.log(`extension increment:     ${ext.length} words  → src/solo/words.accept-ext.txt`);
console.log(`merged accept set:       ${merged.size} words`);
console.log(`asset raw size:          ${kb(raw.length)} (${raw.length} bytes)`);
console.log(`asset brotli size:       ${kb(brotli.length)} (${brotli.length} bytes)`);
console.log('');
console.log('=== CHAIN s→s SINK / BANK EXPLOIT (500 seeded runs, worst case) ===');
console.log(`s→s sink size  old:      ${sinkOld} words`);
console.log(`s→s sink size  new:      ${sinkNew} words`);
console.log(`bank-exploit links old:  ${bankOld}`);
console.log(`bank-exploit links new:  ${bankNew}   (SHIP GATE: must be <= 25)`);
console.log('');
console.log(bankNew <= 25 ? `SHIP: bank exploit holds at ${bankNew} links (<= 25).` : `DO NOT SHIP: bank exploit reached ${bankNew} links (> 25).`);
