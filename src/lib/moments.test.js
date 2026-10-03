import test from 'node:test';
import assert from 'node:assert/strict';
import { createMoments, GAP_MS, PRIORITY, GAME_PRIORITY } from './moments.js';

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

// ---- feel ladder (PASS 2): in-game heavy moments share the queue ----

test('gap between heavy moments is >= 250ms', () => {
  assert.ok(GAP_MS >= 250);
});

test('in-game priority: FRENZY start > CLUTCH > TIMER OVER > BOOST start', () => {
  assert.ok(GAME_PRIORITY.FRENZY_START > GAME_PRIORITY.CLUTCH);
  assert.ok(GAME_PRIORITY.CLUTCH > GAME_PRIORITY.TIMER_OVER);
  assert.ok(GAME_PRIORITY.TIMER_OVER > GAME_PRIORITY.BOOST_START);
  const c = clock();
  const m = createMoments(c);
  const log = [];
  let doneFirst;
  m.announce({ id: 'over', priority: GAME_PRIORITY.TIMER_OVER, start: (d) => { log.push('over'); doneFirst = d; } });
  m.announce({ id: 'boost', priority: GAME_PRIORITY.BOOST_START, start: () => log.push('boost') });
  m.announce({ id: 'clutch', priority: GAME_PRIORITY.CLUTCH, start: () => log.push('clutch') });
  m.announce({ id: 'frenzy', priority: GAME_PRIORITY.FRENZY_START, start: () => log.push('frenzy') });
  doneFirst();
  c.advance(GAP_MS);
  assert.deepEqual(log, ['over', 'frenzy'], 'never two at once; the highest waiting goes next');
});

test('a moment that waited past expireMs is dropped, never played late', () => {
  const c = clock();
  const m = createMoments(c);
  const log = [];
  let doneA;
  let expired = 0;
  m.announce({ id: 'a', start: (d) => { log.push('a'); doneA = d; } });
  m.announce({ id: 'stale', expireMs: 500, onExpire: () => { expired += 1; }, start: () => log.push('stale') });
  m.announce({ id: 'fresh', start: () => log.push('fresh') });
  c.advance(1300);
  doneA();
  c.advance(GAP_MS);
  assert.deepEqual(log, ['a', 'fresh']);
  assert.equal(expired, 1);
});

test('a moment within its expireMs still plays', () => {
  const c = clock();
  const m = createMoments(c);
  const log = [];
  let doneA;
  m.announce({ id: 'a', start: (d) => { log.push('a'); doneA = d; } });
  m.announce({ id: 'b', expireMs: 3000, start: () => log.push('b') });
  c.advance(1000);
  doneA();
  c.advance(GAP_MS);
  assert.deepEqual(log, ['a', 'b']);
});

test('an interruptible (lingering) moment steps aside for a HIGHER priority one, and can queue itself again', () => {
  const c = clock();
  const m = createMoments(c);
  const log = [];
  let interrupted = 0;
  const claim = () => m.announce({
    id: 'claim', priority: PRIORITY.REWARD, maxMs: 9000, interruptible: true,
    start: () => log.push(`claim@${c.now()}`),
    onInterrupt: () => { interrupted += 1; claim(); },
  });
  claim();
  assert.deepEqual(log, ['claim@0']);
  c.advance(500);
  let wallDone;
  m.announce({ id: 'wall', priority: PRIORITY.LEVEL, start: (d) => { log.push(`wall@${c.now()}`); wallDone = d; } });
  assert.equal(interrupted, 1, 'the claim popup was told to step aside');
  assert.equal(m.snapshot().current, null, 'released at once');
  c.advance(GAP_MS);
  assert.deepEqual(log, ['claim@0', `wall@${500 + GAP_MS}`], 'the wall waits only the gap, never the popup');
  wallDone();
  c.advance(GAP_MS);
  assert.deepEqual(log.slice(-1), [`claim@${500 + 2 * GAP_MS}`], 'the popup comes back after');
});

test('an interruptible moment is NOT interrupted by an equal or lower priority one', () => {
  const c = clock();
  const m = createMoments(c);
  let interrupted = 0;
  m.announce({ id: 'claim', priority: PRIORITY.REWARD, interruptible: true, start: () => {}, onInterrupt: () => { interrupted += 1; } });
  m.announce({ id: 'other', priority: PRIORITY.REWARD, start: () => {} });
  m.announce({ id: 'tut', priority: PRIORITY.TUTORIAL, start: () => {} });
  assert.equal(interrupted, 0);
  assert.equal(m.snapshot().current, 'claim');
});

test('a non-interruptible moment is never interrupted, whatever arrives', () => {
  const c = clock();
  const m = createMoments(c);
  m.announce({ id: 'tier', priority: PRIORITY.INFO, start: () => {} });
  m.announce({ id: 'win', priority: PRIORITY.WIN, start: () => {} });
  assert.equal(m.snapshot().current, 'tier');
});

test('a stale cancel never releases a LATER moment with the same id', () => {
  const c = clock();
  const m = createMoments(c);
  let done;
  const cancel1 = m.announce({ id: 'x', start: (d) => { done = d; } });
  done();
  c.advance(GAP_MS);
  m.announce({ id: 'x', start: () => {} });
  assert.equal(m.snapshot().current, 'x');
  cancel1();
  assert.equal(m.snapshot().current, 'x', 'the second x keeps playing');
});
