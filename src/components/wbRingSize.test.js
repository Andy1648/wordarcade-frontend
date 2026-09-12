// wbRingSize.test.js — the ring's diameter is a pure function of the board box.
//
// The first ring shipped its size as a media-query guess against the VIEWPORT while the
// circle actually lives inside a padded stage that also owes height to a header, a hero
// prompt and an input row. These cases pin the three constraints that guess could not see:
// the design size, the height the rows leave, and the width the rails leave — plus the
// board ceiling that overrules the 220px floor on a phone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ringDiameter, WB_RING_MIN, WB_RING_MAX, WB_RING_OF_STAGE } from './wbRingSize.js';

// A laptop board: 1227x745, bounded by the HEIGHT its rows leave, not by the 0.72 design size.
const LAPTOP = {
  stageW: 1227, stageH: 745,
  contentW: 1118, contentH: 712,
  topH: 110, botH: 77, railW: 218, rowGap: 8, colGap: 19,
};

test('a laptop board is bounded by the height the rows leave, not by 0.72 of the stage', () => {
  const d = ringDiameter(LAPTOP);
  // reserved = max(110,77) + 8 = 118, taken from BOTH sides of the ring row.
  assert.equal(d, 712 - 2 * 118);
  assert.ok(d < LAPTOP.stageH * WB_RING_OF_STAGE, 'the design size is the looser bound here');
});

test('a tall board is bounded by 0.72 of its shorter side', () => {
  // Narrow enough that 0.72 of the short side is under the 520px cap, tall enough that the
  // rows have height to spare — so the design size is the only binding constraint.
  const d = ringDiameter({
    stageW: 700, stageH: 1400, contentW: 690, contentH: 1360,
    topH: 110, botH: 77, railW: 40, rowGap: 8, colGap: 19,
  });
  assert.equal(d, Math.floor(700 * WB_RING_OF_STAGE));
});

test('a narrow board is bounded by the width the rails leave', () => {
  const d = ringDiameter({ ...LAPTOP, stageW: 900, contentW: 800, stageH: 1400, contentH: 1360 });
  // 800 - 2 * (218 + 19) = 326, below both the design size and the free height.
  assert.equal(d, 800 - 2 * (218 + 19));
});

test('the ring never exceeds its 520px cap on a big monitor', () => {
  const d = ringDiameter({
    stageW: 1600, stageH: 1400, contentW: 1500, contentH: 1340,
    topH: 110, botH: 77, railW: 218, rowGap: 8, colGap: 19,
  });
  assert.equal(d, WB_RING_MAX);
});

// UPDATED (rail-fit pass). This used to assert `=== WB_RING_MIN`: that the 220px floor
// RAISED the ring back up when the rows left slightly less than 220. That is the behaviour
// that put a ring 16px taller than its own budget on the board, and on a 320x640 phone the
// 6-o'clock seat's floated name came down on top of the used-word strip. The floor is a
// preference for small boards; the height the rows leave is a constraint. It now loses.
test('the 220px floor does NOT invent height the rows did not leave', () => {
  // freeHeight = 580 - 2*(180+8) = 204 — 16px under the floor.
  const tight = { ...LAPTOP, contentH: 580, topH: 180, botH: 77 };
  const freeHeight = 580 - 2 * (180 + 8);
  assert.equal(ringDiameter(tight), freeHeight);
  assert.ok(freeHeight < WB_RING_MIN, 'and this case is genuinely below the floor');
});

test('the floor still raises a ring that the rows CAN afford', () => {
  // Same board with 224px of free height: over the floor, so nothing is clamped and the
  // floor is simply not the binding constraint. The floor is not being deleted.
  const ok = { ...LAPTOP, contentH: 600, topH: 180, botH: 77 };
  assert.equal(ringDiameter(ok), 600 - 2 * (180 + 8));
});

test('a 320px phone board: the board ceiling overrules the 220px floor', () => {
  // The real measured box at 320x640: the app frame (a 15px scrollbar gutter each edge)
  // plus the wrap padding leaves a 274px-wide board. 0.72 of that is 197 — under the floor,
  // and the floor would put the ring at 80% of the board.
  const d = ringDiameter({
    stageW: 274, stageH: 624, contentW: 238, contentH: 596,
    topH: 133, botH: 110, railW: 0, rowGap: 6, colGap: 0,
  });
  assert.ok(d < WB_RING_MIN, 'the board wins over the design floor');
  assert.ok(d / 274 <= 0.75, `ring is ${d} of a 274px board (${((d / 274) * 100).toFixed(1)}%)`);
  assert.ok(d / 274 >= 0.45);
});

test('a 390px phone board stays inside the 45-75% band without the ceiling biting', () => {
  const d = ringDiameter({
    stageW: 344, stageH: 828, contentW: 308, contentH: 782,
    topH: 137, botH: 110, railW: 0, rowGap: 8, colGap: 0,
  });
  assert.equal(d, Math.floor(344 * WB_RING_OF_STAGE));
  assert.ok(d / 344 >= 0.45 && d / 344 <= 0.75);
});

test('the ring row is reserved on BOTH sides, which is what centres it', () => {
  // Swapping which stack is the taller one must not change the answer: the reservation is
  // max(top, bot) either way, mirrored above and below the ring.
  const a = ringDiameter({ ...LAPTOP, topH: 150, botH: 60, contentH: 900, stageH: 940 });
  const b = ringDiameter({ ...LAPTOP, topH: 60, botH: 150, contentH: 900, stageH: 940 });
  assert.equal(a, b);
});

// THE HEADER ROW is taken off the top of the board ONCE. Every other band above the ring
// (the prompt) is reserved on both sides of the ring row to keep the ring centred; the
// header is not, because the ring is centred in the PLAY AREA below it. This is the whole
// reason the header is a grid row of its own rather than part of the top stack - inside
// the top stack its 32px would have cost the ring 64.
test('the header row costs the ring its own height plus one gap, not double', () => {
  const without = ringDiameter({ ...LAPTOP, headH: 0 });
  const with32 = ringDiameter({ ...LAPTOP, headH: 32 });
  assert.equal(without - with32, 32 + LAPTOP.rowGap);
});

test('a headH of 0 is exactly the old behaviour (the default is not a silent cost)', () => {
  assert.equal(ringDiameter(LAPTOP), ringDiameter({ ...LAPTOP, headH: 0 }));
});

// THE 220px FLOOR MAY NOT OVERRULE THE ROWS. On a 320x640 board the floor pushed the
// ring back up to the board ceiling even though the rows had left it 27px less, and the
// 6-o'clock seat's floated name came down on the used-word strip. The floor raises a
// SMALL ring; it may not create height that isn't there.
test('the design floor never returns a ring taller than the rows left', () => {
  const tight = {
    stageW: 274, stageH: 624, contentW: 250, contentH: 562,
    headH: 44, topH: 89, botH: 150, railW: 0, rowGap: 20, colGap: 0,
  };
  const d = ringDiameter(tight);
  const freeHeight = (562 - 44 - 20) - 2 * (150 + 20);
  assert.ok(d <= freeHeight, `ring ${d} must fit the ${freeHeight}px the rows left`);
  assert.ok(d < WB_RING_MIN, 'and this board genuinely cannot give it the 220px floor');
});
