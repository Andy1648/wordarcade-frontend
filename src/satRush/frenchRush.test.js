// frenchRush.test.js — the FRENCH RUSH pack: its data is well-formed for the engine, typing forgives
// accents without hiding them, and the poster never prints the answer inside its word family.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSlotInput, foldLetter } from './input.js';
import { getPack, posLabelOf, playRoot } from './packs.js';
import { buildRunQueue, bandWords, studyPool, normalizeSpec } from './runSpec.js';
import { freshState, markStudied, hasStudied, load, save } from './lexicon.js';
import { createSatRushEngine } from './engine.js';

const WORDS = JSON.parse(readFileSync(new URL('../data/frenchRush/words.json', import.meta.url), 'utf8'));
const PACK = getPack('fr');
const CATS = PACK.categories.map((c) => c.id);

test('every French row is typeable, blanked once, glossed, translated, and in a known theme', () => {
  assert.ok(WORDS.length >= 300, `only ${WORDS.length} words`);
  const seen = new Set();
  for (const r of WORDS) {
    assert.match(r.word, /^[a-zàâäçéèêëîïôöùûüÿœæ]{3,14}$/, r.word);
    assert.ok(!seen.has(r.word), `duplicate ${r.word}`);
    seen.add(r.word);
    assert.equal(r.context.split('___').length, 2, `${r.word}: one blank`);
    assert.ok(r.gloss && r.contextEn, `${r.word}: gloss + contextEn`);
    assert.ok(CATS.includes(r.category), `${r.word}: theme ${r.category}`);
    assert.ok([1, 2, 3, 4, 5].includes(r.tier), `${r.word}: tier`);
    if (r.pos === 'n') assert.ok(['m', 'f', 'mf'].includes(r.gender), `${r.word}: noun gender`);
    assert.ok([1, 2, 3].includes(r.ap), `${r.word}: AP priority`);
  }
});

test('every theme can deal a full 10-word case at every difficulty', () => {
  for (const category of CATS) {
    for (const difficulty of ['easy', 'standard', 'hard']) {
      const band = bandWords(WORDS, difficulty, category, 'fr');
      const { rows } = buildRunQueue({ spec: { pack: 'fr', mode: 'lineup', difficulty, length: 10, category }, words: WORDS });
      assert.equal(rows.length, Math.min(10, band.length), `${category}/${difficulty}`);
      assert.ok(band.length >= 10, `${category}/${difficulty} has only ${band.length} words`);
    }
  }
});

test('accent folding: e fills é, c fills ç, the slot keeps the accent; oe spells œ', () => {
  assert.equal(foldLetter('é'), 'e');
  assert.equal(foldLetter('ç'), 'c');
  const a = createSlotInput({ target: 'école', accentFold: true });
  for (const k of 'ecole') assert.equal(a.typeLetter(k).accepted, true, k);
  assert.equal(a.getState().typed, 'école');
  const b = createSlotInput({ target: 'cœur', accentFold: true });
  assert.equal(b.typeLetter('c').accepted, true);
  assert.equal(b.typeLetter('o').accepted, true);
  assert.equal(b.typeLetter('e').reason, 'ignored');
  assert.equal(b.typeLetter('u').accepted, true);
  assert.equal(b.typeLetter('r').complete, true);
  assert.equal(b.getState().typed, 'cœur');
  // the typed accent is accepted too; SAT (no folding) still rejects a bare e for é
  assert.equal(createSlotInput({ target: 'été', accentFold: true }).typeLetter('é').accepted, true);
  assert.equal(createSlotInput({ target: 'été' }).typeLetter('e').accepted, false);
});

test('meaning first: the English gloss prints at stage 0, the French example at stage 1', () => {
  const e = createSatRushEngine({ words: WORDS, queue: WORDS.slice(0, 3), config: { meaningFirst: true } });
  const cur = e.nextWord();
  const at = Object.fromEntries(cur.reveals.map((r) => [r.type, r.stage]));
  assert.equal(at.gloss, 0);
  assert.equal(at.sentence, 1);
});

