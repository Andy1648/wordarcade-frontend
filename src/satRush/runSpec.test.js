// runSpec.test.js — a Rush run is finite, configurable data. The builder must honour the tier
// band, the length, the review share, and never deal a word twice.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSpec,
  bandWords,
  tierTargets,
  buildRunQueue,
  DEFAULT_SPEC,
  LENGTHS,
  REVIEW_SHARE,
} from './runSpec.js';
import { freshState, recordResult } from './lexicon.js';
import { readFileSync } from 'node:fs';
import { getPack, PACKS } from './packs.js';

const SAT_WORDS = JSON.parse(readFileSync(new URL('../data/satRush/words.json', import.meta.url), 'utf8'));

const IDENTITY_RNG = () => 0.9999999;

function makePool(perTier = 20) {
  const rows = [];
  for (let t = 1; t <= 5; t++) {
    for (let i = 0; i < perTier; i++) {
      rows.push({ word: `w${t}${String(i).padStart(2, '0')}`, pos: 'n', tier: t, gloss: 'g', context: '___' });
    }
  }
  return rows;
}

test('normalizeSpec: junk falls back to defaults; length must be one the mode offers', () => {
  assert.deepEqual(normalizeSpec({}), DEFAULT_SPEC);
  assert.deepEqual(normalizeSpec(null), DEFAULT_SPEC);
  const s = normalizeSpec({ mode: 'briefing', difficulty: 'nope', length: 999, pack: '' });
  assert.equal(s.mode, 'briefing');
  assert.equal(s.difficulty, 'standard');
  assert.equal(s.length, LENGTHS.briefing[0]);
  assert.equal(s.pack, 'sat');
  assert.equal(normalizeSpec({ mode: 'lineup', length: '20' }).length, 20);
});

test('bandWords keeps the difficulty tier band (and the category when named)', () => {
  const pool = makePool(3);
  assert.ok(bandWords(pool, 'easy').every((r) => r.tier <= 2));
  assert.ok(bandWords(pool, 'hard').every((r) => r.tier >= 3));
  const tagged = pool.map((r, i) => ({ ...r, category: i % 2 ? 'famille' : 'maison' }));
  assert.ok(bandWords(tagged, 'standard', 'famille').every((r) => r.category === 'famille'));
});

test('tierTargets ramps low → high and puts the band top on deep-cut slots', () => {
  assert.deepEqual(tierTargets(4, 'standard'), [1, 2, 3, 4]);
  assert.deepEqual(tierTargets(1, 'hard'), [3]);
  const t = tierTargets(10, 'easy', 5);
  assert.equal(t[4], 2);
  assert.equal(t[9], 2);
});

test('buildRunQueue: exactly `length` distinct words, all inside the band, ramping up', () => {
  for (const difficulty of ['easy', 'standard', 'hard']) {
    for (const length of LENGTHS.lineup) {
      const { rows } = buildRunQueue({ spec: { mode: 'lineup', difficulty, length }, words: makePool(), rng: IDENTITY_RNG });
      assert.equal(rows.length, length);
      assert.equal(new Set(rows.map((r) => r.word)).size, length);
      const band = new Set(bandWords(makePool(), difficulty).map((r) => r.word));
      assert.ok(rows.every((r) => band.has(r.word)));
      assert.ok(rows[0].tier <= rows[rows.length - 1].tier);
    }
  }
});

test('buildRunQueue: a tiny band runs short instead of padding or repeating', () => {
  const { rows } = buildRunQueue({ spec: { mode: 'lineup', difficulty: 'easy', length: 30 }, words: makePool(3), rng: IDENTITY_RNG });
  assert.equal(rows.length, 6);
});

test('buildRunQueue: shaky words come back — capped at the review share, never in slot 1', () => {
  const words = makePool();
  const lex = freshState();
  // ten band words missed in session 1 → due + needs review in session 2
  for (let i = 0; i < 10; i++) recordResult(lex, `w1${String(i).padStart(2, '0')}`, { cleared: false });
  for (const w of Object.keys(lex.records)) lex.records[w].lastSeen = 1;
  const { rows, reviewWords } = buildRunQueue({
    spec: { mode: 'lineup', difficulty: 'standard', length: 10 },
    words,
    lex,
    session: 2,
    rng: IDENTITY_RNG,
  });
  assert.equal(reviewWords.size, Math.floor(10 * REVIEW_SHARE));
  assert.ok(!reviewWords.has(rows[0].word));
  assert.equal(new Set(rows.map((r) => r.word)).size, rows.length);
});

test('buildRunQueue: unseen words before recent ones', () => {
  const words = makePool(8);
  const recent = new Set(words.filter((r) => r.tier === 1).slice(0, 2).map((r) => r.word));
  const { rows } = buildRunQueue({ spec: { mode: 'lineup', difficulty: 'easy', length: 10 }, words, recent, rng: IDENTITY_RNG });
  assert.ok(rows.every((r) => !recent.has(r.word)));
});

test('packs: the SAT words fill a 30-word hard run; unknown ids fall back', () => {
  assert.equal(getPack('nope'), PACKS.sat);
  const { rows } = buildRunQueue({ spec: { mode: 'lineup', difficulty: 'hard', length: 30 }, words: SAT_WORDS });
  assert.equal(rows.length, 30);
});
