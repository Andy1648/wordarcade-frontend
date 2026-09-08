// runResult.test.js (feat/run-share) — THE RUN's share receipt builder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRunResultText, runGlyphRow, runGlyph, clearedRounds, RUN_GLYPH, HAND_MAX } from './runResult.js';

const R = (round, score, wall, passed = true, fumbled = false) => ({ round, score, wall, passed, fumbled });
const LINK = 'https://typeaword.com/run?ref=share';

test('glyphs: 🟩 cleared, 🟨 cleared by < 15%, ⬛ the round that ended it', () => {
  assert.equal(runGlyph(R(1, 200, 80)), RUN_GLYPH.clear);
  assert.equal(runGlyph(R(1, 91, 80)), RUN_GLYPH.squeak); // 80 × 1.15 = 92 → 91 is a squeak
  assert.equal(runGlyph(R(1, 92, 80)), RUN_GLYPH.clear); // exactly 15% over is NOT a squeak
  assert.equal(runGlyph(R(1, 50, 80, false)), RUN_GLYPH.dead);
  assert.equal(runGlyph(R(1, 500, 80, false, true)), RUN_GLYPH.dead); // fumbled: ended it too
  assert.equal(runGlyphRow([R(1, 200, 80), R(2, 130, 120), R(3, 300, 180), R(4, 100, 270, false)]), '🟩🟨🟩⬛');
  assert.equal(runGlyphRow([]), '');
});

test('the exact receipt shape', () => {
  const text = buildRunResultText({
    history: [R(1, 200, 80), R(2, 260, 120), R(3, 400, 180), R(4, 210, 270, false)],
    totalRounds: 10,
    banked: 3210,
    hand: ['HOT STREAK', 'DEEP POCKETS', 'SNOWBALL'],
    link: LINK,
  });
  assert.equal(text, [
    'TYPE A WORD — THE RUN',
    'ROUND 4/10 · 3,210 BANKED',
    '🟩🟩🟩⬛',
    'HAND: HOT STREAK · DEEP POCKETS · SNOWBALL',
    LINK,
  ].join('\n'));
});

test('a fully cleared run has no ⬛ and reads ROUND 10/10', () => {
  const history = Array.from({ length: 10 }, (_, i) => R(i + 1, 5000, 1000));
  const text = buildRunResultText({ history, totalRounds: 10, banked: 50000, hand: [], link: LINK });
  const lines = text.split('\n');
  assert.equal(lines[1], 'ROUND 10/10 · 50,000 BANKED');
  assert.equal(lines[2], '🟩'.repeat(10));
  assert.ok(!text.includes('⬛'));
  assert.ok(!text.includes('HAND:'), 'no HAND line when nothing was drafted');
  assert.equal(lines[3], LINK);
});

test('the HAND line caps at four names, upper-cased, in draft order', () => {
  const text = buildRunResultText({
    history: [R(1, 200, 80), R(2, 100, 120, false)],
    banked: 200,
    hand: ['a', 'b', 'c', 'd', 'e'],
    link: LINK,
  });
  assert.equal(HAND_MAX, 4);
  assert.ok(text.includes('HAND: A · B · C · D\n'));
  assert.ok(!text.includes(' · E'));
});

test('SUPPRESSED on a 0-round run (died on round 1, nothing cleared) — and on no history at all', () => {
  assert.equal(clearedRounds([R(1, 30, 80, false)]), 0);
  assert.equal(buildRunResultText({ history: [R(1, 30, 80, false)], banked: 30, link: LINK }), null);
  assert.equal(buildRunResultText({ history: [], banked: 0, link: LINK }), null);
  assert.equal(buildRunResultText(), null);
});

test('a one-clear run (the stranger path: clear round 1, die on round 2) is shareable', () => {
  const text = buildRunResultText({ history: [R(1, 150, 80), R(2, 0, 120, false)], totalRounds: 10, banked: 150, hand: ['LUCKY CHARM'], link: LINK });
  assert.equal(text.split('\n')[1], 'ROUND 2/10 · 150 BANKED');
  assert.equal(text.split('\n')[2], '🟩⬛');
});
