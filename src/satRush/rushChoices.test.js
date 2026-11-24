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
