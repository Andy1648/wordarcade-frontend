// navWipe.test.js — the pooled nav wipe: one node replayed, finite, transform/opacity only, will-change only
// while playing, coalesced, and skipped under REDUCE MOTION.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWipe, playWipe, _resetWipeClock, WIPE_MS, COALESCE_MS } from './navWipe.js';
import { setReduceMotion } from './reduceMotion.js';

function fakeEl() {
  const el = { style: {}, dataset: {}, textContent: '', anims: [] };
  el.animate = (frames, timing) => {
    const a = { frames, timing, cancelled: false, cancel() { this.cancelled = true; }, onfinish: null };
    el.anims.push(a);
    return a;
  };
  return el;
}
function parts() {
  const mascot = fakeEl();
  mascot.dataset.src = '/mascot-run.webp';
  return { root: fakeEl(), track: fakeEl(), band: fakeEl(), mascot, word: fakeEl() };
}

test('replays the SAME registered nodes; finite; transform/opacity only; will-change cleared on finish', () => {
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  assert.equal(playWipe('SHOP', 'forward'), true);
  assert.equal(p.root.dataset.state, 'play');
  assert.equal(p.word.textContent, 'SHOP');
  assert.equal(p.band.style.willChange, 'transform');
  for (const a of [...p.band.anims, ...p.word.anims]) {
    assert.ok(a.timing.duration >= 250 && a.timing.duration <= 400, 'snappy 250–400ms');
    assert.equal(a.timing.duration, WIPE_MS);
    assert.ok(!a.timing.iterations || Number.isFinite(a.timing.iterations), 'never infinite');
    for (const f of a.frames) for (const k of Object.keys(f)) assert.ok(['transform', 'opacity', 'offset', 'easing'].includes(k), `animates ${k}`);
  }
  p.band.anims[0].onfinish();
  assert.equal(p.root.dataset.state, 'idle');
  assert.equal(p.band.style.willChange, '');
  assert.equal(p.word.style.willChange, '');
  off();
});

test('back flips the track, never the word', () => {
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  playWipe('', 'back');
  assert.equal(p.track.style.transform, 'scaleX(-1)');
  assert.equal(p.root.dataset.dir, 'back');
  off();
});

test('a burst of navigations inside the coalesce window gets ONE wipe', () => {
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  assert.equal(playWipe('READY?'), true);
  assert.equal(playWipe('SQUAD UP'), false);
  assert.ok(COALESCE_MS >= 500);
  assert.equal(p.band.anims.length, 1);
  off();
});

test('REDUCE MOTION skips the wipe entirely', () => {
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  setReduceMotion(true);
  try {
    assert.equal(playWipe('STATS'), false);
    assert.equal(p.band.anims.length, 0);
    assert.notEqual(p.root.dataset.state, 'play');
  } finally {
    setReduceMotion(false);
    off();
  }
});

test('no overlay registered: a no-op, never a throw', () => {
  _resetWipeClock();
  assert.equal(playWipe('X'), false);
});
