// wpmLive.test.js — pins the ACTIVE-TYPING-TIME model (§2): a word's span runs from its first
// keystroke to its accept, and the idle gap BETWEEN words is never counted. Uses a controllable
// clock (performance.now) + a mock localStorage so the timing is deterministic, not wall-clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wpmStart,
  wpmKeyStroke,
  wpmAddWord,
  wpmCurrent,
  wpmEnd,
  __resetWpmLiveForTest,
} from './wpmLive.js';
import { bestWpm } from './wpm.js';

// A clock we drive by hand. wpmLive reads performance.now() via its now() helper.
let clock = 0;
function withClockAndStorage(fn) {
  const savedPerf = globalThis.performance;
  const savedLS = globalThis.localStorage;
  clock = 0;
  globalThis.performance = { now: () => clock };
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  __resetWpmLiveForTest();
  try {
    return fn();
  } finally {
    __resetWpmLiveForTest();
    if (savedPerf === undefined) delete globalThis.performance; else globalThis.performance = savedPerf;
    if (savedLS === undefined) delete globalThis.localStorage; else globalThis.localStorage = savedLS;
  }
}

test('idle time between words is NOT counted — only active spans (first keystroke → accept)', () => {
  withClockAndStorage(() => {
    wpmStart('chain');
    // Word 1: first keystroke at t=0, accepted at t=2000 → a 2000ms active span, 5 chars.
    clock = 0; wpmKeyStroke();
    clock = 1000; wpmKeyStroke(); // mid-word keystroke — span already open, no-op
    clock = 2000; wpmAddWord('hello');

    // 8 seconds of idle (reading the next prompt / thinking) — this must NOT count.
    clock = 10000;
    // 5 chars over 2000ms active = (5/5)/(2000/60000) = 30 WPM. If idle were counted it'd read ~6.
    assert.equal(wpmCurrent(), 30);

    // Word 2: another 2000ms active span, +5 chars.
    clock = 10000; wpmKeyStroke();
    clock = 12000; wpmAddWord('world');
    // 10 chars over 4000ms active = 30 WPM (unchanged) — the 8s idle stayed out of the denominator.
    assert.equal(wpmCurrent(), 30);

    wpmEnd(); // flush: recordSession(chars:10, ms:4000) → 30 WPM, above the min thresholds
    assert.equal(bestWpm('chain'), 30);
  });
});

test('the live readout climbs WHILE a span is open (current word counts)', () => {
  withClockAndStorage(() => {
    wpmStart('menu');
    clock = 0; wpmKeyStroke(); // span opens
    // Nothing accepted yet, but 1 char isn't logged until accept — so chars=0 → 0 WPM regardless.
    clock = 500;
    assert.equal(wpmCurrent(), 0); // no accepted chars yet
    wpmAddWord('cats'); // t=500: 4 chars over 500ms = (4/5)/(500/60000) = 96 WPM
    assert.equal(wpmCurrent(), 96);
  });
});
