// kit.test.js — the v2 kit's logic: hold-to-confirm timing, the pill count-up, the ≤ 1 s XP climb,
// the banner stack. All clocks injected; no DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHoldConfirm, HOLD_MS, HOLD_SHAKE_AT_MS } from './holdConfirm.js';
import { createCountTween, COUNT_GAIN_MS, COUNT_SPEND_MS, easeOutQuart } from './countTween.js';
import { planClimb, createClimbPlayer, CLIMB_MAX_MS, GLIDE_MS, glideEase } from './climb.js';
import { planBar } from '../../lib/barPlan.js';
import { createBannerStore, BANNER_MS, BANNER_LEAVE_MS } from './bannerStore.js';

// A tiny deterministic clock: timers + rAF on one virtual timeline.
function fakeClock() {
  let t = 0;
  let seq = 0;
  const q = new Map(); // id -> { at, fn }
  const setTimer = (fn, ms) => { seq += 1; q.set(seq, { at: t + Math.max(0, ms), fn }); return seq; };
  const clearTimer = (id) => { q.delete(id); };
  const raf = (fn) => setTimer(() => fn(t), 16);
  const advance = (ms) => {
    const end = t + ms;
    for (;;) {
      let next = null;
      for (const [id, e] of q) if (e.at <= end && (!next || e.at < next[1].at)) next = [id, e];
      if (!next) break;
      q.delete(next[0]);
      t = next[1].at;
      next[1].fn();
    }
    t = end;
  };
  return { now: () => t, setTimer, clearTimer, raf, caf: clearTimer, advance, pending: () => q.size };
}

// ---------------------------------------------------------------- hold-to-confirm
test('hold: commits only after the full hold, with the shake phase at 550 ms', () => {
  const c = fakeClock();
  const phases = [];
  let commits = 0;
  const h = createHoldConfirm({ ...c, onPhase: (p) => phases.push(p), onCommit: () => { commits += 1; } });
  assert.equal(h.start(), true);
  c.advance(HOLD_SHAKE_AT_MS - 1);
  assert.deepEqual(phases, [1]);
  c.advance(1);
  assert.deepEqual(phases, [1, 2]);
  c.advance(HOLD_MS - HOLD_SHAKE_AT_MS - 1);
  assert.equal(commits, 0, 'one ms short of the hold is not a commit');
  c.advance(1);
  assert.equal(commits, 1);
  assert.deepEqual(phases, [1, 2, 0]);
  assert.equal(h.holding, false);
  assert.equal(h.end(), false, 'a release after the commit is a no-op');
});

test('hold: an early release cancels — never commits', () => {
  const c = fakeClock();
  let commits = 0;
  let cancelledAt = -1;
  const h = createHoldConfirm({ ...c, onCommit: () => { commits += 1; }, onCancel: (ms) => { cancelledAt = ms; } });
  h.start();
  c.advance(999);
  assert.equal(h.end(), true);
  assert.equal(cancelledAt, 999);
  c.advance(5000);
  assert.equal(commits, 0);
  assert.equal(c.pending(), 0, 'no timer survives a cancel');
});

test('hold: a second start while holding (key auto-repeat) is ignored', () => {
  const c = fakeClock();
  let commits = 0;
  const h = createHoldConfirm({ ...c, onCommit: () => { commits += 1; } });
  h.start();
  c.advance(400);
  assert.equal(h.start(), false);
  c.advance(600);
  assert.equal(commits, 1, 'the hold still commits at 1.0 s from the FIRST press');
  assert.ok(Math.abs(h.progress()) < 1e-9);
});

test('hold: progress runs 0 → 1 across the hold', () => {
  const c = fakeClock();
  const h = createHoldConfirm({ ...c });
  h.start();
  c.advance(250);
  assert.equal(h.progress(), 0.25);
  h.dispose();
  assert.equal(h.holding, false);
});

// ---------------------------------------------------------------- count-up
test('count: a gain counts for 700 ms with ease-out quart and lands exactly', () => {
  const c = fakeClock();
  const frames = [];
  let done = null;
  const k = createCountTween({ initial: 240, ...c, reduced: () => false, onFrame: (v) => frames.push(v), onDone: (v) => { done = v; } });
  k.to(315);
  c.advance(COUNT_GAIN_MS / 2);
  const mid = frames[frames.length - 1];
  assert.ok(mid > 240 + 75 * 0.85 && mid < 315, `quart ease is past 85% at half time (${mid})`);
  c.advance(COUNT_GAIN_MS);
  assert.equal(done, 315);
  assert.equal(k.value, 315);
  assert.ok(frames.every((v) => v >= 240 && v <= 315), 'never overshoots');
  assert.equal(k.running, false, 'the loop stops at rest');
});

