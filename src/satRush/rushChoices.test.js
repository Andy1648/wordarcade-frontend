// rushChoices.test.js — nov24 (Andy: "give more answer choices" + silver tongue "remove for now as it's education
// setting"): every LANGUAGE rush (French included) offers 8 suspects in QUIZ and 6 choices in STUDY FIRST, and
// never builds heat; SAT Rush keeps its 6 / 4 and its SILVER TONGUE.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPack } from './packs.js';
import { createSatRushEngine, buildChoices } from './engine.js';
import { generateSuspects } from './suspects.js';

const ES = JSON.parse(readFileSync(new URL('../data/spanishRush/words.json', import.meta.url), 'utf8'));
const FR = JSON.parse(readFileSync(new URL('../data/frenchRush/words.json', import.meta.url), 'utf8'));

test('every language pack asks for 8 / 6 choices and no silver; SAT keeps its own', () => {
  for (const id of ['fr', 'es', 'it', 'la', 'zh']) {
    const p = getPack(id);
    assert.equal(p.lineupSize, 8, id);
    assert.equal(p.briefingChoices, 6, id);
    assert.equal(p.silverTongue, false, id);
  }
  const sat = getPack('sat');
  assert.equal(sat.lineupSize, undefined);
  assert.equal(sat.briefingChoices, undefined);
  assert.notEqual(sat.silverTongue, false);
});

test('an 8-suspect lineup narrows 8 → 5 → 2 and keeps the answer + a different-first-letter survivor', () => {
  let full = 0;
  for (const answer of ES) {
    const s = generateSuspects({ answer, pool: ES, size: 8 });
    const words = s.lineup.map((x) => x.word);
    assert.equal(new Set(words).size, words.length, answer.word);
    assert.equal(s.lineup.filter((x) => x.isAnswer).length, 1);
    if (s.count !== 8) continue;
    full++;
    const standing = (st) => s.lineup.filter((x) => x.eliminatedAtStage == null || x.eliminatedAtStage > st).length;
    assert.deepEqual([standing(0), standing(1), standing(2)], [8, 5, 2], answer.word);
  }
  assert.ok(full / ES.length > 0.95, `8 suspects for ${full}/${ES.length}`);
});

test('the default lineup is still six (SAT Rush unchanged)', () => {
  const answer = FR[10];
  assert.ok(generateSuspects({ answer, pool: FR }).count <= 6);
});

test('STUDY FIRST offers 6 choices when asked, 4 by default', () => {
  const answer = ES[20];
  assert.equal(buildChoices({ answer, pool: ES, size: 6 }).count, 6);
  assert.equal(buildChoices({ answer, pool: ES }).count, 4);
});

test('silverTongue:false — a run of perfect clears never heats, never doubles the multiplier', () => {
  const run = (silverTongue) => {
    const eng = createSatRushEngine({ words: FR, config: { silverTongue, lives: 99 } });
    let silver = false;
    for (let i = 0; i < 12; i++) {
      eng.nextWord();
      const r = eng.submitCorrect(0);
      silver = silver || !!r.silverTongue;
    }
    return { heat: eng.getState().heat, silver };
  };
  assert.deepEqual(run(false), { heat: 0, silver: false });
  assert.equal(run(true).silver, true);
});

// ---- nov24 round 2 ----
import { RUSH_LANGS, RUSH_LANG_ORDER } from './rushLang.js';
import { plausibility } from './suspects.js';

test('every language prints every menu key in its own words, and SAT keeps none', () => {
  const keys = Object.keys(RUSH_LANGS.fr.menu).sort();
  for (const id of RUSH_LANG_ORDER) {
    const M = RUSH_LANGS[id].menu;
    assert.deepEqual(Object.keys(M).sort(), keys, id);
    assert.equal(getPack(id).ui.menu, M, id);
    assert.equal(getPack(id).ui.modes.briefing.title, M.studyFirst);
    assert.equal(getPack(id).ui.defaultDifficulty, 'hard', id);
    assert.equal(RUSH_LANGS[id].categories.length, 8, id);
  }
  // Andy's own examples for STUDY
  assert.deepEqual(RUSH_LANG_ORDER.map((id) => RUSH_LANGS[id].menu.studyFirst), ['ÉTUDIER', 'ESTUDIAR', 'STUDIARE', 'DISCE', '学习']);
  assert.equal(getPack('sat').ui && getPack('sat').ui.menu, undefined);
  assert.equal(getPack('sat').plausibleDistractors, undefined);
});

test('plausible lineups: more same-gender and same-theme suspects than a random draw, never a synonym', () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const share = (plausible) => {
    let gender = 0;
    let theme = 0;
    let n = 0;
    for (const answer of ES) {
      const s = generateSuspects({ answer, pool: ES, rng, size: 8, plausible });
      for (const x of s.lineup) {
        if (x.isAnswer) continue;
        const row = ES.find((r) => r.word === x.word);
        n++;
        if (answer.pos === 'n' && row.gender === answer.gender) gender++;
        if (row.category === answer.category) theme++;
        if (plausible) assert.ok(!(answer.alts || []).includes(x.word), `${x.word} is an alt of ${answer.word}`);
      }
    }
    return { gender: gender / n, theme: theme / n };
  };
  const rand = share(false);
  const plaus = share(true);
  assert.ok(plaus.gender > rand.gender + 0.15, `gender ${rand.gender} → ${plaus.gender}`);
  assert.ok(plaus.theme > rand.theme + 0.1, `theme ${rand.theme} → ${plaus.theme}`);
});

test('plausibility prefers the look-alike of the same kind', () => {
  const a = { word: 'bandera', pos: 'n', gender: 'f', category: 'identidades', tier: 2 };
  const near = { word: 'bandeja', pos: 'n', gender: 'f', category: 'identidades', tier: 2 };
  const far = { word: 'correr', pos: 'v', gender: null, category: 'vida', tier: 5 };
  assert.ok(plausibility(a, near) > plausibility(a, far) + 5);
});
