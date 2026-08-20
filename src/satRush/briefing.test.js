// briefing.test.js — the (up to) 5-word study pick. The family lesson lives on
// every card via its own cousins, so selection no longer gates on shared morphemes:
// it's up to 2 review words + fresh tier-appropriate fill (root-bearing preferred),
// and a shared morpheme among the chosen words is a grouped BONUS, not a gate.
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

// A pool with root-bearing words (mostly distinct morphemes) and some root-less ones.
function mixedPool() {
  return [
    row('alpha', 1, 'aa-', ['ac1', 'ac2']),
    row('bravo', 1, 'bb-', ['bc1', 'bc2']),
    row('cider', 1, 'cc-', ['cc1']),
    row('delta', 2, 'dd-', ['dc1']),
    row('eagle', 2, 'ee-', ['ec1']),
    row('lone1', 1, null),
    row('lone2', 1, null),
    row('lone3', 2, null),
  ];
}

test('deterministic under a seeded RNG', () => {
  const s = freshState();
  const a = pickBriefing({ state: s, session: 1, words: mixedPool(), rng: IDENTITY_RNG });
  const b = pickBriefing({ state: s, session: 1, words: mixedPool(), rng: IDENTITY_RNG });
  assert.deepEqual(a.words.map((r) => r.word), b.words.map((r) => r.word));
  assert.equal(a.familyMorpheme, b.familyMorpheme);
});

test('returns exactly `count` with no duplicates when the pool allows', () => {
  const b = pickBriefing({ state: freshState(), session: 1, words: mixedPool(), rng: IDENTITY_RNG });
  assert.equal(b.words.length, 5);
  assert.equal(new Set(b.words.map((r) => r.word)).size, 5);
});

test('fresh fill prefers root-bearing words (so every card can teach a family)', () => {
  // 5 root-bearing words + 3 root-less. A fresh run should fill entirely from the
  // root-bearing ones so each card carries a cousin lesson.
  const b = pickBriefing({ state: freshState(), session: 1, words: mixedPool(), rng: IDENTITY_RNG });
  assert.ok(
    b.words.every((r) => r.root),
    'all five briefed words carry a root while root-bearing words remain'
  );
});

test('no shared morpheme → familyMorpheme is null (the common case)', () => {
  // Every root-bearing word here has a distinct morpheme, so nothing is shared.
  const b = pickBriefing({ state: freshState(), session: 1, words: mixedPool(), rng: IDENTITY_RNG });
  assert.equal(b.familyMorpheme, null);
});

test('a shared morpheme is a grouped BONUS — headed and adjacent', () => {
  // Three words share 'zz-'; the rest are distinct. The pick should surface the
  // shared morpheme and place its members contiguously.
  const pool = [
    row('zebra', 1, 'zz-', ['zc1']),
    row('zesty', 1, 'zz-', ['zc2']),
    row('zonal', 2, 'zz-', ['zc3']),
    row('other', 1, 'oo-', ['oc1']),
    row('extra', 2, 'xx-', ['xc1']),
    row('spare', 1, 'ss-', ['sc1']),
  ];
  const b = pickBriefing({ state: freshState(), session: 1, words: pool, rng: IDENTITY_RNG });
  assert.equal(b.familyMorpheme, 'zz-', 'the most-shared morpheme heads the screen');
  const words = b.words.map((r) => r.word);
  const idx = words.map((w, i) => ({ w, i })).filter((e) => e.w.startsWith('z')).map((e) => e.i);
  assert.equal(idx.length, 3, 'all three shared-root words are present');
  assert.equal(idx[2] - idx[0], 2, 'the shared-root words are contiguous');
});

test('review words are prioritised and still lead the list', () => {
  const s = freshState();
  s.session = 1;
  // Miss 'bravo' → box 0, due next session.
  recordResult(s, 'bravo', { cleared: false, stage: 2, revealedCount: 5 });
  // Two given-away clears of 'lone1' → a WEAK word.
  recordResult(s, 'lone1', { cleared: true, stage: 2, revealedCount: 4 });
  recordResult(s, 'lone1', { cleared: true, stage: 2, revealedCount: 4 });

  const b = pickBriefing({ state: s, session: 2, words: mixedPool(), rng: IDENTITY_RNG });
  assert.ok(b.reviewCount >= 1 && b.reviewCount <= 2, 'up to two review words');
  assert.equal(b.words[0].word, 'lone1', 'the weak word leads');
  assert.ok(b.reviewWords.has('lone1'));
  assert.ok(b.reviewWords.has('bravo'));
  assert.equal(b.words.length, 5);
  assert.equal(new Set(b.words.map((r) => r.word)).size, 5);
});

