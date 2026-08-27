// scripts/build-words.mjs
// Builds the SOLO-mode word assets — src/solo/words.recall.txt and
// src/solo/words.accept.txt — from two inputs:
//
//   1. word-list (npm devDep): a 274k real-word dictionary. MEMBERSHIP filter —
//      a token only counts as a real word if it appears here.
//   2. A frequency-ranked corpus (Norvig's count_1w.txt, the Google Web
//      Trillion-Word Corpus: 333k "word<TAB>count" lines, sorted by count desc).
//      ORDERING — the index of a word IS its rank. Rank drives nothing at runtime
//      but must stay stable for tests, and CHAIN reads the top-3000 of RECALL as
//      its "common words" set. Any frequency-ranked source works; this one is
//      canonical and free. Downloaded once at author time (cached in the OS temp
//      dir); the OUTPUT is committed and loaded lazily at runtime — the corpus is
//      never fetched or parsed by the app.
//
// RECALL = the ~31.5k most frequent words that are 3-9 letters, a-z only, and in
//          word-list. (The 3-9/a-z/in-list pool is ~62k, so we cap at the most
//          frequent RECALL_CAP of them.) Frequency-ordered; index === rank.
// ACCEPT file = the INCREMENT only — every OTHER 3-15/a-z/in-list word by frequency
//          that is NOT already in RECALL (~56k more). The runtime forms the ACCEPT
//          SET as RECALL ∪ this increment (~88k unique, "~92k"). We ship the
//          increment rather than the full 92k so RECALL is not shipped twice — the
//          two files together stay inside the ~376KB gzip budget. words.recall.txt
//          is frequency-ordered (CHAIN reads its top-3000 as the "common" set);
//          words.accept.txt is membership-only, so its order is immaterial.
//
// Run:  node scripts/build-words.mjs
// This regenerates the two committed .txt files. Do NOT wire it into the build.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { get } from 'node:https';
// Content-safety (fix/dict-safety): RECALL is a DISPLAY asset (CHAIN top-3k /
// fragment reveals) so it must contain no slur OR profanity; the ACCEPT increment
// is acceptance-only so it drops slurs but keeps mild profanity acceptable.
import { isBlockedForDisplay, isSlur } from '../src/moderation/blockedTerms.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = join(ROOT, 'src', 'solo');

const FREQ_URL = 'https://www.norvig.com/ngrams/count_1w.txt';
const FREQ_CACHE = join(tmpdir(), 'wa-count_1w.txt');

const RECALL_MIN = 3;
const RECALL_MAX = 9;
const ACCEPT_MIN = 3;
const ACCEPT_MAX = 15;
const RECALL_CAP = 31500; // top-N most frequent → lands inside the asserted 31k-32k band

const AZ = /^[a-z]+$/;

function download(url) {
  return new Promise((res, rej) => {
    get(url, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume();
        return download(r.headers.location).then(res, rej);
      }
      if (r.statusCode !== 200) {
        r.resume();
        return rej(new Error(`GET ${url} → ${r.statusCode}`));
      }
      let buf = '';
      r.setEncoding('utf8');
      r.on('data', (d) => (buf += d));
      r.on('end', () => res(buf));
    }).on('error', rej);
  });
}

async function loadFreq() {
  if (existsSync(FREQ_CACHE)) {
    return readFileSync(FREQ_CACHE, 'utf8');
  }
  process.stdout.write(`downloading frequency corpus from ${FREQ_URL} …\n`);
  const text = await download(FREQ_URL);
  writeFileSync(FREQ_CACHE, text);
  return text;
}

function assert(cond, msg) {
  if (!cond) {
    console.error('ASSERTION FAILED:', msg);
    process.exit(1);
  }
}

async function main() {
  const wordList = new Set(
    readFileSync(join(ROOT, 'node_modules', 'word-list', 'words.txt'), 'utf8').trim().split('\n')
  );

  // Frequency-ordered, a-z only, real-word-only. One pass; index === rank.
  const ranked = [];
  for (const line of (await loadFreq()).trim().split('\n')) {
    const w = line.split('\t')[0].toLowerCase();
    if (!AZ.test(w)) continue;
    if (!wordList.has(w)) continue;
    ranked.push(w);
  }

  // RECALL: the most frequent RECALL_CAP words in the 3-9 band (stable order).
  const recall = [];
  const recallSet = new Set();
  for (const w of ranked) {
    if (w.length < RECALL_MIN || w.length > RECALL_MAX) continue;
    if (isBlockedForDisplay(w)) continue; // no slur/profanity in the displayed supply
    recall.push(w);
    recallSet.add(w);
    if (recall.length >= RECALL_CAP) break;
  }
  assert(recall.length >= 31000 && recall.length <= 32000, `RECALL size ${recall.length} outside 31000-32000`);

  // ACCEPT increment: every 3-15 word by frequency NOT already in RECALL. The
  // runtime unions this with RECALL to get the full accept set.
  const acceptExtra = [];
  for (const w of ranked) {
    if (w.length < ACCEPT_MIN || w.length > ACCEPT_MAX) continue;
    if (recallSet.has(w)) continue;
    if (isSlur(w)) continue; // slurs are never accepted/scored (profanity may stay)
    acceptExtra.push(w);
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'words.recall.txt'), recall.join(' '));
  writeFileSync(join(OUT_DIR, 'words.accept.txt'), acceptExtra.join(' '));

  console.log(`RECALL:        ${recall.length} words`);
  console.log(`ACCEPT extra:  ${acceptExtra.length} words`);
  console.log(`ACCEPT set:    ${recall.length + acceptExtra.length} words (RECALL ∪ extra)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
