// lexicon.test.js — the per-word learning memory. These lock the two properties
// the rest of the feature leans on: an EMPTY state perturbs nothing (a returning
// player with no data plays exactly today's game), and a storage-blocked browser
// degrades to in-memory play instead of throwing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshState,
  load,
  save,
  recordResult,
  dueWords,
  weakWords,
  needsReview,
  masteredCount,
  isMastered,
  hasSeen,
  mostMissed,
  INTERVALS,
} from './lexicon.js';

// A minimal in-memory localStorage stand-in.
function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    _map: map,
  };
}

// A storage that throws on every access (private mode / disabled storage).
const blockedStorage = {
  getItem() {
    throw new Error('storage blocked');
  },
  setItem() {
    throw new Error('storage blocked');
  },
};

// Record a clear at a given stage/reveal count. Defaults model "knew it cold".
function clear(state, word, { stage = 0, revealedCount = 0 } = {}) {
  return recordResult(state, word, { cleared: true, stage, revealedCount });
}
function miss(state, word) {
  return recordResult(state, word, { cleared: false, stage: 2, revealedCount: 5 });
}

test('freshState / load-with-nothing is a clean empty state', () => {
  const s = freshState();
  assert.equal(s.v, 1);
  assert.equal(s.session, 0);
  assert.equal(s.mode, 'briefing');
  assert.deepEqual(s.records, {});
  // load off empty storage matches
  assert.deepEqual(load(memStorage()), freshState());
});

test('EMPTY STATE PERTURBS NOTHING — no due words, no weak words, zero mastered', () => {
  // The load-bearing guarantee: a player with no accumulated memory contributes
  // nothing to selection, so the mode plays byte-identically to before this
  // feature existed. Anything consulting the lexicon on a fresh state sees empty.
  const s = freshState();
  assert.deepEqual(dueWords(s, 0), []);
  assert.deepEqual(dueWords(s, 999), []); // even far in the future — no records at all
  assert.deepEqual(weakWords(s), []);
  assert.equal(masteredCount(s), 0);
  assert.equal(isMastered(s, 'anything'), false);
  assert.equal(hasSeen(s, 'anything'), false);
});

test('load rejects corrupt / wrong-version blobs and returns fresh', () => {
  const st = memStorage();
  st.setItem('wa_satrush_lexicon', '{not valid json');
  assert.deepEqual(load(st), freshState());

  st.setItem('wa_satrush_lexicon', JSON.stringify({ v: 99, session: 3, records: {} }));
  assert.deepEqual(load(st), freshState());

  st.setItem('wa_satrush_lexicon', JSON.stringify({ v: 1, session: 'x', records: {} }));
  assert.deepEqual(load(st), freshState());
});

test('save / load round-trips a real state', () => {
  const st = memStorage();
  const s = freshState();
  s.session = 4;
  s.mode = 'lineup';
  clear(s, 'loquacious', { stage: 0 });
  save(st, s);
  const back = load(st);
  assert.equal(back.session, 4);
  assert.equal(back.mode, 'lineup');
  assert.ok(back.records.loquacious);
  assert.equal(back.records.loquacious.cleared, 1);
});

test('Leitner: miss → box 0, each clear promotes (capped at 4)', () => {
  const s = freshState();
  clear(s, 'w');
  assert.equal(s.records.w.box, 1);
  clear(s, 'w');
  clear(s, 'w');
  assert.equal(s.records.w.box, 3);
  clear(s, 'w');
  clear(s, 'w');
  assert.equal(s.records.w.box, 4, 'box saturates at 4');
  miss(s, 'w');
  assert.equal(s.records.w.box, 0, 'a miss drops it straight back to box 0');
});

test('dueWords respects the INTERVALS schedule per box', () => {
  const s = freshState();
  s.session = 1;
  clear(s, 'a'); // box 1, lastSeen 1 → interval INTERVALS[1] = 3
  assert.equal(INTERVALS[1], 3);
  assert.deepEqual(dueWords(s, 3), [], 'not due two sessions later');
  assert.deepEqual(dueWords(s, 4), ['a'], 'due once the (widened) interval elapses');

  // A miss (box 0, interval 1) is due the very next session.
  s.session = 5;
  miss(s, 'b');
  assert.ok(!dueWords(s, 5).includes('b'), 'not due the same session it was seen');
  assert.ok(dueWords(s, 6).includes('b'), 'a missed word returns next session');
});

test('dueWords orders most-overdue first, then lowest box', () => {
  const s = freshState();
  s.session = 1;
  miss(s, 'shaky'); // box 0, lastSeen 1
  clear(s, 'solid'); // box 1, lastSeen 1
  // At a far-future session both are wildly overdue; the box-0 word is more overdue.
  const due = dueWords(s, 50);
  assert.equal(due[0], 'shaky', 'the box-0 word is the more overdue / shakier lead');
});

