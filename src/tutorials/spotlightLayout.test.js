import test from 'node:test';
import assert from 'node:assert/strict';
import { spotlightLayout, findVisibleTarget, SPOT_PAD, SPOT_GAP, SPOT_EDGE } from './spotlightLayout.js';

const R = (left, top, width, height) => ({ left, top, width, height });

test('no target (or a zero-size one) → no hole, the line centred over a full dim', () => {
  for (const r of [null, undefined, R(10, 10, 0, 20), R(10, 10, 20, 0)]) {
    assert.deepEqual(spotlightLayout(r, 400, 800, 60), { hole: null, caption: { top: null, side: 'center' } });
  }
  assert.equal(spotlightLayout(R(1, 1, 5, 5), 0, 0, 10).hole, null, 'no viewport');
});

test('the hole is the target plus the pad on every side', () => {
  const { hole } = spotlightLayout(R(100, 200, 80, 40), 1280, 720, 50);
  assert.deepEqual(hole, { left: 100 - SPOT_PAD, top: 200 - SPOT_PAD, width: 80 + 2 * SPOT_PAD, height: 40 + 2 * SPOT_PAD });
});

test('the hole is clamped to the viewport (a corner button never cuts past the edge)', () => {
  const { hole } = spotlightLayout(R(2, 3, 50, 40), 390, 844, 50);
  assert.equal(hole.left, 0);
  assert.equal(hole.top, 0);
  assert.equal(hole.width, 2 + 50 + SPOT_PAD);
  assert.equal(hole.height, 3 + 40 + SPOT_PAD);
  const right = spotlightLayout(R(360, 10, 40, 40), 390, 844, 50).hole;
  assert.equal(right.left + right.width, 390);
});

test('a target scrolled fully off screen → treated as no target', () => {
  assert.equal(spotlightLayout(R(10, -200, 50, 40), 390, 844, 50).hole, null);
  assert.equal(spotlightLayout(R(500, 10, 50, 40), 390, 844, 50).hole, null);
});

test('the line sits BELOW the hole when it fits', () => {
  const { hole, caption } = spotlightLayout(R(100, 40, 80, 40), 1280, 720, 60);
  assert.equal(caption.side, 'below');
  assert.equal(caption.top, hole.top + hole.height + SPOT_GAP);
});

test('…ABOVE it when below would run off the bottom', () => {
  const { hole, caption } = spotlightLayout(R(100, 640, 80, 40), 1280, 720, 60);
  assert.equal(caption.side, 'above');
  assert.equal(caption.top, hole.top - SPOT_GAP - 60);
  assert.ok(caption.top >= SPOT_EDGE);
});

test('…and rides the bottom edge when neither side fits (a huge target)', () => {
  const { caption } = spotlightLayout(R(0, 20, 390, 780), 390, 844, 80);
  assert.equal(caption.side, 'bottom');
  assert.equal(caption.top, 844 - SPOT_EDGE - 80);
});

test('the boundary: exactly fitting below still goes below', () => {
  const vh = 720;
  const capH = 60;
  // bottom of hole + gap + capH === vh - edge
  const bottom = vh - SPOT_EDGE - capH - SPOT_GAP;
  const r = R(10, bottom - SPOT_PAD - 30, 50, 30);
  assert.equal(spotlightLayout(r, 1280, vh, capH).caption.side, 'below');
});

test('findVisibleTarget is safe without a DOM', () => {
  assert.equal(findVisibleTarget('.anything'), null);
  assert.equal(findVisibleTarget(''), null);
});
