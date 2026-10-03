// node --test — WORD RACE client: the race_* reducer, the local precheck mirror, the pace store,
// and PAYOUT HONESTY (what the card quotes == what a race banks).
import test from 'node:test';
import assert from 'node:assert/strict';
import { raceReducer, precheck, myFragment, localResult, RACE_REASON_COPY } from './raceState.js';
import { recentPace, recordPace, RACE_PACE_KEY } from './racePace.js';
import { bankRaceWord } from './racePayout.js';
import { perWordRateNow, getWins } from '../progress/wins.js';

function withStorage(fn, seed = {}) {
  const saved = globalThis.localStorage;
  const map = new Map(Object.entries(seed).map(([k, v]) => [k, String(v)]));
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn();
  } finally {
    globalThis.localStorage = saved;
  }
}

const START = {
  type: 'race_start',
  payload: {
    seed: 9,
    fragments: ['ing', 'ab', 'tr'],
    tiers: ['e', 'm', 'h'],
    target: 3,
    capMs: 90000,
    racers: [
      { id: 'me', name: 'ME' },
      { id: 'bo', name: 'BO', isBot: true },
    ],
    serverNow: 10_000,
    goAt: 13_000,
  },
};
const run = (frames, now = 1_000) => frames.reduce((s, f) => raceReducer(s, { frame: f, now }), null);

test('race_start builds lanes; goAt converts to the local clock via serverNow', () => {
  const s = run([START], 1_000); // local clock is 9s behind the server
  assert.equal(s.status, 'countdown');
  assert.equal(s.goAt, 4_000);
  assert.deepEqual(s.racers.map((r) => [r.id, r.index, r.isBot]), [['me', 0, false], ['bo', 0, true]]);
  assert.equal(myFragment(s, 'me'), 'ing');
});

test('race_go -> racing; progress moves only that racer; never backwards', () => {
  let s = run([START, { type: 'race_go', payload: { goAt: 13_000, endsAt: 103_000, serverNow: 13_000 } }], 4_000);
  assert.equal(s.status, 'racing');
  assert.equal(s.endsAt, 94_000);
  s = raceReducer(s, { frame: { type: 'race_progress', payload: { racerId: 'bo', index: 2, word: 'abbey' } } });
  s = raceReducer(s, { frame: { type: 'race_progress', payload: { racerId: 'bo', index: 1 } } }); // stale
  assert.equal(s.racers[1].index, 2);
  assert.equal(s.racers[1].lastWord, 'abbey');
  assert.equal(s.racers[0].index, 0);
});

test('two frames in one drain are BOTH applied (FIFO, nothing dropped)', () => {
  const s = run([
    START,
    { type: 'race_progress', payload: { racerId: 'me', index: 1, word: 'sing' } },
    { type: 'race_progress', payload: { racerId: 'bo', index: 1, word: 'ring' } },
  ]);
  assert.deepEqual(s.racers.map((r) => r.index), [1, 1]);
});

test('race_word_result carries the reason; race_over takes the server standings', () => {
  let s = run([START, { type: 'race_word_result', payload: { accepted: false, word: 'xx', reason: 'too_short' } }]);
  assert.equal(s.lastResult.reason, 'too_short');
  assert.equal(s.resultSeq, 1);
  s = raceReducer(s, {
    frame: {
      type: 'race_over',
      payload: { winnerId: 'bo', reason: 'cap', standings: [{ id: 'bo', words: 2 }, { id: 'me', words: 1 }] },
    },
  });
  assert.equal(s.status, 'over');
  assert.equal(s.over.winnerId, 'bo');
  assert.deepEqual(s.racers.map((r) => r.index), [1, 2]);
});

test('every server reject reason has player copy', () => {
  for (const r of ['too_short', 'missing_combo', 'already_used', 'not_a_word', 'race_not_live']) {
    assert.ok(RACE_REASON_COPY[r], r);
  }
});

