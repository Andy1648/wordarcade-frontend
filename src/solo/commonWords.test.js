// node --test — STEP 55: the hand-curated COMMON PROPER-NOUN + MILD-INSULT list (words.common.txt)
// is accepted in BOTH solo modes from the FIRST run, and carries nothing the content blocklists flag.
//
// The accept set built here is the one words.js builds at load — RECALL ∪ words.accept.txt ∪ famous
// ∪ common — WITHOUT the lazy extension (which only lands after a run ends).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createChainEngine } from './chain.js';
import { createFuseEngine } from './fuse.js';
import { mulberry32 } from './shared.js';
import { isBlockedForDisplay, isSlur } from '../moderation/blockedTerms.js';
import { isNameBlocked } from '../leaderboard/nameFilter.js';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const recall = read('./words.recall.txt').split(' ');
const common = read('./words.common.txt').split(/\s+/).filter(Boolean).map((w) => w.toLowerCase());
const runOneAccept = new Set(recall);
for (const w of read('./words.accept.txt').split(' ')) runOneAccept.add(w);
for (const w of read('./words.famous.txt').split(/\s+/)) if (w) runOneAccept.add(w.toLowerCase());
for (const w of common) runOneAccept.add(w);

test('words.common.txt is a-z single words, deduped, and a real increment', () => {
  assert.ok(common.length >= 500, `only ${common.length} common words`);
  assert.equal(new Set(common).size, common.length, 'duplicate entries');
  for (const w of common) assert.match(w, /^[a-z]{3,}$/);
  // Never shorter than the input can take, never longer than acceptMaxLen.
  const maxLen = JSON.parse(read('./acceptMaxLen.json')).maxLen;
  for (const w of common) assert.ok(w.length <= maxLen, `${w} longer than acceptMaxLen`);
});

test('words.common.txt carries no slur, no profanity, nothing the leaderboard name filter blocks', () => {
  const bad = common.filter((w) => isSlur(w) || isBlockedForDisplay(w) || isNameBlocked(w));
  assert.deepEqual(bad, []);
});

// The words Andy named, plus one of each category.
const SPOT = ['october', 'monday', 'france', 'london', 'california', 'japanese', 'idiot', 'moron',
  'loser', 'christmas', 'saturn', 'selfie', 'europe'];

for (const word of SPOT) {
  test(`FUSE + CHAIN accept ${word} on the first run`, () => {
    assert.ok(runOneAccept.has(word), `${word} not in the first-run accept set`);
    const chain = createChainEngine({ accept: runOneAccept, topCommon: recall.slice(0, 3000), rng: mulberry32(1) });
    chain.state.requiredLetter = word[0];
    assert.equal(chain.validate(word.toUpperCase()), null);
    const pools = { e: ['ab'], m: ['ab'], h: ['ab'], b: ['ab'] };
    const fuse = createFuseEngine({ accept: runOneAccept, pools, rng: mulberry32(1) });
    fuse.state.fragment = word.slice(1, 3);
    assert.equal(fuse.validate(word), null);
  });
}

test('a non-word is still rejected (the list did not open the floodgates)', () => {
  const fuse = createFuseEngine({ accept: runOneAccept, pools: { e: ['ab'], m: ['ab'], h: ['ab'], b: ['ab'] }, rng: mulberry32(1) });
  fuse.state.fragment = 'on';
  assert.equal(fuse.validate('londonx'), 'not_in_list');
});
