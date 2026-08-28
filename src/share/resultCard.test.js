// resultCard.test.js — the shareable result card (Job 1). Pure, node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildResultCard,
  glyphRow,
  tierForClockLeft,
  groupThousands,
  MIN_WORDS,
  MAX_GLYPHS,
  GLYPH,
} from './resultCard.js';

// ---- helpers ---------------------------------------------------------------
const lines = (s) => s.split('\n');

test('groupThousands adds comma separators, floors, clamps at 0', () => {
  assert.equal(groupThousands(1860), '1,860');
  assert.equal(groupThousands(999), '999');
  assert.equal(groupThousands(1234567), '1,234,567');
  assert.equal(groupThousands(-5), '0');
  assert.equal(groupThousands(12.9), '12');
});

test('tierForClockLeft maps the CHAIN/FUSE thresholds (>=65 / 45-65 / <45)', () => {
  assert.equal(tierForClockLeft(0.9), 'fast');
  assert.equal(tierForClockLeft(0.65), 'fast');
  assert.equal(tierForClockLeft(0.64), 'mid');
  assert.equal(tierForClockLeft(0.45), 'mid');
  assert.equal(tierForClockLeft(0.44), 'slow');
  assert.equal(tierForClockLeft(0), 'slow');
});

// ---- per-mode FORMAT assertions -------------------------------------------

test('FUSE: exact 4-line shape, no redundant pts (score == words), killer glyph', () => {
  const txt = buildResultCard({
    mode: 'fuse',
    words: 5,
    // FUSE omits points (score == word count) — adapter passes points: null.
    level: 12,
    tiers: ['fast', 'fast', 'mid', 'slow', 'fast'],
    killed: true,
    link: 'https://typeaword.com/?fuse=1&ref=share',
  });
  const l = lines(txt);
  assert.equal(l[0], 'TYPE A WORD - FUSE');
  assert.equal(l[1], '5 words - LV 12');
  assert.equal(l[2], '🟩🟩🟨🟥🟩⬛');
  assert.equal(l[3], 'https://typeaword.com/?fuse=1&ref=share');
  assert.equal(l.length, 4);
});

test('CHAIN: pts included (distinct score), thresholds + killer', () => {
  const txt = buildResultCard({
    mode: 'chain',
    words: 4,
    points: 1860,
    level: 8,
    tiers: ['fast', 'mid', 'slow', 'fast'],
    killed: true,
    link: 'https://typeaword.com/?chain=1&ref=share',
  });
  const l = lines(txt);
  assert.equal(l[0], 'TYPE A WORD - CHAIN');
  assert.equal(l[1], '4 words - 1,860 pts - LV 8');
  assert.equal(l[2], '🟩🟨🟥🟩⬛');
  assert.equal(l[3], 'https://typeaword.com/?chain=1&ref=share');
});

test('SAT RUSH: pts included, ante-derived tiers, no killer glyph', () => {
  const txt = buildResultCard({
    mode: 'sat-rush',
    words: 6,
    points: 4200,
    level: 20,
    tiers: ['fast', 'fast', 'mid', 'fast', 'slow', 'mid'],
    killed: false,
    link: 'https://typeaword.com/?satrush=1&ref=share',
  });
  const l = lines(txt);
  assert.equal(l[0], 'TYPE A WORD - SAT RUSH');
  assert.equal(l[1], '6 words - 4,200 pts - LV 20');
  assert.equal(l[2], '🟩🟩🟨🟩🟥🟨');
  assert.equal(l[3], 'https://typeaword.com/?satrush=1&ref=share');
});

test('WORD BOMB: accepted words are all 🟩, elimination appends ⬛, no pts', () => {
  const txt = buildResultCard({
    mode: 'word-bomb',
    words: 7,
    level: 15,
    tiers: Array(7).fill('fast'),
    killed: true, // eliminated
    link: 'https://typeaword.com/?ref=share',
  });
  const l = lines(txt);
  assert.equal(l[0], 'TYPE A WORD - WORD BOMB');
  assert.equal(l[1], '7 words - LV 15');
  assert.equal(l[2], '🟩🟩🟩🟩🟩🟩🟩⬛');
  assert.equal(l[3], 'https://typeaword.com/?ref=share');
});

test('CATEGORY BLITZ: pts included (score), all 🟩, no killer', () => {
  const txt = buildResultCard({
    mode: 'category-blitz',
    words: 9,
    points: 24,
    level: 11,
    tiers: Array(9).fill('fast'),
    killed: false,
    link: 'https://typeaword.com/?daily=1&ref=share',
  });
  const l = lines(txt);
  assert.equal(l[0], 'TYPE A WORD - CATEGORY BLITZ');
  assert.equal(l[1], '9 words - 24 pts - LV 11');
  assert.equal(l[2], '🟩🟩🟩🟩🟩🟩🟩🟩🟩');
  assert.equal(l[3], 'https://typeaword.com/?daily=1&ref=share');
});

// ---- SUPPRESSION rule ------------------------------------------------------

test('suppression: fewer than MIN_WORDS accepted -> null (a 0/1/2-word share is an anti-ad)', () => {
  for (let w = 0; w < MIN_WORDS; w++) {
    assert.equal(
      buildResultCard({ mode: 'fuse', words: w, level: 3, tiers: [], link: 'x' }),
      null,
      `expected null for ${w} words`
    );
  }
  // Exactly MIN_WORDS is allowed.
  assert.ok(buildResultCard({ mode: 'fuse', words: MIN_WORDS, level: 3, tiers: ['fast', 'fast', 'fast'], link: 'x' }));
});

// ---- glyph cap / downsample -----------------------------------------------

test('glyphRow caps at MAX_GLYPHS, keeping every ceil(n/30)th above that', () => {
  const short = glyphRow(Array(10).fill('fast'));
  assert.equal([...short].length, 10); // emoji are single code points here

  const n = 90;
  const row = glyphRow(Array(n).fill('mid'));
  // k = ceil(90/30) = 3 -> keep indices 0,3,6,... = 30 glyphs.
  assert.equal([...row].length, 30);

  const n2 = 61; // k = ceil(61/30) = 3 -> ceil(61/3) = 21 kept
  const row2 = glyphRow(Array(n2).fill('fast'));
  assert.ok([...row2].length <= MAX_GLYPHS);
  assert.equal([...row2].length, Math.ceil(n2 / Math.ceil(n2 / MAX_GLYPHS)));
});

test('glyphRow appends the killer ⬛ and counts it toward the cap', () => {
  const row = glyphRow(['fast', 'mid'], { killed: true });
  assert.equal(row, `${GLYPH.fast}${GLYPH.mid}${GLYPH.dead}`);
});
