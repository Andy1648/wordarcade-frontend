import test from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT, plateSpans, CARD_H, FACE, PLATE_H, pipPlateW, pipGap, PIP_W, PIP_GAP } from './frameLayout.js';

test('gear tile v2: every plate sits inside the card, in order, never overlapping the one above', () => {
  let prevBottom = 0;
  for (const [plate, top, bottom] of plateSpans(LAYOUT)) {
    assert.ok(top >= 0 && bottom <= CARD_H, `${plate} inside the card`);
    assert.ok(top >= prevBottom - 1, `${plate} (${top}) starts under the plate above (${prevBottom})`);
    prevBottom = bottom;
  }
  // the art, name and hero stat live on the face; the pip row sits on the frame's bottom band under it
  assert.ok(LAYOUT.artC - LAYOUT.artR >= FACE.top, 'the art starts on the face');
  assert.ok(LAYOUT.hero + PLATE_H.hero <= FACE.bottom, 'the hero stat fits the face');
  assert.ok(LAYOUT.pips >= FACE.bottom, 'the pip plate is on the bottom band');
});

test('the pip plate grows with its pips and never leaves the bottom band', () => {
  assert.equal(pipPlateW(0), 0);
  assert.ok(pipPlateW(1) < pipPlateW(3));
  // the most a card carries: 2 extra-stat dots + ✦✦✦ (SECRET has three perks — GEAR POOL v2 added FREE OVERDRIVE) +
  // ★★★★★ — and the plate is never capped short of its pips (10 pips close the gaps up)
  for (let n = 1; n <= 9; n += 1) assert.ok(pipPlateW(n) <= 164 && pipPlateW(n) === n * PIP_W + (n - 1) * PIP_GAP + 12, `${n} pips fit`);
  assert.equal(pipGap(10), 0);
  assert.equal(pipPlateW(10), 10 * PIP_W + 12);
  assert.ok(pipPlateW(10) <= 164);
});