test('mastery is box >= 3', () => {
  const s = freshState();
  clear(s, 'm');
  clear(s, 'm');
  assert.equal(masteredCount(s), 0, 'box 2 is not yet mastered');
  clear(s, 'm');
  assert.equal(masteredCount(s), 1, 'box 3 is mastered');
  assert.equal(isMastered(s, 'm'), true);
});

test('weak = last two encounters both given-away clears', () => {
  const s = freshState();
  // Two clears that leaned on the spell-along (revealedCount > 1) → ante 1 each.
  clear(s, 'given', { stage: 2, revealedCount: 4 });
  clear(s, 'given', { stage: 2, revealedCount: 4 });
  assert.deepEqual(weakWords(s), ['given']);

  // A word cleared fast is NOT weak.
  clear(s, 'known', { stage: 0, revealedCount: 0 });
  clear(s, 'known', { stage: 0, revealedCount: 0 });
  assert.ok(!weakWords(s).includes('known'));

  // An outright miss is NOT "weak" (it's handled by the box reset instead).
  miss(s, 'gone');
  miss(s, 'gone');
  assert.ok(!weakWords(s).includes('gone'));

  // A fast clear THEN a given-away one is not weak (only the last one is ≤1).
  const s2 = freshState();
  clear(s2, 'x', { stage: 0, revealedCount: 0 });
  clear(s2, 'x', { stage: 2, revealedCount: 4 });
  assert.ok(!weakWords(s2).includes('x'), 'needs BOTH of the last two to be given away');
});

test('needsReview: true only when the LAST encounter was a miss or a give-away', () => {
  const s = freshState();
  // Never seen → not review (nothing to re-study).
  assert.equal(needsReview(s, 'unseen'), false);

  // Last encounter a MISS (ante 0) → review.
  miss(s, 'missed');
  assert.equal(needsReview(s, 'missed'), true);

  // Last encounter a GIVE-AWAY clear (ante 1) → review.
  clear(s, 'given', { stage: 2, revealedCount: 4 });
  assert.equal(needsReview(s, 'given'), true);

  // Cleared COLD (ante 5) → NOT review, even the very first time.
  clear(s, 'cold', { stage: 0, revealedCount: 0 });
  assert.equal(needsReview(s, 'cold'), false);

  // Cleared at stage 1 with no reveals (ante 3) → still "known", not review.
  clear(s, 'quick', { stage: 1, revealedCount: 0 });
  assert.equal(needsReview(s, 'quick'), false);

  // ONLY the last encounter counts: a shaky word later nailed cold is NOT review.
  const s2 = freshState();
  miss(s2, 'redeemed');
  clear(s2, 'redeemed', { stage: 0, revealedCount: 0 }); // cold now
  assert.equal(needsReview(s2, 'redeemed'), false, 'a cold clear clears the review flag');

  // ...and the reverse: a cold clear then a fresh miss IS review again.
  clear(s2, 'relapsed', { stage: 0, revealedCount: 0 });
  miss(s2, 'relapsed');
  assert.equal(needsReview(s2, 'relapsed'), true, 'a later miss re-flags it');
});

test('bestStage tracks the best ante ever, antes window is bounded', () => {
  const s = freshState();
  clear(s, 'w', { stage: 2, revealedCount: 4 }); // ante 1
  clear(s, 'w', { stage: 0, revealedCount: 0 }); // ante 5
  clear(s, 'w', { stage: 1, revealedCount: 0 }); // ante 3
  assert.equal(s.records.w.bestStage, 5, 'remembers the best clear ever');
  clear(s, 'w');
  clear(s, 'w');
  assert.ok(s.records.w.antes.length <= 3, 'antes window stays small');
});

test('load migrates lastBriefed: old flat deck → wrapped, new decks → last 3', () => {
  const st = memStorage();
  const base = { v: 1, session: 2, mode: 'briefing', records: {} };

  // OLD format: a flat array of word strings (one deck) → wrapped as a single deck.
  st.setItem('wa_satrush_lexicon', JSON.stringify({ ...base, lastBriefed: ['a', 'b', 'c'] }));
  assert.deepEqual(load(st).lastBriefed, [['a', 'b', 'c']]);

  // Empty flat array → no decks.
  st.setItem('wa_satrush_lexicon', JSON.stringify({ ...base, lastBriefed: [] }));
  assert.deepEqual(load(st).lastBriefed, []);

  // NEW format with more than 3 decks → keep only the newest 3.
  st.setItem('wa_satrush_lexicon', JSON.stringify({
    ...base,
    lastBriefed: [['d1'], ['d2'], ['d3'], ['d4']],
  }));
  assert.deepEqual(load(st).lastBriefed, [['d2'], ['d3'], ['d4']]);

  // Malformed (not an array) → empty, never a throw.
  st.setItem('wa_satrush_lexicon', JSON.stringify({ ...base, lastBriefed: 'nope' }));
  assert.deepEqual(load(st).lastBriefed, []);
});

