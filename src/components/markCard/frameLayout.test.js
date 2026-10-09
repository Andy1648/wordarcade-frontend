import test from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT, plateSpans, CARD_H, FACE, layoutFor } from './frameLayout.js';

test('R4 card frame: every plate sits inside the card, in order, never overlapping the one above', () => {
  for (const [name, L] of Object.entries(LAYOUT)) {
    const spans = plateSpans(L);
    let prevBottom = 0;
    for (const [plate, top, bottom] of spans) {
      assert.ok(top >= 0 && bottom <= CARD_H, `${name}.${plate} inside the card`);
      assert.ok(top >= prevBottom - 1, `${name}.${plate} (${top}) starts under the plate above (${prevBottom})`);
      prevBottom = bottom;
    }
    // the art, name, stat (and perk) live on the face; the foot sits on the frame's bottom band under it
    assert.ok(L.artC - L.artR >= FACE.top && L.stat + 32 <= FACE.bottom, `${name}: the art..stat stack fits the face`);
    if (L.perk != null) assert.ok(L.perk + 18 <= FACE.bottom, `${name}: the perk band fits the face`);
    if (L.crit != null) assert.ok(L.crit + 18 <= FACE.bottom && L.crit >= L.stat + 32, `${name}: the crit band fits the face, under the stat`);
    assert.ok(L.foot >= FACE.bottom, `${name}: the odds plate is on the bottom band`);
  }
  assert.ok(LAYOUT.perk.artR < LAYOUT.plain.artR, 'a perk card draws its art a little smaller to make room');
  assert.ok(LAYOUT.both.artR < LAYOUT.crit.artR, 'a crit + perk card draws its art smaller again');
  assert.equal(layoutFor({}), LAYOUT.plain);
  assert.equal(layoutFor({ perk: true }), LAYOUT.perk);
  assert.equal(layoutFor({ crit: true }), LAYOUT.crit);
  assert.equal(layoutFor({ perk: true, crit: true }), LAYOUT.both);
});