test('precheck mirrors the server rules and order; used words are per racer', () => {
  assert.equal(precheck('ab', 'ing', new Set()), 'too_short');
  assert.equal(precheck('table', 'ing', new Set()), 'missing_combo');
  assert.equal(precheck(' SING ', 'ing', new Set(['sing'])), 'already_used');
  assert.equal(precheck('sing', 'ing', new Set()), null);
  assert.equal(precheck('sing', null, new Set()), 'race_not_live');
  const s = localResult(run([START]), { accepted: false, word: 'ab', reason: 'too_short' });
  assert.equal(s.lastResult.local, true);
});

test('reset clears the race', () => {
  assert.equal(raceReducer(run([START]), { type: 'reset' }), null);
});

test('pace: median of the last five races; <3 words is not a pace', () => {
  withStorage(() => {
    assert.equal(recentPace(), null);
    assert.equal(recordPace(2, 10_000), null);
    recordPace(10, 40_000); // 4000
    recordPace(10, 60_000); // 6000
    recordPace(10, 20_000); // 2000
    assert.equal(recentPace(), 4000);
    for (let i = 0; i < 6; i++) recordPace(10, 30_000);
    assert.equal(JSON.parse(globalThis.localStorage.getItem(RACE_PACE_KEY)).length, 5);
    assert.equal(recentPace(), 3000);
  });
});

test('PAYOUT HONESTY: 12 five-letter race words bank exactly 12 x the card rate', () => {
  withStorage(() => {
    const card = perWordRateNow({ mode: 'word-race' }); // what the WORD RACE card/dialog prints
    assert.ok(card.rate > 0);
    const before = getWins();
    let banked = 0;
    for (let i = 0; i < 12; i++) banked += bankRaceWord({ word: 'sting', prevWords: i }).wins;
    assert.equal(banked, Math.floor(card.rate * 12));
    assert.equal(getWins() - before, banked, 'the balance moved by exactly what the race reports');
  });
});

test('PAYOUT HONESTY: the 3-word gate is the pipeline gate — words 1-2 hold, word 3 releases all', () => {
  withStorage(() => {
    const card = perWordRateNow({ mode: 'word-race' });
    assert.equal(bankRaceWord({ word: 'sting', prevWords: 0 }).wins, 0);
    assert.equal(bankRaceWord({ word: 'sting', prevWords: 1 }).wins, 0);
    assert.equal(bankRaceWord({ word: 'sting', prevWords: 2 }).wins, Math.floor(card.rate * 3));
  });
});

test('PAYOUT HONESTY: XP per word equals the card LEVEL XP (v11: the bar credit, not the wins product)', () => {
  withStorage(() => {
    const card = perWordRateNow({ mode: 'word-race' });
    assert.equal(bankRaceWord({ word: 'sting', prevWords: 5 }).xp, card.levelXp);
  });
});

// ---- ENTIRE-WORD racing (Andy oct2 A6) ----
test('race_start (variant words) stores the words as the sequence', () => {
  const s = raceReducer(null, {
    frame: { type: 'race_start', payload: { seed: 1, variant: 'words', words: ['house', 'river'], fragments: ['house', 'river'], target: 2, capMs: 60000, racers: [{ id: 'a', name: 'A' }], serverNow: 0, goAt: 3000 } },
    now: 0,
  });
  assert.equal(s.variant, 'words');
  assert.deepEqual(s.fragments, ['house', 'river']);
  assert.equal(s.target, 2);
});

test('precheck (words): only the exact word passes; anything else is wrong_word', () => {
  assert.equal(precheck(' HOUSE ', 'house', new Set(), 'words'), null);
  assert.equal(precheck('houses', 'house', new Set(), 'words'), 'wrong_word');
  assert.equal(precheck('hou', 'house', new Set(), 'words'), 'wrong_word');
  assert.equal(precheck('mouse', 'house', new Set(), 'words'), 'wrong_word');
  assert.ok(RACE_REASON_COPY.wrong_word);
  // the fragment race keeps its own rules
  assert.equal(precheck('mouse', 'ous', new Set()), null);
});