test('the case id names a noun\'s gender', () => {
  assert.equal(posLabelOf(PACK, { pos: 'n', gender: 'f' }), 'noun (f.)');
  assert.equal(posLabelOf(PACK, { pos: 'v' }), 'verb');
});

test('the poster never prints the answer inside its word family', () => {
  assert.equal(playRoot({ morpheme: 'école', meaning: 'school', cousins: ['écolier'] }, 'école').morpheme, null);
  // accent-insensitive: divorcé is the answer with an accent — it goes too; the head (divorcer) stays
  assert.deepEqual(playRoot({ morpheme: 'divorcer', meaning: 'x', cousins: ['divorcé', 'divorce', 'divorcer'] }, 'divorce').cousins, ['divorcer']);
  assert.equal(playRoot({ morpheme: 'ecole', meaning: 'x', cousins: ['école'] }, 'école'), null);
  for (const r of WORDS) {
    const shown = playRoot(r.root, r.word);
    if (!shown) continue;
    const text = [shown.morpheme || '', ...shown.cousins].join(' ').toLowerCase();
    assert.ok(!text.split(/\s+/).includes(r.word), `${r.word} printed in its own family`);
  }
});

test('levels follow the AP: BASICS is must-know only, SCORE 5 is the harder tail', () => {
  const basics = bandWords(WORDS, 'easy', null, 'fr');
  assert.ok(basics.every((r) => r.ap === 1 && r.tier <= 2));
  const core = bandWords(WORDS, 'standard', null, 'fr');
  assert.ok(core.every((r) => r.ap <= 2));
  const hard = bandWords(WORDS, 'hard', null, 'fr');
  assert.ok(hard.every((r) => r.tier >= 3));
  // a BASICS case leads with must-know words even when the band is mixed
  const { rows } = buildRunQueue({ spec: { pack: 'fr', mode: 'lineup', difficulty: 'standard', length: 10 }, words: WORDS });
  assert.ok(rows.filter((r) => r.ap === 1).length >= 6, 'a STANDARD case is mostly must-know words');
});

test('STUDY FIRST deals only words you cannot guess from English (the quiz keeps them all)', () => {
  const pack = { ...PACK, words: WORDS };
  for (const category of CATS) {
    for (const difficulty of ['easy', 'standard', 'hard']) {
      const spec = normalizeSpec({ pack: 'fr', mode: 'briefing', difficulty, length: 15, category });
      const pool = studyPool(pack, spec, freshState());
      assert.ok(pool.every((r) => !r.guessable), `${category}/${difficulty}: a guessable word in the study pool`);
      assert.ok(pool.length >= 15, `${category}/${difficulty}: only ${pool.length} study words`);
    }
  }
  assert.ok(bandWords(WORDS, 'standard', null, 'fr').some((r) => r.guessable), 'the quiz still has cognates');
  assert.ok(WORDS.filter((r) => r.falseFriend).every((r) => !r.guessable), 'a false friend is never guessable');
});

test('studied words are remembered (and the setup choices survive a reload)', () => {
  const st = freshState();
  markStudied(st, ['voisin', 'ménage']);
  st.setup = { difficulty: 'easy', pace: 'self', skipStudied: true };
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) || null, setItem: (k, v) => mem.set(k, v) };
  save(storage, st, 'k');
  const back = load(storage, 'k');
  assert.ok(hasStudied(back, 'voisin'));
  assert.ok(!hasStudied(back, 'famille'));
  assert.deepEqual(back.setup, st.setup);
});

test('no two words share a meaning — the English clue alone always names ONE French word', () => {
  const seen = new Map();
  for (const r of WORDS) {
    const g = r.gloss.toLowerCase().trim();
    assert.ok(!seen.has(g), `"${r.gloss}" is the meaning of both ${seen.get(g)} and ${r.word}`);
    seen.set(g, r.word);
  }
});