test('count: a spend counts down in 320 ms', () => {
  const c = fakeClock();
  let doneAt = -1;
  const k = createCountTween({ initial: 240, ...c, reduced: () => false, onDone: () => { doneAt = c.now(); } });
  k.to(165);
  c.advance(COUNT_SPEND_MS + 32);
  assert.ok(doneAt >= COUNT_SPEND_MS && doneAt <= COUNT_SPEND_MS + 32, `landed at ${doneAt}`);
  assert.equal(k.value, 165);
});

test('count: a retarget mid-count continues from the number on screen (no jump back)', () => {
  const c = fakeClock();
  const frames = [];
  const k = createCountTween({ initial: 0, ...c, reduced: () => false, onFrame: (v) => frames.push(v) });
  k.to(100);
  c.advance(200);
  const at = k.value;
  k.to(200);
  c.advance(16);
  assert.ok(k.value >= at, 'never moves backwards on a retarget');
  c.advance(2000);
  assert.equal(k.value, 200);
  for (let i = 1; i < frames.length; i += 1) assert.ok(frames[i] >= frames[i - 1], 'monotonic up');
});

test('count: reduce motion lands instantly', () => {
  const c = fakeClock();
  let done = null;
  const k = createCountTween({ initial: 10, ...c, reduced: () => true, onDone: (v) => { done = v; } });
  k.to(9999);
  assert.equal(done, 9999);
  assert.equal(k.running, false);
  assert.equal(c.pending(), 0);
});

test('count: easeOutQuart is 0 → 1 and clamps', () => {
  assert.equal(easeOutQuart(0), 0);
  assert.equal(easeOutQuart(1), 1);
  assert.equal(easeOutQuart(2), 1);
  assert.equal(easeOutQuart(-1), 0);
});

// ---------------------------------------------------------------- the XP climb
test('climb: every multi-level climb fits in 1 s (barPlan alone overruns at 10+ levels)', () => {
  assert.ok(planBar({ level: 1, frac: 0.2 }, { level: 11, frac: 0.5 }).totalMs > CLIMB_MAX_MS, 'the raw plan is 1.2 s — the reason this wrapper exists');
  for (const n of [1, 2, 5, 6, 9, 10, 11, 25, 30, 31, 50, 500, 50000]) {
    for (const tf of [0, 0.01, 0.5, 0.99]) {
      const p = planClimb({ level: 7, frac: 0.3 }, { level: 7 + n, frac: tf });
      assert.ok(p.totalMs <= CLIMB_MAX_MS, `+${n} levels → ${p.totalMs} ms`);
      const flashes = p.steps.filter((s) => s.kind === 'flash');
      assert.equal(flashes.reduce((a, s) => a + s.levels, 0), n, 'every level is still crossed');
    }
  }
});

test('climb: short climbs keep the barPlan flashes untouched; every fill glides GLIDE_MS', () => {
  const raw = planBar({ level: 3, frac: 0.1 }, { level: 5, frac: 0.4 });
  const k = planClimb({ level: 3, frac: 0.1 }, { level: 5, frac: 0.4 });
  assert.equal(GLIDE_MS, 250);
  assert.equal(k.drop, false);
  assert.equal(k.steps.length, raw.steps.length);
  k.steps.forEach((s, i) => {
    const r = raw.steps[i];
    if (s.kind === 'flash') assert.deepEqual(s, r);
    else assert.deepEqual(s, { ...r, ms: GLIDE_MS });
  });
  assert.equal(k.totalMs, k.steps.reduce((a, s) => a + s.ms, 0));
  // a same-level gain is ONE glide of GLIDE_MS
  const same = planClimb({ level: 3, frac: 0.1 }, { level: 3, frac: 0.12 });
  assert.deepEqual(same.steps, [{ kind: 'fill', level: 3, fromFrac: 0.1, toFrac: 0.12, ms: GLIDE_MS }]);
});

test('climb: the glide is cubic-bezier(.2,.8,.2,1) — 0 → 1, monotonic, no overshoot, ease-out', () => {
  assert.equal(glideEase(0), 0);
  assert.equal(glideEase(1), 1);
  let prev = 0;
  for (let i = 1; i <= 100; i += 1) {
    const v = glideEase(i / 100);
    assert.ok(v >= prev && v <= 1, `ease(${i / 100}) = ${v}`);
    prev = v;
  }
  assert.ok(glideEase(0.25) > 0.6, 'front-loaded (ease-out)');
  // exact points on the curve: at bezier parameter t, x = 3·.2·t(1−t)² + 3·.2·t²(1−t) + t³, y likewise with .8 / 1
  for (const t of [0.25, 0.5, 0.75]) {
    const x = 0.6 * t * (1 - t) ** 2 + 0.6 * t * t * (1 - t) + t ** 3;
    const y = 2.4 * t * (1 - t) ** 2 + 3 * t * t * (1 - t) + t ** 3;
    assert.ok(Math.abs(glideEase(x) - y) < 1e-4, `ease(${x}) = ${glideEase(x)}, want ${y}`);
  }
});