test('storage-blocked: load → fresh, save → silent, in-memory play still works', () => {
  assert.deepEqual(load(blockedStorage), freshState(), 'blocked load degrades to fresh');
  const s = load(blockedStorage);
  // Play proceeds entirely in memory; recording never throws.
  assert.doesNotThrow(() => {
    clear(s, 'w');
    miss(s, 'w');
    save(blockedStorage, s); // silent no-op, must not throw
  });
  assert.equal(s.records.w.seen, 2);
});

test('the store is capped: evict drops highest-box-oldest first', () => {
  const s = freshState();
  s.session = 100;
  // 2000 shaky keepers (box 0) plus one mastered, oldest victim (box 4).
  for (let i = 0; i < 2000; i++) {
    s.records[`keep${i}`] = { w: `keep${i}`, box: 0, seen: 1, cleared: 0, missed: 1, lastSeen: 100, bestStage: 0, antes: [0] };
  }
  s.records.victim = { w: 'victim', box: 4, seen: 9, cleared: 9, missed: 0, lastSeen: 1, bestStage: 5, antes: [5] };
  assert.equal(Object.keys(s.records).length, 2001);
  // Any record write triggers the cap check.
  clear(s, 'keep0');
  assert.equal(Object.keys(s.records).length, 2000, 'capped back to the max');
  assert.ok(!s.records.victim, 'the mastered, oldest record was evicted first');
});

// ---- mostMissed: the persistent WORDS YOU KEEP MISSING study list ----
test('mostMissed: empty state → empty list', () => {
  assert.deepEqual(mostMissed(freshState()), []);
});

test('mostMissed: a word missed twice is sticky; a cold-cleared word is not', () => {
  const s = freshState();
  miss(s, 'ephemeral'); s.session += 1;
  miss(s, 'ephemeral'); s.session += 1; // missed 2× → sticky
  clear(s, 'table');                    // cleared cold, never missed → not sticky
  const list = mostMissed(s);
  assert.deepEqual(list.map((m) => m.w), ['ephemeral']);
  assert.equal(list[0].missed, 2);
});

test('mostMissed: a single recent miss (needsReview) is sticky; a recovered word is not', () => {
  const s = freshState();
  miss(s, 'obfuscate');                 // 1 miss, last encounter a miss → sticky via needsReview
  miss(s, 'sanguine'); s.session += 1;
  clear(s, 'sanguine', { stage: 0 });   // missed once then cleared COLD → recovered → not sticky
  const words = mostMissed(s).map((m) => m.w);
  assert.ok(words.includes('obfuscate'));
  assert.ok(!words.includes('sanguine'));
});

test('mostMissed: mastered words are never listed', () => {
  const s = freshState();
  miss(s, 'laconic'); s.session += 1;
  miss(s, 'laconic'); s.session += 1;   // 2 misses → would be sticky…
  clear(s, 'laconic', { stage: 0 }); s.session += 1;
  clear(s, 'laconic', { stage: 0 }); s.session += 1;
  clear(s, 'laconic', { stage: 0 });    // …but 3 clears → box 3 = mastered → excluded
  assert.ok(isMastered(s, 'laconic'));
  assert.deepEqual(mostMissed(s), []);
});

test('mostMissed: ranked by miss count, then rate; honours the limit', () => {
  const s = freshState();
  // A: missed 3× over 3 seen (rate 1.0). B: missed 2× over 2 seen. C: missed 2× over 4 seen (rate .5)
  for (let i = 0; i < 3; i++) { miss(s, 'aaa'); s.session += 1; }
  for (let i = 0; i < 2; i++) { miss(s, 'bbb'); s.session += 1; }
  miss(s, 'ccc'); s.session += 1; miss(s, 'ccc'); s.session += 1;
  clear(s, 'ccc'); s.session += 1; clear(s, 'ccc');
  const ranked = mostMissed(s).map((m) => m.w);
  assert.deepEqual(ranked, ['aaa', 'bbb', 'ccc']); // 3 misses > 2; among 2s, rate 1.0 > 0.5
  assert.equal(mostMissed(s, 2).length, 2);        // limit slices
});
