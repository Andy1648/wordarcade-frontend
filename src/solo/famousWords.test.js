// node --test — fix/famous-long-words: the hand-curated famous long words (words.famous.txt) are
// accepted in BOTH solo modes from the FIRST run.
//
// The accept set built here is the one words.js builds at load — RECALL ∪ words.accept.txt ∪ the
// famous list — WITHOUT the lazy extension, which only arrives after a run ends. So every word
// below must validate without it (incomprehensibilities, for one, was extension-only before).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createChainEngine } from './chain.js';
import { createFuseEngine } from './fuse.js';
import { mulberry32 } from './shared.js';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const recall = read('./words.recall.txt').split(' ');
// Same parse as words.js: whitespace-separated, lowercased.
const famous = read('./words.famous.txt').split(/\s+/).filter(Boolean).map((w) => w.toLowerCase());
const runOneAccept = new Set(recall);
for (const w of read('./words.accept.txt').split(' ')) runOneAccept.add(w);
for (const w of famous) runOneAccept.add(w);

const EXPECTED = [
  'antidisestablishmentarianism',
  'floccinaucinihilipilification',
  'pneumonoultramicroscopicsilicovolcanoconiosis',
  'supercalifragilisticexpialidocious',
  'hippopotomonstrosesquipedaliophobia',
  'pseudopseudohypoparathyroidism',
  'honorificabilitudinitatibus',
  'incomprehensibilities',
  'uncharacteristically',
  'thyroparathyroidectomized',
];

test('the famous list is exactly the verified ten, a-z only', () => {
  assert.deepEqual([...famous].sort(), [...EXPECTED].sort());
  for (const w of famous) assert.match(w, /^[a-z]+$/);
});

test('acceptMaxLen.json admits the longest famous word (45)', () => {
  assert.equal(JSON.parse(read('./acceptMaxLen.json')).maxLen, 45);
});

for (const word of EXPECTED) {
  test(`CHAIN accepts ${word}`, () => {
    const eng = createChainEngine({ accept: runOneAccept, topCommon: recall.slice(0, 3000), rng: mulberry32(1) });
    eng.state.requiredLetter = word[0];
    assert.equal(eng.validate(word), null);
    assert.equal(eng.validate(word.toUpperCase()), null); // the input is shown in caps
  });

  test(`FUSE accepts ${word}`, () => {
    const pools = { e: ['ab'], m: ['ab'], h: ['ab'], b: ['ab'] };
    const eng = createFuseEngine({ accept: runOneAccept, pools, rng: mulberry32(1) });
    eng.state.fragment = word.slice(3, 6); // any fragment the word contains
    assert.equal(eng.validate(word), null);
  });
}
