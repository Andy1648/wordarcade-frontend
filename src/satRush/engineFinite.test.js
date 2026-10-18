// engineFinite.test.js — FINITE runs (oct17): the engine plays a queue, brings misses and shaky
// clears back (the dropout schedule), and completes when every word is settled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSatRushEngine } from './engine.js';

const IDENTITY_RNG = () => 0.9999999;
const row = (word, tier = 1) => ({ word, pos: 'n', tier, gloss: `def ${word}`, context: 'a ___ b', root: null, alts: [] });
const QUEUE = ['alpha', 'bravo', 'charlie', 'delta'].map((w) => row(w));

function engine(config = {}, queue = QUEUE) {
  return createSatRushEngine({
    words: QUEUE,
    queue,
    rng: IDENTITY_RNG,
    config: { revenantOffset: 2, requeueShaky: true, ...config },
  });
}

test('a clean run serves the queue in order and then COMPLETES', () => {
  const e = engine();
  const served = [];
  let cur;
  while ((cur = e.nextWord())) {
    served.push(cur.word);
    e.submitCorrect({ revealed: 0 });
  }
  assert.deepEqual(served, ['alpha', 'bravo', 'charlie', 'delta']);
  const s = e.getState();
  assert.equal(s.complete, true);
  assert.equal(s.gameOver, true);
  assert.equal(s.settled, 4);
  const r = e.results();
  assert.equal(r.complete, true);
  assert.equal(r.runTotal, 4);
  assert.equal(r.caseLog.length, 4);
  assert.ok(r.caseLog.every((c) => c.captured && c.clean && c.attempts === 1));
});

test('a miss comes back revenantOffset words later and must be captured before the case closes', () => {
  const e = engine();
  e.nextWord(); // alpha
  e.miss();
  assert.equal(e.nextWord().word, 'bravo');
  e.submitCorrect();
  const back = e.nextWord(); // slot 3 = due
  assert.equal(back.word, 'alpha');
  assert.equal(back.isRevenant, true);
  e.submitCorrect();
  e.nextWord(); e.submitCorrect(); // charlie
  e.nextWord(); e.submitCorrect(); // delta
  assert.equal(e.nextWord(), null);
  const r = e.results();
  assert.equal(r.complete, true);
  const alpha = r.caseLog.find((c) => c.word === 'alpha');
  assert.equal(alpha.misses, 1);
  assert.equal(alpha.attempts, 2);
  assert.equal(alpha.captured, true);
});

test('pending returns are served after the queue runs dry, even before they are due', () => {
  const e = engine({ revenantOffset: 50 }, QUEUE.slice(0, 2));
  e.nextWord(); e.miss(); // alpha → due at 51
  e.nextWord(); e.submitCorrect(); // bravo
  const back = e.nextWord();
  assert.equal(back && back.word, 'alpha');
  e.submitCorrect();
  assert.equal(e.nextWord(), null);
  assert.equal(e.getState().complete, true);
});

test('a SHAKY clear (leaned on the spell-along) comes back as a second look — no life, no bonus', () => {
  const e = engine();
  e.nextWord(); // alpha
  const r = e.submitCorrect({ revealed: 3 });
  assert.equal(r.requeued, true);
  assert.equal(e.getState().lives, 3);
  assert.equal(e.getState().settled, 0);
  e.nextWord(); e.submitCorrect(); // bravo
  const back = e.nextWord();
  assert.equal(back.word, 'alpha');
  assert.equal(back.isReturn, true);
  assert.equal(back.isRevenant, false);
  assert.equal(back.stage, 0);
  assert.equal(e.currentMultiplier(), 5);
});

test('a word comes back at most maxRequeues times for shaky clears', () => {
  const e = engine({ maxRequeues: 1 }, [row('solo')]);
  e.nextWord();
  assert.equal(e.submitCorrect({ revealed: 4 }).requeued, true);
  assert.equal(e.nextWord().word, 'solo');
  assert.equal(e.submitCorrect({ revealed: 4 }).requeued, false);
  assert.equal(e.nextWord(), null);
  const c = e.results().caseLog[0];
  assert.equal(c.clean, false);
  assert.equal(c.attempts, 2);
});

test('out of lives ends a finite run WITHOUT completing it', () => {
  const e = engine({ lives: 1 });
  e.nextWord();
  const m = e.miss();
  assert.equal(m.gameOver, true);
  assert.equal(e.getState().complete, false);
  assert.equal(e.nextWord(), null);
  assert.equal(e.results().complete, false);
});

test('runRemaining counts the queue plus pending returns', () => {
  const e = engine();
  assert.equal(e.getState().runRemaining, 4);
  e.nextWord();
  assert.equal(e.getState().runRemaining, 3);
  e.miss();
  assert.equal(e.getState().runRemaining, 4);
});

test('endless mode (no queue) is unchanged: no completion, requeueShaky off by default', () => {
  const e = createSatRushEngine({ words: QUEUE, rng: IDENTITY_RNG });
  e.nextWord();
  assert.equal(e.submitCorrect({ revealed: 3 }).requeued, false);
  assert.equal(e.getState().finite, false);
  assert.equal(e.getState().runRemaining, null);
});
