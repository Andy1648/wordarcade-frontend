// rarity.test.js — RUN MODE live-round rarity read. Pins the exact composition
// useRunMode.submitWord performs — `rarityOf(word).band` → scoreWord({ rarity, … }) —
// so a KNOWN RARE word scores at its rarity multiplier (~2.5×) in a run and NOT 1.0×
// (COMMON). This is the regression that the `.name` bug caused: rarityOf returns the band
// under `.band` (there is NO `.name` field), so reading `.name` left rarity undefined and
// scoreWord's `RARITY[undefined] ?? 1` collapsed every word to COMMON ×1 — inert rarity,
// contradicting the wall/sim calibration. This test fails if that read regresses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreWord } from './engine.js';
import { rarityOf, __setRarityIndexForTest } from '../progress/rarityIndex.js';
import { buildRarityIndex } from '../progress/rarity.js';

// buildRarityIndex maps array index → rank. RARITY bands (rarity.js): COMMON rank<3000,
// UNCOMMON 3000–14999, RARE ≥15000. We place a 5-letter COMMON word and a 5-letter RARE
// word (5 letters → zero length bonus, so the band multiplier is isolated exactly).
function makeIndex() {
  const arr = [];
  arr[10] = 'plate';    // rank 10 → COMMON (×1.0)
  arr[16000] = 'zesty'; // rank 16000 → RARE (×2.5)
  return buildRarityIndex(arr); // holes are undefined → skipped; only these two get ranks
}

// The word object submitWord builds, driven off the rarity VERDICT (rarity: r.band).
const asSubmitDoes = (verdict) => ({
  rarity: verdict.band, len: 5, vowels: 2, rare: false, lucky: false, combo: 1,
});

test('RUN live round: a KNOWN RARE word scores at ~2.5× COMMON via rarityOf(word).band', () => {
  __setRarityIndexForTest(makeIndex());
  try {
    const common = rarityOf('plate');
    const rare = rarityOf('zesty');
    assert.equal(common.band, 'COMMON');
    assert.equal(rare.band, 'RARE');

    // The real submit path: score both words exactly as useRunMode.submitWord does.
    const commonScore = scoreWord(asSubmitDoes(common), []);
    const rareScore = scoreWord(asSubmitDoes(rare), []);
    assert.ok(commonScore > 0);
    // 5-letter words carry no length bonus, so RARE/COMMON is the pure band ratio: 2.5/1.0.
    assert.ok(
      Math.abs(rareScore / commonScore - 2.5) < 1e-9,
      `RARE must score 2.5× COMMON in a run, got ${rareScore / commonScore}×`,
    );
    assert.notEqual(rareScore, commonScore); // rarity is LIVE, not inert
  } finally {
    __setRarityIndexForTest(null);
  }
});

test('the `.name` misread this pins: rarityOf has no `.name`, so it would score COMMON ×1', () => {
  __setRarityIndexForTest(makeIndex());
  try {
    const rare = rarityOf('zesty');
    // The rarity verdict exposes the band under `.band`; `.name` is undefined. The OLD bug
    // read `.name`, so `w.rarity` was undefined and scoreWord collapsed it to COMMON.
    assert.equal(rare.name, undefined);
    const correct = scoreWord({ rarity: rare.band, len: 5, vowels: 2, rare: false, lucky: false, combo: 1 }, []);
    const buggy = scoreWord({ rarity: rare.name, len: 5, vowels: 2, rare: false, lucky: false, combo: 1 }, []);
    const common = scoreWord({ rarity: 'COMMON', len: 5, vowels: 2, rare: false, lucky: false, combo: 1 }, []);
    assert.equal(buggy, common, 'reading .name (undefined) scores COMMON ×1 — the inert-rarity bug');
    assert.ok(correct > buggy, 'the .band read must score strictly higher than the .name misread');
  } finally {
    __setRarityIndexForTest(null);
  }
});