test('never returns fewer than `count` while the pool has the words', () => {
  const s = freshState();
  // Master a root-less word so it's excluded; the fill still reaches 5.
  recordResult(s, 'lone1', { cleared: true });
  recordResult(s, 'lone1', { cleared: true });
  recordResult(s, 'lone1', { cleared: true }); // box 3 → mastered
  const b = pickBriefing({ state: s, session: 1, words: mixedPool(), rng: IDENTITY_RNG });
  assert.equal(b.words.length, 5);
  assert.ok(!b.words.some((r) => r.word === 'lone1'), 'a mastered word is not re-briefed');
});

test('falls back to root-less words when root-bearing ones run out', () => {
  // Only 2 root-bearing words; the fill must still reach 5 using root-less ones.
  const pool = [
    row('roota', 1, 'ra-', ['rc1']),
    row('rootb', 1, 'rb-', ['rc2']),
    row('none1', 1, null),
    row('none2', 1, null),
    row('none3', 2, null),
    row('none4', 2, null),
  ];
  const b = pickBriefing({ state: freshState(), session: 1, words: pool, rng: IDENTITY_RNG });
  assert.equal(b.words.length, 5);
  assert.equal(b.familyMorpheme, null);
  assert.equal(new Set(b.words.map((r) => r.word)).size, 5);
});

// --- exclude: the briefing refreshes every time ---------------------------

// A generous pool (40 distinct root-bearing words) so back-to-back decks can be
// fully disjoint without touching the soft-backfill path.
function bigPool(n = 40) {
  return Array.from({ length: n }, (_, i) => {
    const id = String(i).padStart(2, '0');
    return row(`word${id}`, 1, `m${id}-`, [`c${id}`]);
  });
}

test('back-to-back decks are disjoint when the previous deck is excluded', () => {
  const pool = bigPool(40);
  const s = freshState();
  const first = pickBriefing({ state: s, session: 1, words: pool, rng: IDENTITY_RNG });
  const firstWords = first.words.map((r) => r.word);
  const second = pickBriefing({
    state: s,
    session: 1,
    words: pool,
    rng: IDENTITY_RNG,
    exclude: firstWords,
  });
  const secondWords = second.words.map((r) => r.word);
  assert.equal(second.words.length, 5);
  const overlap = secondWords.filter((w) => firstWords.includes(w));
  assert.deepEqual(overlap, [], 'the second deck shares no words with the first');
});

test('a just-briefed due word is excluded when passed in exclude', () => {
  const s = freshState();
  s.session = 1;
  // Miss 'bravo' → box 0, due next session; normally it would LEAD as a review word.
  recordResult(s, 'bravo', { cleared: false, stage: 2, revealedCount: 5 });
  const b = pickBriefing({
    state: s,
    session: 2,
    words: mixedPool(),
    rng: IDENTITY_RNG,
    exclude: ['bravo'],
  });
  assert.ok(!b.words.some((r) => r.word === 'bravo'), 'the excluded due word is not re-dealt');
  assert.ok(!b.reviewWords.has('bravo'));
  assert.equal(b.words.length, 5); // a full deck still ships from the rest of the pool
});

test('tiny-pool fallback: excluding everything still fills a full deck (soft)', () => {
  const pool = mixedPool(); // 8 words, none mastered
  const everything = pool.map((r) => r.word);
  const b = pickBriefing({
    state: freshState(),
    session: 1,
    words: pool,
    rng: IDENTITY_RNG,
    exclude: everything,
  });
  // Nothing is left un-excluded, so the SOFT backfill pulls non-mastered excluded
  // words back in rather than shipping a short deck.
  assert.equal(b.words.length, 5);
  assert.equal(new Set(b.words.map((r) => r.word)).size, 5);
});
