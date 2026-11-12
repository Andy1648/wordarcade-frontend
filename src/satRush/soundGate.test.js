// soundGate.test.js — the rush's transition sounds never stack into noise.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGate, gateCue, GATE_WINDOW_MS, CUE_PRIORITY } from './soundGate.js';

test('a lone cue plays; unknown cues never do', () => {
  const g = createGate();
  assert.equal(gateCue(g, 'cardIn', 0), true);
  assert.equal(gateCue(g, 'nope', 500), false);
});

test('same-tick screen change + first card = ONE sound (the press)', () => {
  const g = createGate();
  assert.equal(gateCue(g, 'press', 1000), true);
  assert.equal(gateCue(g, 'cardIn', 1000), false);
});

test('a higher-priority cue still lands right after a lower one', () => {
  const g = createGate();
  assert.equal(gateCue(g, 'tick', 0), true);
  assert.equal(gateCue(g, 'capture', 20), true);
  // …and a stage tick right after the capture is swallowed
  assert.equal(gateCue(g, 'tick', 40), false);
});

test('the same cue repeats once the window has passed', () => {
  const g = createGate();
  assert.equal(gateCue(g, 'strike', 0), true);
  assert.equal(gateCue(g, 'strike', GATE_WINDOW_MS - 1), false);
  assert.equal(gateCue(g, 'strike', GATE_WINDOW_MS + 1), true);
});

test('the run ending outranks every other transition', () => {
  const top = Math.max(...Object.values(CUE_PRIORITY));
  assert.equal(CUE_PRIORITY.caseClosed, top);
  const g = createGate();
  assert.equal(gateCue(g, 'miss', 0), true);
  assert.equal(gateCue(g, 'caseClosed', 10), true);
});

test('a clock that goes backwards (tab restored) never wedges the gate', () => {
  const g = createGate();
  assert.equal(gateCue(g, 'capture', 10_000), true);
  assert.equal(gateCue(g, 'cardIn', 5_000), true);
});
