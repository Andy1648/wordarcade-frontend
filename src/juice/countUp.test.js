// node --test — THE one count-up (Andy oct3 #4): duration scaled to the jump, retarget instead of
// stacking, reduced motion instant, a drop instant, finite (nothing scheduled at rest).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCountUp, countUpDuration, easeOutCubic, COUNT_MIN_MS, COUNT_MAX_MS } from './countUp.js';

// A fake clock + frame queue: `frame(ms)` advances the clock and runs every scheduled callback.
function fakeLoop() {
  let t = 0;
  let q = [];
  let nextId = 1;
  return {
    now: () => t,
    raf: (fn) => {
      const id = nextId++;
      q.push({ id, fn });
      return id;
    },
    caf: (id) => {
      q = q.filter((e) => e.id !== id);
    },
    frame(ms = 16) {
      t += ms;
      const run = q;
      q = [];
      for (const e of run) e.fn(t);
    },
    pending: () => q.length,
  };
}

test('duration: 1.2 s for a nudge, 2 s for a ×10+ jump or a count from nothing, log-scaled between', () => {
  assert.equal(countUpDuration(1000, 1010), Math.round(COUNT_MIN_MS + (COUNT_MAX_MS - COUNT_MIN_MS) * Math.log10(1.01)));
  assert.ok(countUpDuration(1000, 1010) < 1220);
  assert.equal(countUpDuration(0, 5000), COUNT_MAX_MS);
  assert.equal(countUpDuration(100, 100000), COUNT_MAX_MS);
  const dbl = countUpDuration(1000, 2000);
  assert.ok(dbl > 1400 && dbl < 1500, `×2 is ~1.44 s, got ${dbl}`);
  // monotone in the jump
  assert.ok(countUpDuration(1000, 1100) < countUpDuration(1000, 3000));
  // garbage never yields a non-finite duration
  for (const [a, b] of [[NaN, 5], [5, NaN], [Infinity, 1], [1, Infinity], [1e300, 1.7e308]]) {
    const d = countUpDuration(a, b);
    assert.ok(Number.isFinite(d) && d >= COUNT_MIN_MS && d <= COUNT_MAX_MS, `${a}→${b}: ${d}`);
  }
  assert.equal(countUpDuration(0, 10, { maxMs: 1200 }), 1200);
});

test('ease-out cubic is clamped to 0..1', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(2), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);
});

test('counts up over the computed duration and stops scheduling at rest', () => {
  const L = fakeLoop();
  const frames = [];
  let done = null;
  const c = createCountUp({ initial: 100, reduced: () => false, now: L.now, raf: L.raf, caf: L.caf, onFrame: (v, g) => frames.push([v, g]), onDone: (v, g) => (done = [v, g]) });
  c.to(200);
  const dur = countUpDuration(100, 200);
  assert.ok(c.running);
  for (let i = 0; i < 200 && L.pending(); i += 1) L.frame(16);
  assert.deepEqual(done, [200, 100]);
  assert.equal(L.pending(), 0, 'nothing scheduled at rest');
  assert.ok(frames.length >= Math.floor(dur / 16) - 1, 'it actually took the duration');
  for (let i = 1; i < frames.length; i += 1) assert.ok(frames[i][0] >= frames[i - 1][0], 'never counts backwards');
});

test('a new gain mid-count RETARGETS the same count (one loop, gain measured from the chain start)', () => {
  const L = fakeLoop();
  let last = null;
  const c = createCountUp({ initial: 0, reduced: () => false, now: L.now, raf: L.raf, caf: L.caf, onFrame: (v, g) => (last = [v, g]) });
  c.to(10);
  L.frame(300);
  const mid = c.value;
  assert.ok(mid > 0 && mid < 10);
  c.to(30);
  assert.equal(L.pending(), 1, 'still exactly one scheduled frame — no second loop');
  L.frame(16);
  assert.ok(c.value >= mid, 'continues from the number on screen, no jump back');
  assert.equal(last[1], 30, '+gain covers the whole chain (0 → 30), not just the last word');
  for (let i = 0; i < 300 && L.pending(); i += 1) L.frame(16);
  assert.equal(c.value, 30);
  // the next chain starts fresh from where it landed
  c.to(35);
  L.frame(16);
  assert.equal(last[1], 5);
});

test('reduced motion lands instantly; a drop (a purchase) is instant and never counts down', () => {
  const L = fakeLoop();
  let last = null;
  const r = createCountUp({ initial: 5, reduced: () => true, now: L.now, raf: L.raf, caf: L.caf, onFrame: (v, g) => (last = [v, g]) });
  r.to(500);
  assert.deepEqual(last, [500, 495]);
  assert.equal(L.pending(), 0);

  const d = createCountUp({ initial: 500, reduced: () => false, now: L.now, raf: L.raf, caf: L.caf, onFrame: (v) => (last = [v]) });
  d.to(120);
  assert.equal(d.value, 120);
  assert.equal(L.pending(), 0);
});

test('set() lands immediately and cancel() stops the loop', () => {
  const L = fakeLoop();
  const c = createCountUp({ initial: 0, reduced: () => false, now: L.now, raf: L.raf, caf: L.caf });
  c.to(1e9);
  L.frame(16);
  c.set(42);
  assert.equal(c.value, 42);
  assert.equal(L.pending(), 0);
  c.to(100);
  c.cancel();
  assert.equal(L.pending(), 0);
});

test('fixedMs overrides the log rule (end-screen scores keep their own beat)', () => {
  const L = fakeLoop();
  let done = false;
  const c = createCountUp({ initial: 0, fixedMs: 500, reduced: () => false, now: L.now, raf: L.raf, caf: L.caf, onDone: () => (done = true) });
  c.to(1e6);
  L.frame(400);
  assert.equal(done, false);
  L.frame(120);
  assert.equal(done, true);
});
