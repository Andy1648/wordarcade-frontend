// rarity.test.js — pins the RARITY band boundaries, the length bonus, the hard cap, and the
// COMMON-stays-silent rule. These are the economy's word-value knobs; a future edit that shifts
// a boundary or lets a single word blow past the cap breaks the build here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRarityIndex,
  wordRarity,
  bandForRank,
  lengthBonus,
  RARITY_MAX_MULT,
} from './rarity.js';

// A tiny synthetic frequency corpus: rank === index. We place known words at exact ranks so the
// boundary tests don't depend on the shipped 31k list. 'aaaaa' words are 5 letters (no length
// bonus) unless noted.
function idxWith(entries) {
  // entries: [word, rank][] — build an array with the word at that index (gaps filled with junk).
  const maxRank = Math.max(...entries.map(([, r]) => r));
  const arr = new Array(maxRank + 1).fill(null).map((_, i) => `_pad${i}`);
  for (const [w, r] of entries) arr[r] = w;
  return buildRarityIndex(arr);
}

test('band boundaries are EXACT and half-open (max is exclusive)', () => {
  // COMMON < 3000, UNCOMMON < 15000, RARE = the rest of the corpus, OBSCURE = not in corpus.
  assert.equal(bandForRank(0).name, 'COMMON');
  assert.equal(bandForRank(2999).name, 'COMMON');
  assert.equal(bandForRank(3000).name, 'UNCOMMON'); // boundary belongs to the higher band
  assert.equal(bandForRank(14999).name, 'UNCOMMON');
  assert.equal(bandForRank(15000).name, 'RARE');
  assert.equal(bandForRank(999999).name, 'RARE'); // in-corpus but very deep = RARE
  assert.equal(bandForRank(NaN).name, 'OBSCURE'); // not in corpus at all
});

test('multipliers per band are 1.0 / 1.5 / 2.5 / 4.0', () => {
  // 5-letter words isolate the band multiplier from the length bonus.
  const idx5 = idxWith([['aaaaa', 100], ['bbbbb', 5000], ['ccccc', 20000]]);
  assert.equal(wordRarity('aaaaa', idx5).mult, 1.0); // COMMON
  assert.equal(wordRarity('bbbbb', idx5).mult, 1.5); // UNCOMMON
  assert.equal(wordRarity('ccccc', idx5).mult, 2.5); // RARE
  assert.equal(wordRarity('zzzzz', idx5).mult, 4.0); // not in corpus → OBSCURE
});

test('length bonus: +0.1x per letter above 5, capped +0.5x', () => {
  assert.equal(lengthBonus(3), 0);
  assert.equal(lengthBonus(5), 0);
  assert.equal(Math.round(lengthBonus(6) * 100) / 100, 0.1);
  assert.equal(Math.round(lengthBonus(8) * 100) / 100, 0.3); // float-safe compare
  assert.equal(lengthBonus(10), 0.5); // (10-5)*0.1 = 0.5 = cap
  assert.equal(lengthBonus(15), 0.5); // capped
});

test('length bonus stacks on the band multiplier (rounded to 2dp)', () => {
  const idx = idxWith([['uncommon', 5000]]); // 8 letters, rank 5000 → UNCOMMON 1.5 + 0.3 = 1.8
  const r = wordRarity('uncommon', idx);
  assert.equal(r.band, 'UNCOMMON');
  assert.equal(r.mult, 1.8);
});

test('no single word can exceed the hard cap (OBSCURE 4.0 + max length 0.5 = 4.5)', () => {
  const idx = idxWith([['common', 1]]);
  // a very long OBSCURE word (not in corpus): 4.0 + capped 0.5 = 4.5, never more
  const r = wordRarity('supercalifragilisticword', idx);
  assert.equal(r.band, 'OBSCURE');
  assert.equal(r.mult, RARITY_MAX_MULT);
  assert.equal(r.mult, 4.5);
  // spot-check the invariant across many lengths
  for (let len = 1; len <= 40; len++) {
    const w = 'q'.repeat(len);
    assert.ok(wordRarity(w, idx).mult <= RARITY_MAX_MULT + 1e-9, `len ${len} exceeded cap`);
  }
});

test('COMMON stays silent (announce=false, empty label); UNCOMMON+ announce with the tier + mult', () => {
  const idx = idxWith([['aaaaa', 1], ['bbbbb', 5000], ['ccccc', 20000]]);
  assert.equal(wordRarity('aaaaa', idx).announce, false);
  assert.equal(wordRarity('aaaaa', idx).label, '');
  assert.equal(wordRarity('bbbbb', idx).announce, true);
  assert.equal(wordRarity('bbbbb', idx).label, 'UNCOMMON ×1.5');
  assert.equal(wordRarity('ccccc', idx).label, 'RARE ×2.5');
  assert.equal(wordRarity('zzzzz', idx).label, 'OBSCURE ×4');
});

test('safe defaults: empty word / missing index → COMMON, silent, ×1 (never throws)', () => {
  const idx = idxWith([['aaaaa', 1]]);
  assert.equal(wordRarity('', idx).mult, 1);
  assert.equal(wordRarity('aaaaa', null).mult, 1); // index not loaded yet
  assert.equal(wordRarity('aaaaa', null).announce, false);
  assert.equal(wordRarity(undefined, idx).mult, 1);
});

test('case/whitespace-insensitive lookup', () => {
  const idx = idxWith([['ccccc', 20000]]);
  assert.equal(wordRarity('  CCCCC  ', idx).band, 'RARE');
});
