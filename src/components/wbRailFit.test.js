// wbRailFit.test.js — the shared rail height, and the row budget that comes out of it.
//
// The shipped bug these pin: a rail height that was a fraction of the ring's diameter and
// knew nothing about either card's content, so USED WORDS drew a chip sliced in half and
// the MATCH readout lost its MODE row - while the area-skew gate read a perfect 0%.
import test from 'node:test';
import assert from 'node:assert/strict';
import { railFit } from './wbRailFit.js';

// chrome 46 = 8+8 padding + 3+3 border + 17 label + 7 label margin. step 23 = 19 + 4 gap.
const USED = { key: 'used', chrome: 46, step: 23 };
const FEED = { key: 'feed', chrome: 52, step: 41 };
const MATCH_H = 124;

test('the height is the TALLER of the two cards, not a fraction of the ring', () => {
  const r = railFit({
    lists: [{ ...USED, count: 5 }],
    fixed: [MATCH_H],
    cap: 365,
  });
  // used wants 46 + 5*23 = 161; MATCH needs 124. The taller wins.
  assert.equal(r.height, 161);
  assert.equal(r.visible.used, 5, 'every chip is shown - nothing to trim');
  assert.equal(r.capped, false);
});

test('the shorter card is PADDED to the taller one, never the other way round', () => {
  const r = railFit({ lists: [{ ...USED, count: 1 }], fixed: [MATCH_H], cap: 365 });
  assert.equal(r.height, MATCH_H, 'one chip does not shrink the board below the MATCH card');
  assert.equal(r.visible.used, 1);
});

test('over the cap, whole ROWS are dropped - a chip is never sliced', () => {
  const r = railFit({ lists: [{ ...USED, count: 40 }], fixed: [MATCH_H], cap: 200 });
  assert.equal(r.height, 200);
  assert.equal(r.capped, true);
  // (200 - 46) / 23 = 6.69 -> 6 whole chips, and 46 + 6*23 = 184 <= 200.
  assert.equal(r.visible.used, 6);
  assert.ok(USED.chrome + r.visible.used * USED.step <= r.height, 'content fits inside the card');
});

test('two lists share one height and each gets its own row budget', () => {
  const r = railFit({
    lists: [{ ...USED, count: 40 }, { ...FEED, count: 8 }],
    cap: 300,
  });
  assert.equal(r.height, 300);
  assert.equal(r.visible.used, Math.floor((300 - 46) / 23));
  assert.equal(r.visible.feed, Math.floor((300 - 52) / 41));
  for (const l of [USED, FEED]) {
    const n = r.visible[l.key];
    assert.ok(l.chrome + n * l.step <= r.height, l.key + ' fits inside the shared height');
  }
});

test('a card that may never lose a row sets the FLOOR, even above the cap', () => {
  // A pathologically short cap must not be allowed to cut MODE off the MATCH card -
  // that is the exact defect this file exists for, and "clip it a bit less" is not a fix.
  const r = railFit({ lists: [{ ...USED, count: 2 }], fixed: [MATCH_H], cap: 80 });
  assert.equal(r.height, MATCH_H);
});

test('an empty list asks for nothing and is given nothing', () => {
  const r = railFit({ lists: [{ ...USED, count: 0 }], fixed: [MATCH_H], cap: 365 });
  assert.equal(r.height, MATCH_H);
  assert.equal(r.visible.used, 0);
});

test('a zero cap falls back to the natural height rather than collapsing the rails', () => {
  // --wb-size is written by a layout effect; before it lands the cap reads 0. A rail that
  // collapsed to nothing for one frame would flash an empty board.
  const r = railFit({ lists: [{ ...USED, count: 4 }], fixed: [], cap: 0 });
  assert.equal(r.height, 46 + 4 * 23);
});
