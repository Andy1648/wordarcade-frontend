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
  masteredCount,
  isMastered,
  hasSeen,
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
  clear(s, 'a'); // box 1, lastSeen 1 → interval INTERVALS[1] = 2
  assert.equal(INTERVALS[1], 2);
  assert.deepEqual(dueWords(s, 2), [], 'not due one session later');
  assert.deepEqual(dueWords(s, 3), ['a'], 'due once the interval elapses');

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
