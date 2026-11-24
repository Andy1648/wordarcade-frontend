// languageRush.test.js — LANGUAGE RUSH (nov24): Spanish, Italian, Latin and Chinese are French Rush with their
// own words. Each language's data must be well-formed for the engine and deal every theme at every level; typing
// forgives accents (ñ, macrons) without hiding them; the board form, the 🔊 voice and the class link follow the
// page's language; and French stays exactly what it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSlotInput } from './input.js';
import { getPack, posLabelOf, isLanguagePack } from './packs.js';
import { buildRunQueue, bandWords, studyPool, normalizeSpec, difficultiesFor, FR_DIFFICULTIES, DIFFICULTIES } from './runSpec.js';
import { freshState } from './lexicon.js';
import { createSatRushEngine } from './engine.js';
import { RUSH_LANGS, RUSH_LANG_ORDER, langFromPath, setRushLang, rushLang, displayOf, sayTextOf } from './rushLang.js';
import { withArticle, rankVoice, pickVoiceFor, pickFrVoice } from './speak.js';

const DIRS = { es: 'spanishRush', it: 'italianRush', la: 'latinRush', zh: 'chineseRush' };
const WORD_RE = {
  es: /^[a-záéíóúüñ]{3,14}$/,
  it: /^[a-zàèéìíòóùú]{3,14}$/,
  la: /^[a-zāēīōūȳ]{3,14}$/,
  zh: /^[a-z]{3,14}$/,
};
const load = (id) => JSON.parse(readFileSync(new URL(`../data/${DIRS[id]}/words.json`, import.meta.url), 'utf8'));
const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

for (const id of Object.keys(DIRS)) {
  const WORDS = load(id);
  const PACK = getPack(id);
  const CATS = PACK.categories.map((c) => c.id);

  test(`${id}: every row is typeable, blanked once, glossed, translated, in a known theme`, () => {
    assert.ok(WORDS.length >= 400, `only ${WORDS.length} words`);
    const seen = new Set();
    const folded = new Set();
    const glosses = new Set();
    for (const r of WORDS) {
      assert.match(r.word, WORD_RE[id], r.word);
      assert.ok(!seen.has(r.word), `duplicate ${r.word}`);
      assert.ok(!folded.has(fold(r.word)), `${r.word}: same letters as another word once accents go`);
      seen.add(r.word);
      folded.add(fold(r.word));
      assert.equal(r.context.split('___').length, 2, `${r.word}: one blank`);
      assert.ok(r.gloss && r.contextEn && r.display, `${r.word}: gloss + contextEn + display`);
      const g = r.gloss.toLowerCase().trim();
      assert.ok(!glosses.has(g), `${r.word}: the meaning "${r.gloss}" names two words`);
      glosses.add(g);
      assert.ok(CATS.includes(r.category), `${r.word}: theme ${r.category}`);
      assert.ok([1, 2, 3, 4, 5].includes(r.tier) && [1, 2, 3].includes(r.ap), `${r.word}: tier / ap`);
      if (r.falseFriend) assert.equal(r.guessable, false, `${r.word}: a false friend is never guessable`);
      if (id === 'zh') {
        assert.equal(r.gloss, `${r.hanzi} (${r.pinyin})`, `${r.word}: gloss is hanzi (pinyin)`);
        assert.ok(!/\d/.test(r.pinyin), `${r.word}: tone marks, not digits`);
        assert.equal(r.guessable, false);
      } else {
        assert.ok(fold(r.display).includes(fold(r.word)), `${r.word}: the board form "${r.display}" holds the word`);
        if (r.pos === 'n') assert.ok(['m', 'f', 'mf', ...(id === 'la' ? ['n'] : [])].includes(r.gender), `${r.word}: noun gender`);
      }
    }
  });

  test(`${id}: every theme deals a full 10-word case at every level, and STUDY FIRST has 15 words to teach`, () => {
    const pack = { ...PACK, words: WORDS };
    for (const category of CATS) {
      for (const difficulty of ['easy', 'standard', 'hard']) {
        const band = bandWords(WORDS, difficulty, category, id);
        assert.ok(band.length >= 10, `${category}/${difficulty} has only ${band.length} words`);
        const { rows } = buildRunQueue({ spec: { pack: id, mode: 'lineup', difficulty, length: 10, category }, words: WORDS });
        assert.equal(rows.length, 10, `${category}/${difficulty}`);
        const spec = normalizeSpec({ pack: id, mode: 'briefing', difficulty, length: 15, category });
        const pool = studyPool(pack, spec, freshState());
        assert.ok(pool.length >= 15 && pool.every((r) => !r.guessable), `${category}/${difficulty}: study pool`);
      }
    }
  });

  test(`${id}: typing without accents fills the accented word; the slot keeps the accent`, () => {
    for (const r of WORDS) {
      const inp = createSlotInput({ target: r.word, accentFold: PACK.accentFold });
      let last = null;
      for (const k of fold(r.word)) {
        last = inp.typeLetter(k);
        assert.equal(last.accepted, true, `${r.word}: ${k}`);
      }
      assert.equal(last.complete, true, r.word);
      assert.equal(inp.getState().typed, r.word.toLowerCase());
    }
  });

  test(`${id}: the meaning is the first clue, the example the second (as in French)`, () => {
    const e = createSatRushEngine({ words: WORDS, queue: WORDS.slice(0, 3), config: { meaningFirst: PACK.meaningFirst } });
    const at = Object.fromEntries(e.nextWord().reveals.map((r) => [r.type, r.stage]));
    assert.equal(at.gloss, 0);
    assert.equal(at.sentence, 1);
  });
}

