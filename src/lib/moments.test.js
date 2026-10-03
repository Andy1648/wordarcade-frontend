import test from 'node:test';
import assert from 'node:assert/strict';
import { createMoments, GAP_MS, PRIORITY } from './moments.js';

// a fake clock: timers fire only when advanced
function clock() {
  let t = 0;
  let timers = [];
  let id = 0;
  return {
    now: () => t,
    setTimer: (fn, ms) => { const h = ++id; timers.push({ h, at: t + ms, fn }); return h; },
    clearTimer: (h) => { timers = timers.filter((x) => x.h !== h); },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        t = next.at;
        next.fn();
      }
      t = end;
    },
    pending: () => timers.length,
  };
}

test('one heavy moment at a time, in order, with a gap between', () => {
  const c = clock();
  const m = createMoments(c);
  const log = [];
  const dones = {};
  for (const id of ['a', 'b', 'c']) m.announce({ id, start: (done) => { log.push(`${id}@${c.now()}`); dones[id] = done; } });
  assert.deepEqual(log, ['a@0']);
  c.advance(1000);
  assert.deepEqual(log, ['a@0'], 'b waits while a plays');
  dones.a();
  assert.equal(m.isPlaying(), false);
  c.advance(GAP_MS - 1);
  assert.deepEqual(log, ['a@0']);
  c.advance(1);
  assert.deepEqual(log, ['a@0', `b@${1000 + GAP_MS}`]);
  dones.b();
  c.advance(GAP_MS);
  assert.equal(log.length, 3);
});

test('higher priority jumps the queue; FIFO within a priority', () => {
  const c = clock();
  const m = createMoments(c);
  const log = [];
  let done;
  const add = (id, priority) => m.announce({ id, priority, start: (d) => { log.push(id); done = d; } });
  add('first', PRIORITY.INFO);
  add('tut', PRIORITY.TUTORIAL);
  add('info2', PRIORITY.INFO);
  add('win', PRIORITY.WIN);
  for (let i = 0; i < 4; i++) { done(); c.advance(GAP_MS); }
  assert.deepEqual(log, ['first', 'win', 'info2', 'tut']);
});

test('the same id is never queued twice', () => {
  const c = clock();
  const m = createMoments(c);
  let n = 0;
  m.announce({ id: 'x', start: () => { n++; } });
  m.announce({ id: 'x', start: () => { n++; } });
  m.announce({ id: 'y', start: () => {} });
  m.announce({ id: 'y', start: () => {} });
  assert.equal(n, 1);
  assert.deepEqual(m.snapshot().queued, ['y']);
});

test('a moment that never calls done is released after maxMs — a lost callback cannot jam the queue', () => {
  const c = clock();
  const m = createMoments(c);
  const log = [];
  m.announce({ id: 'lost', maxMs: 2000, start: () => log.push('lost') });
  m.announce({ id: 'next', start: () => log.push('next') });
  c.advance(1999);
  assert.deepEqual(log, ['lost']);
  c.advance(1 + GAP_MS);
  assert.deepEqual(log, ['lost', 'next']);
});

test('a moment that throws on start is released', () => {
  const c = clock();
  const m = createMoments(c);
  const log = [];
  m.announce({ id: 'bad', start: () => { throw new Error('boom'); } });
  m.announce({ id: 'ok', start: () => log.push('ok') });
  c.advance(GAP_MS);
  assert.deepEqual(log, ['ok']);
});

test('hold() stops new moments starting (counted); the current one still finishes', () => {
  const c = clock();
  const m = createMoments(c);
  const log = [];
  let done;
  m.announce({ id: 'a', start: (d) => { log.push('a'); done = d; } });
  const un1 = m.hold();
  const un2 = m.hold();
  m.announce({ id: 'b', start: () => log.push('b') });
  done();
  c.advance(5000);
  assert.deepEqual(log, ['a']);
  un1();
  un1(); // double-unhold is a no-op
  c.advance(5000);
  assert.deepEqual(log, ['a'], 'still one hold left');
  un2();
  c.advance(GAP_MS);
  assert.deepEqual(log, ['a', 'b']);
});

test('cancel drops a queued moment, or ends a playing one', () => {
  const c = clock();
  const m = createMoments(c);
  const log = [];
  const cancelA = m.announce({ id: 'a', start: () => log.push('a') });
  const cancelB = m.announce({ id: 'b', start: () => log.push('b') });
  m.announce({ id: 'c', start: () => log.push('c') });
  cancelB();
  cancelA();
  c.advance(GAP_MS);
  assert.deepEqual(log, ['a', 'c']);
});

test('no timers run while the queue is empty', () => {
  const c = clock();
  const m = createMoments(c);
  m.announce({ id: 'a', start: (d) => d() });
  c.advance(GAP_MS * 2);
  assert.equal(c.pending(), 0);
  m.clear();
  assert.deepEqual(m.snapshot(), { current: null, queued: [], busy: false });
});

test('subscribers see the queue change', () => {
  const c = clock();
  const m = createMoments(c);
  const seen = [];
  m.subscribe((s) => seen.push(s.current));
  m.announce({ id: 'a', start: (d) => d() });
  assert.ok(seen.includes('a'));
  assert.equal(seen.at(-1), null);
});
