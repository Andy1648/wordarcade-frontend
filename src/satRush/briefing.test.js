// briefing.test.js — the (up to) 5-word study pick. The family lesson lives on
// every card via its own cousins, so selection no longer gates on shared morphemes:
// it's up to 2 review words + fresh tier-appropriate fill (root-bearing preferred),
// and a shared morpheme among the chosen words is a grouped BONUS, not a gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickBriefing } from './briefing.js';
import { freshState, recordResult, needsReview } from './lexicon.js';

// Identity RNG: floor(0.9999999 * (i+1)) === i, so Fisher-Yates is a no-op and
// selection scans the pool in the exact order given — fully deterministic.
const IDENTITY_RNG = () => 0.9999999;

// A seeded PRNG (mulberry32) so the multi-run simulations exercise a REAL varying
// shuffle while staying deterministic across test runs.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  assert.equal(b.familyCount, 0);
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
  // familyCount reflects how many actually share the root, so the header can say "THREE",
  // not a hardcoded "TWO".
  assert.equal(b.familyCount, 3, 'three words carry the family morpheme');
});

test('the one review slot takes the WEAKEST due needs-review word, and it leads', () => {
  const s = freshState();
  // 'bravo' MISSED at session 1 → box 0 (ante 0), due from session 2.
  recordResult(s, 'bravo', { cleared: false, stage: 2, revealedCount: 5 });
  s.session = 1;
  // 'alpha' GIVE-AWAY clear at session 1 → box 1 (ante 1), due from session 5
  // (INTERVALS[1] = 3). Recorded at session 1 so lastSeen = 1.
  recordResult(s, 'alpha', { cleared: true, stage: 2, revealedCount: 4 });

  // At session 5 both are due AND both need review; bravo (ante 0) is weaker than
  // alpha (ante 1), so it wins the single slot and leads the deck.
  const b = pickBriefing({ state: s, session: 5, words: mixedPool(), rng: IDENTITY_RNG });
  assert.equal(b.reviewCount, 1, 'at most ONE review slot');
  assert.equal(b.words[0].word, 'bravo', 'the weakest (lowest last ante) due word leads');
  assert.ok(b.reviewWords.has('bravo'));
  assert.ok(!b.reviewWords.has('alpha'), 'only one review word is dealt');
  assert.equal(b.words.length, 5);
  assert.equal(new Set(b.words.map((r) => r.word)).size, 5);
});

test('a cold-cleared due word is NOT reviewed — deck is all fresh', () => {
  const s = freshState();
  s.session = 1;
  // 'bravo' cleared COLD at session 1 → box 1, ante 5. It becomes Leitner-due at
  // session 5, but needsReview() is false, so it must NOT take a review slot.
  recordResult(s, 'bravo', { cleared: true, stage: 0, revealedCount: 0 });
  const b = pickBriefing({ state: s, session: 5, words: mixedPool(), rng: IDENTITY_RNG });
  assert.equal(b.reviewCount, 0, 'a word known cold is never re-studied');
  assert.equal(b.reviewWords.size, 0);
  assert.equal(b.words.length, 5);
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

// --- multi-run simulations: the repeat-rate fix ----------------------------
// The real pool is ~600 words and a 12-run player touches ~60, so unseen never
// runs out — matching that, these use a pool comfortably larger than 12×5 so the
// FRESH fill is always drawn from unseen words. Any recurrence is then necessarily
// a REVIEW-slot deal, which is exactly what we assert the guard on.

// Drive a run's deck through pickBriefing with the last-3-decks exclusion, append
// the new deck (newest 3 kept), and return the dealt deck.
function dealRun(state, pool, session, rng) {
  const b = pickBriefing({
    state,
    session,
    words: pool,
    rng,
    exclude: (state.lastBriefed || []).flat(),
  });
  const deck = b.words.map((r) => r.word);
  state.lastBriefed = [...(state.lastBriefed || []), deck].slice(-3);
  return b;
}

test('12-run player: a word only recurs when needsReview() flagged it', () => {
  const pool = bigPool(120);
  const s = freshState();
  const rng = mulberry32(0xa11ce);
  const dealtBefore = new Set();

  for (let run = 1; run <= 12; run++) {
    s.session = run;
    const b = dealRun(s, pool, run, rng);
    // Any word we've dealt in an earlier run must, at THIS moment (before we record
    // this run's outcomes), have needsReview() === true — i.e. it only came back
    // because the player didn't know it cold.
    for (const r of b.words) {
      if (dealtBefore.has(r.word)) {
        assert.ok(
          needsReview(s, r.word),
          `run ${run}: '${r.word}' recurred but needsReview() was false (a cold-clear repeat)`
        );
      }
    }
    // Play the run with a spread of outcomes: ~50% cold clears, ~25% give-aways,
    // ~25% misses — so some words legitimately DO need review later.
    for (const w of b.words.map((r) => r.word)) {
      const roll = rng();
      if (roll < 0.5) recordResult(s, w, { cleared: true, stage: 0, revealedCount: 0 });
      else if (roll < 0.75) recordResult(s, w, { cleared: true, stage: 2, revealedCount: 4 });
      else recordResult(s, w, { cleared: false, stage: 2, revealedCount: 5 });
      dealtBefore.add(w);
    }
  }
  // Sanity: the player DID revisit some words (the review path is actually exercised).
  assert.ok(dealtBefore.size < 12 * 5, 'some words recurred, so the guard was meaningful');
});

test('a player who clears everything cold gets ZERO review slots and no repeats', () => {
  const pool = bigPool(120);
  const s = freshState();
  const rng = mulberry32(0xc01d);
  const seen = [];

  for (let run = 1; run <= 12; run++) {
    s.session = run;
    const b = dealRun(s, pool, run, rng);
    assert.equal(b.reviewCount, 0, `run ${run}: no review slot when everything is cleared cold`);
    const deck = b.words.map((r) => r.word);
    seen.push(...deck);
    for (const w of deck) recordResult(s, w, { cleared: true, stage: 0, revealedCount: 0 });
  }
  assert.equal(seen.length, 12 * 5, '12 full decks dealt');
  assert.equal(seen.length, new Set(seen).size, 'no word repeats across 12 cold-cleared runs');
});
