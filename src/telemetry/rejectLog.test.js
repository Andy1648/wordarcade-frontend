import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRejectLog, BATCH_MAX, MAX_FLUSHES } from './rejectLog.js';

function rig() {
  const calls = [];
  let pending = null;
  const log = createRejectLog({ send: (mode, words) => { calls.push([mode, words]); return Promise.resolve(); }, setTimer: (fn) => { pending = fn; return 1; }, clearTimer: () => { pending = null; } });
  return { log, calls, tick: () => { const f = pending; pending = null; if (f) f(); } };
}

test('only valid a–z words of the solo modes are queued, once each', () => {
  const { log } = rig();
  assert.equal(log.note('Zyzzyva', 'fuse'), true);
  assert.equal(log.note('zyzzyva', 'fuse'), false, 'deduped');
  assert.equal(log.note('a', 'fuse'), false, 'too short');
  assert.equal(log.note('hello123', 'fuse'), false, 'not a–z');
  assert.equal(log.note('word', 'word-bomb'), false, 'not a solo mode');
  assert.equal(log.note('zyzzyva', 'chain'), true, 'per mode');
});

test('batched: one call per mode per window, at most BATCH_MAX words, nothing sent twice', () => {
  const { log, calls, tick } = rig();
  for (let i = 0; i < BATCH_MAX + 5; i++) log.note(`word${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`, 'fuse');
  assert.equal(calls.length, 0, 'nothing until the window ends');
  tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].length, BATCH_MAX);
  tick(); // the leftover 5 go next window
  assert.equal(calls.length, 2);
  assert.equal(calls[1][1].length, 5);
  log.note(calls[0][1][0], 'fuse');
  log.flush();
  assert.equal(calls.length, 2, 'an already-sent word is never sent again');
});

test('at most MAX_FLUSHES calls a session, then it stops queueing', () => {
  const { log, calls } = rig();
  for (let k = 0; k < MAX_FLUSHES + 3; k++) { log.note(`batch${String.fromCharCode(97 + k)}`, 'fuse'); log.flush(); }
  assert.equal(calls.length, MAX_FLUSHES);
  assert.equal(log.note('another', 'fuse'), false);
});

test('a failing sender is swallowed', () => {
  const log = createRejectLog({ send: () => Promise.reject(new Error('offline')), setTimer: () => 1, clearTimer: () => {} });
  log.note('offline', 'fuse');
  assert.doesNotThrow(() => log.flush());
});
