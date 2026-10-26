// navWipe.test.js — the pooled nav wipe: one node replayed, finite, transform/opacity only, will-change only
// while playing, coalesced, and skipped under REDUCE MOTION. Look/timing = the original pre-#514 wipe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWipe, playWipe, _resetWipeClock, WIPE_MS, COALESCE_MS, COVER_AT } from './navWipe.js';
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
const parts = () => ({ root: fakeEl(), panel: fakeEl(), word: fakeEl() });

test('replays the SAME registered nodes; finite; transform/opacity only; will-change cleared on finish', () => {
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  assert.equal(playWipe('SHOP', 'forward'), true);
  assert.equal(p.root.dataset.state, 'play');
  assert.equal(p.word.textContent, 'SHOP');
  assert.equal(p.panel.style.willChange, 'transform');
  assert.equal(WIPE_MS, 240, 'the original 240ms wipe');
  for (const a of [...p.panel.anims, ...p.word.anims]) {
    assert.equal(a.timing.duration, WIPE_MS);
    assert.ok(!a.timing.iterations || Number.isFinite(a.timing.iterations), 'never infinite');
    for (const f of a.frames) for (const k of Object.keys(f)) assert.ok(['transform', 'opacity', 'offset', 'easing'].includes(k), `animates ${k}`);
  }
  p.panel.anims[0].onfinish();
  assert.equal(p.root.dataset.state, 'idle');
  assert.equal(p.panel.style.willChange, '');
  assert.equal(p.word.style.willChange, '');
  off();
});

test('the panel sweeps in, sits EXACTLY on the viewport at the cover peak, and sweeps out (original keyframes)', () => {
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  playWipe('', 'forward');
  assert.deepEqual(p.panel.anims[0].frames.map((f) => f.transform), ['translateX(-100%)', 'translateX(0)', 'translateX(100%)']);
  assert.equal(p.panel.anims[0].frames[1].offset, COVER_AT);
  _resetWipeClock();
  playWipe('', 'back');
  assert.equal(p.root.dataset.dir, 'back');
  assert.deepEqual(p.panel.anims[1].frames.map((f) => f.transform), ['translateX(100%)', 'translateX(0)', 'translateX(-100%)']);
  off();
});

test('a burst of navigations inside the coalesce window gets ONE wipe', () => {
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  assert.equal(playWipe('READY?'), true);
  assert.equal(playWipe('SQUAD UP'), false);
  assert.ok(COALESCE_MS >= 500);
  assert.equal(p.panel.anims.length, 1);
  off();
});

test('REDUCE MOTION skips the wipe entirely', () => {
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  setReduceMotion(true);
  try {
    assert.equal(playWipe('STATS'), false);
    assert.equal(p.panel.anims.length, 0);
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
