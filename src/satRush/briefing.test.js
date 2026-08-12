// briefing.test.js — the 5-word study pick. Covers the properties the design
// depends on: it's deterministic under a seeded RNG, review words get first
// claim, a real root family is chosen when one exists, it degrades gracefully
// when none does, and it never returns duplicates or short-changes the count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickBriefing } from './briefing.js';
import { freshState, recordResult } from './lexicon.js';

// Identity RNG: floor(0.9999999 * (i+1)) === i, so Fisher-Yates is a no-op and
// selection scans the pool in the exact order given — fully deterministic.
const IDENTITY_RNG = () => 0.9999999;

function row(word, tier, morpheme, cousins = []) {
  return {
    word,
    pos: 'adj',
    tier,
    gloss: `def of ${word}`,
    context: `use ___ here (${word})`,
    root: morpheme ? { morpheme, meaning: 'x', cousins } : null,
    alts: [],
  };
}

// A pool with two real families and some root-less words.
function familyPool() {
  return [
    row('alpha', 1, 'aaa-', ['acousin']),
    row('amber', 1, 'aaa-'),
    row('anvil', 1, 'aaa-'),
    row('argon', 2, 'aaa-'),
    row('bravo', 1, 'bbb-'),
    row('brine', 1, 'bbb-'),
    row('btorn', 2, 'bbb-'),
    row('lone1', 1, null),
    row('lone2', 1, null),
    row('lone3', 2, null),
  ];
}

test('deterministic under a seeded RNG', () => {
  const s = freshState();
  const a = pickBriefing({ state: s, session: 1, words: familyPool(), rng: IDENTITY_RNG });
  const b = pickBriefing({ state: s, session: 1, words: familyPool(), rng: IDENTITY_RNG });
  assert.deepEqual(a.words.map((r) => r.word), b.words.map((r) => r.word));
  assert.equal(a.familyMorpheme, b.familyMorpheme);
});

test('returns exactly `count` with no duplicates when the pool allows', () => {
  const b = pickBriefing({ state: freshState(), session: 1, words: familyPool(), rng: IDENTITY_RNG });
  assert.equal(b.words.length, 5);
  const set = new Set(b.words.map((r) => r.word));
  assert.equal(set.size, 5, 'no duplicate words');
});

test('a root family is chosen and cohesive when one exists', () => {
  const b = pickBriefing({ state: freshState(), session: 1, words: familyPool(), rng: IDENTITY_RNG });
  assert.ok(b.familyMorpheme, 'a family morpheme is set on a fresh run');
  const inFamily = b.words.filter((r) => r.root && r.root.morpheme === b.familyMorpheme);
  assert.equal(inFamily.length, 3, 'exactly three words share the chosen root');
  assert.equal(b.reviewCount, 0, 'no review words on a fresh state');
});

test('review words are prioritised (weak & due lead the list)', () => {
  const s = freshState();
  s.session = 1;
  // Miss 'bravo' → box 0, due next session.
  recordResult(s, 'bravo', { cleared: false, stage: 2, revealedCount: 5 });
  // Two given-away clears of 'lone1' → a WEAK word.
  recordResult(s, 'lone1', { cleared: true, stage: 2, revealedCount: 4 });
  recordResult(s, 'lone1', { cleared: true, stage: 2, revealedCount: 4 });

  const b = pickBriefing({ state: s, session: 2, words: familyPool(), rng: IDENTITY_RNG });
  assert.ok(b.reviewCount >= 1 && b.reviewCount <= 2, 'up to two review words');
  // Weak word leads over the merely-due one.
  assert.equal(b.words[0].word, 'lone1', 'the weak word is briefed first');
  assert.ok(b.reviewWords.has('lone1'));
  assert.ok(b.reviewWords.has('bravo'));
  assert.equal(b.words.length, 5);
  assert.equal(new Set(b.words.map((r) => r.word)).size, 5);
});

test('graceful fallback when no family qualifies → familyMorpheme null, still full', () => {
  // No morpheme reaches 3 words: one 2-word family + root-less fillers.
  const pool = [
    row('ceder', 1, 'ccc-'),
    row('crime', 1, 'ccc-'),
    row('none1', 1, null),
    row('none2', 1, null),
    row('none3', 2, null),
    row('none4', 2, null),
  ];
  const b = pickBriefing({ state: freshState(), session: 1, words: pool, rng: IDENTITY_RNG });
  assert.equal(b.familyMorpheme, null, 'no family → null, screen reads as five words');
  assert.equal(b.words.length, 5);
  assert.equal(new Set(b.words.map((r) => r.word)).size, 5);
});

test('never returns fewer than `count` while the pool has the words', () => {
  // Mastered words are skipped for family/fresh; ensure the fill still reaches 5
  // from what remains.
  const s = freshState();
  const pool = familyPool();
  // master two of the root-less words so they're excluded from fresh fill
  recordResult(s, 'lone1', { cleared: true });
  recordResult(s, 'lone1', { cleared: true });
  recordResult(s, 'lone1', { cleared: true }); // box 3 → mastered
  const b = pickBriefing({ state: s, session: 1, words: pool, rng: IDENTITY_RNG });
  assert.equal(b.words.length, 5);
  assert.ok(!b.words.some((r) => r.word === 'lone1'), 'a mastered word is not re-briefed as fresh/family');
});

test('prefers a family with a member/cousin the player already met', () => {
  // Two qualifying families; the player has seen a cousin of the 'bbb-' family.
  const pool = familyPool();
  const s = freshState();
  // 'brine' is a bbb- member; mark a cousin of bravo as seen instead to exercise
  // the cousin path: give bravo a known cousin.
  pool.find((r) => r.word === 'bravo').root.cousins = ['knownc'];
  recordResult(s, 'knownc', { cleared: true }); // player has met the cousin
  const b = pickBriefing({ state: s, session: 5, words: pool, rng: IDENTITY_RNG });
  assert.equal(b.familyMorpheme, 'bbb-', 'the family with a familiar cousin wins the tie');
});
