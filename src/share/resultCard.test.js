// resultCard.test.js — the shareable result card (Job 1). Pure, node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {buildResultCard,
  glyphRow,
  tierForClockLeft,
  groupThousands,
  MIN_WORDS,
  MAX_GLYPHS,
  GLYPH, buildResultCardPlain, describeGlyphRow} from './resultCard.js';

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

test('FUSE: the spec shape — em dash, UPPERCASE unit, no LV, LETTERS on the glyph row', () => {
  const txt = buildResultCard({
    mode: 'fuse',
    words: 5,
    // FUSE omits points (its score IS the word count) — the adapter passes points: null.
    level: 12, // supplied, and deliberately NOT rendered: the solo receipt is about the run.
    tiers: ['fast', 'fast', 'mid', 'slow', 'fast'],
    killed: true,
    suffix: 'LETTERS 22/26',
    link: 'https://typeaword.com/fuse?ref=share',
  });
  const l = lines(txt);
  assert.equal(l[0], 'TYPE A WORD — FUSE');
  assert.equal(l[1], '5 WORDS');
  assert.equal(l[2], '🟩🟩🟨🟥🟩⬛ · LETTERS 22/26');
  assert.equal(l[3], 'https://typeaword.com/fuse?ref=share');
  assert.equal(l.length, 4);
});

test('CHAIN: the spec shape — LINKS · PTS, thresholds + killer', () => {
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
  assert.equal(l[0], 'TYPE A WORD — CHAIN');
  assert.equal(l[1], '4 LINKS · 1,860 PTS'); // CHAIN counts LINKS, not words
  assert.equal(l[2], '🟩🟨🟥🟩⬛');
  assert.equal(l[3], 'https://typeaword.com/?chain=1&ref=share');
  assert.equal(l.length, 4);
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

// ---- CHAIN/FUSE glyph thresholds, end to end (feat/solo-endgame) -----------

test('a clock fraction maps to the right GLYPH, at and around every boundary', () => {
  const glyphFor = (frac) => glyphRow([tierForClockLeft(frac)]);
  // >= 65% left is 🟩, 45-65% is 🟨, < 45% is 🟥 — the boundaries belong to the FASTER tier.
  assert.equal(glyphFor(1.0), GLYPH.fast);
  assert.equal(glyphFor(0.65), GLYPH.fast, '65% exactly is fast, not mid');
  assert.equal(glyphFor(0.6499), GLYPH.mid);
  assert.equal(glyphFor(0.5), GLYPH.mid);
  assert.equal(glyphFor(0.45), GLYPH.mid, '45% exactly is mid, not slow');
  assert.equal(glyphFor(0.4499), GLYPH.slow);
  assert.equal(glyphFor(0), GLYPH.slow);
  // Garbage in (a missing/NaN measurement) must not throw or produce an empty glyph.
  assert.equal(glyphFor(NaN), GLYPH.slow);
  assert.equal(glyphFor(undefined), GLYPH.slow);
  // A whole run's worth, in order, with the killer square last.
  assert.equal(
    glyphRow([0.9, 0.5, 0.2].map(tierForClockLeft), { killed: true }),
    `${GLYPH.fast}${GLYPH.mid}${GLYPH.slow}${GLYPH.dead}`
  );
});

test('suppression holds for CHAIN too, and is counted in ACCEPTED words not glyphs', () => {
  // A 2-link run is suppressed even though the killer glyph would make the row look like 3.
  assert.equal(
    buildResultCard({ mode: 'chain', words: 2, points: 300, tiers: ['fast', 'fast'], killed: true, link: 'x' }),
    null
  );
  const ok = buildResultCard({ mode: 'chain', words: 3, points: 300, tiers: ['fast', 'fast', 'mid'], killed: true, link: 'x' });
  assert.ok(ok, 'exactly 3 links is shareable');
  assert.equal(lines(ok)[1], '3 LINKS · 300 PTS');
});

// --- PLAIN-TEXT ALTERNATIVE (feat/shell-screens) ---------------------------
// An emoji grid is a known screen-reader failure, so every share must also exist as
// words. These pin that the two forms stay interchangeable.
test('the plain-text receipt carries no emoji but the same facts', () => {
  const args = {
    mode: 'word-bomb', words: 12, points: 1860, level: 12,
    tiers: ['fast', 'fast', 'mid', 'slow', 'fast'], killed: true,
    link: 'https://typeaword.com/word-bomb',
  };
  const grid = buildResultCard(args);
  const plain = buildResultCardPlain(args);
  assert.ok(grid.includes('🟩'), 'the grid form should still use glyphs');
  for (const g of ['🟩', '🟨', '🟥', '⬛']) {
    assert.ok(!plain.includes(g), `the plain form must not contain ${g}`);
  }
  // Same brand line, same stat line, same deep link - only the middle row differs.
  const g = grid.split('\n');
  const p = plain.split('\n');
  assert.equal(p[0], g[0]);
  assert.equal(p[1], g[1]);
  assert.equal(p[p.length - 1], g[g.length - 1]);
  assert.match(plain, /3 fast/);
  assert.match(plain, /1 steady/);
  assert.match(plain, /1 slow/);
  assert.match(plain, /ran out of time/);
});

test('the plain form honours the same suppression rule', () => {
  const args = { mode: 'word-bomb', words: 2, tiers: ['fast', 'fast'], link: 'x' };
  assert.equal(buildResultCard(args), null);
  assert.equal(buildResultCardPlain(args), null, 'a 2-word share is an anti-ad in both forms');
});

test('describeGlyphRow is usable as alt text for the grid', () => {
  assert.equal(describeGlyphRow([], { killed: false }), '');
  assert.match(describeGlyphRow(['fast', 'fast'], { killed: false }), /^Word pace: 2 fast\.$/);
  assert.match(describeGlyphRow([], { killed: true }), /ran out of time/);
});