test('climb: a BURST of gains is one continuous glide (retarget mid-tween, never a jump or a restart)', () => {
  const c = fakeClock();
  const frames = [];
  let done = null;
  const p = createClimbPlayer({ level: 4, frac: 0.6, ...c, reduced: () => false, onFrame: (l, f) => frames.push({ l, f }), onDone: (l, f) => { done = { l, f }; } });
  frames.length = 0;
  // 30 keys at ~14/s, each +1.5% — crosses one level wrap mid-burst
  let lv = 4;
  let fr = 0.6;
  for (let i = 0; i < 30; i += 1) {
    fr += 0.015;
    if (fr >= 1) { fr -= 1; lv += 1; }
    p.to(lv, Math.round(fr * 1e6) / 1e6);
    c.advance(70);
  }
  c.advance(600);
  assert.ok(done, 'landed');
  assert.equal(done.l, lv);
  assert.equal(done.f, Math.round(fr * 1e6) / 1e6);
  assert.ok(frames.length > 60, `a frame every rAF (${frames.length})`);
  let wraps = 0;
  for (let i = 1; i < frames.length; i += 1) {
    const a = frames[i - 1];
    const b = frames[i];
    if (b.l === a.l) {
      assert.ok(b.f >= a.f, `frame ${i}: ${a.f} → ${b.f} went backwards (a restart)`);
      // never a JUMP: one 16 ms frame moves the bar a small step, not to the target
      assert.ok(b.f - a.f < 0.06, `frame ${i}: ${a.f} → ${b.f} jumped`);
    } else {
      wraps += 1;
      assert.equal(b.l, a.l + 1, 'a wrap is one level up');
      assert.ok(a.f > 0.9, `wrapped from ${a.f} — the fill glides to full first`);
      assert.ok(b.f < 0.1, `reset to ${b.f} — 0 only at the wrap`);
    }
  }
  assert.equal(wraps, 1, 'exactly the one level wrap');
  // nothing scheduled at rest: the loop sleeps
  assert.equal(p.running, false);
});

test('climb: the player lands exactly on the target within 1 s and reports each level', () => {
  const c = fakeClock();
  const levels = [];
  let done = null;
  const p = createClimbPlayer({ level: 10, frac: 0.5, ...c, reduced: () => false, onLevel: (l) => levels.push(l), onDone: (l, f, ms) => { done = { l, f, ms }; } });
  p.to(60, 0.25); // +50 levels → chunked flashes
  c.advance(CLIMB_MAX_MS + 40);
  assert.ok(done, 'landed');
  assert.equal(done.l, 60);
  assert.equal(done.f, 0.25);
  assert.ok(done.ms <= CLIMB_MAX_MS + 16, `took ${done.ms} ms`);
  assert.equal(levels[levels.length - 1], 60);
  for (let i = 1; i < levels.length; i += 1) assert.ok(levels[i] > levels[i - 1], 'levels only climb');
});

test('climb: a drop and reduce motion both land instantly', () => {
  const c = fakeClock();
  let done = 0;
  const p = createClimbPlayer({ level: 10, frac: 0.5, ...c, reduced: () => false, onDone: () => { done += 1; } });
  p.to(4, 0.1);
  assert.equal(done, 1);
  assert.equal(p.level, 4);
  const r = createClimbPlayer({ level: 1, frac: 0, ...c, reduced: () => true, onDone: () => { done += 1; } });
  r.to(40, 0.5);
  assert.equal(done, 2);
  assert.equal(r.level, 40);
  assert.equal(r.running, false);
});

// ---------------------------------------------------------------- banners
test('banners: stack 3 deep, a 4th closes the oldest, each closes itself after 4 s', () => {
  const c = fakeClock();
  const s = createBannerStore({ setTimer: c.setTimer, clearTimer: c.clearTimer });
  const a = s.push({ name: 'A' });
  s.push({ name: 'B' });
  s.push({ name: 'C' });
  s.push({ name: 'D' });
  const live = () => s.getSnapshot().filter((b) => !b.leaving).map((b) => b.name);
  assert.deepEqual(live(), ['B', 'C', 'D']);
  assert.equal(s.getSnapshot().find((b) => b.id === a).leaving, true);
  c.advance(BANNER_LEAVE_MS);
  assert.equal(s.getSnapshot().some((b) => b.id === a), false, 'the closed one leaves after its exit');
  c.advance(BANNER_MS);
  assert.deepEqual(live(), []);
  c.advance(BANNER_LEAVE_MS);
  assert.equal(s.getSnapshot().length, 0);
});

test('banners: a tap closes one early; closing twice is a no-op', () => {
  const c = fakeClock();
  const s = createBannerStore({ setTimer: c.setTimer, clearTimer: c.clearTimer });
  const id = s.push({ name: 'ZAP' });
  assert.equal(s.close(id), true);
  assert.equal(s.close(id), false);
  c.advance(BANNER_LEAVE_MS);
  assert.equal(s.getSnapshot().length, 0);
});