test('the language packs share French’s levels, pace and lean review card; SAT keeps its own', () => {
  for (const id of RUSH_LANG_ORDER) {
    assert.ok(isLanguagePack(id));
    assert.equal(difficultiesFor(id), FR_DIFFICULTIES);
    const p = getPack(id);
    assert.equal(p.id, id);
    assert.equal(p.defaultPace, 'timed');
    assert.equal(p.ui.review.lean, true);
    assert.equal(p.accentFold, true);
    assert.deepEqual(p.timing, getPack('fr').timing);
  }
  assert.equal(difficultiesFor('sat'), DIFFICULTIES);
  assert.ok(!isLanguagePack('sat'));
  // each language remembers its own words
  const keys = RUSH_LANG_ORDER.map((id) => getPack(id).storageKey);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(getPack('fr').storageKey, 'wa_frenchrush_lexicon');
});

test('every language has its own link, and only those paths are language pages', () => {
  assert.equal(langFromPath('/french-rush'), 'fr');
  assert.equal(langFromPath('/spanish-rush/'), 'es');
  assert.equal(langFromPath('/Italian-Rush'), 'it');
  assert.equal(langFromPath('/latin-rush'), 'la');
  assert.equal(langFromPath('/chinese-rush'), 'zh');
  assert.equal(langFromPath('/german-rush'), null);
  assert.equal(langFromPath('/'), null);
  const slugs = RUSH_LANG_ORDER.map((id) => RUSH_LANGS[id].slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('the board form follows the page: French builds the article, the others print their own', () => {
  setRushLang('fr', []);
  assert.equal(withArticle('famille', 'n', 'f'), 'la famille');
  assert.equal(withArticle('école', 'n', 'f'), "l'école");
  setRushLang('es', [{ word: 'agua', display: 'el agua' }]);
  assert.equal(withArticle('agua', 'n', 'f'), 'el agua'); // never "la agua"
  assert.equal(withArticle('nada', 'adv', null), 'nada');
  setRushLang('la', [{ word: 'amō', display: 'amō, amāre, amāvī, amātum' }]);
  assert.equal(withArticle('amō', 'v', null), 'amō, amāre, amāvī, amātum');
  assert.equal(posLabelOf(getPack('la'), { pos: 'n', gender: 'n' }), 'noun (n.)');
  // Chinese: the big word is the English answer; the 🔊 reads the characters
  setRushLang('zh', [{ word: 'water', display: '水', hanzi: '水' }]);
  assert.equal(withArticle('water', 'n', null), 'water');
  assert.equal(displayOf('water'), null);
  assert.equal(sayTextOf('water'), '水');
  assert.equal(rushLang().id, 'zh');
  setRushLang('fr', []);
  assert.equal(sayTextOf('famille'), 'famille');
});

test('each language picks its own voice; Latin has none; Chinese never takes a Cantonese voice', () => {
  const V = (name, lang) => ({ name, lang, localService: true });
  const voices = [V('Thomas', 'fr-FR'), V('Paulina', 'es-MX'), V('Monica', 'es-ES'), V('Alice', 'it-IT'), V('Sinji', 'zh-HK'), V('Tingting', 'zh-CN'), V('Samantha', 'en-US')];
  assert.equal(pickFrVoice(voices).name, 'Thomas');
  assert.equal(pickVoiceFor(voices, RUSH_LANGS.es.voice).name, 'Paulina');
  assert.equal(pickVoiceFor(voices, RUSH_LANGS.it.voice).name, 'Alice');
  assert.equal(pickVoiceFor(voices, RUSH_LANGS.zh.voice).name, 'Tingting');
  assert.equal(pickVoiceFor([V('Sinji', 'zh-HK')], RUSH_LANGS.zh.voice), null);
  assert.equal(pickVoiceFor(voices, RUSH_LANGS.la.voice), null);
  assert.equal(rankVoice(V('Samantha', 'en-US'), RUSH_LANGS.es.voice), -1);
});
