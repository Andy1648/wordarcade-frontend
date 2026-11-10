// tapChoices.test.js — TAP-TO-ANSWER (feat/sat-tap). The choice set is pure data on the engine:
// who stands on the card, when each distractor is crossed out, what a pick is worth, and that the
// rules the typed game is built on survive the change of input — answering EARLY still pays (the
// 5x→1x decay is untouched), waiting still costs (eliminations replace the spell-along), a final
// timeout is still a miss, a wrong pick is a miss, and heat only rewards fast clears.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createSatRushEngine,
  buildChoices,
  choiceEliminated,
  choicesStanding,
  tapRevealed,
  TAP_CHOICES_BRIEFING,
  DEFAULT_CONFIG,
} from './engine.js';
import { generateSuspects } from './suspects.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SAT = JSON.parse(readFileSync(resolve(HERE, '../data/satRush/words.json'), 'utf8'));

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FINAL = DEFAULT_CONFIG.stageMultipliers.length - 1;

test('BRIEFING: 4 choices, the answer exactly once, no word twice, same length as the answer', () => {
  for (let i = 0; i < 400; i++) {
    const rng = mulberry32(i + 1);
    const answer = SAT[Math.floor(rng() * SAT.length)];
    const { choices, count } = buildChoices({ answer, pool: SAT, rng, mode: 'briefing' });
    assert.equal(count, TAP_CHOICES_BRIEFING, `${answer.word}: four choices`);
    assert.equal(choices.length, count);
    const words = choices.map((c) => c.word);
    assert.equal(new Set(words).size, words.length, `${answer.word}: never the same word twice (${words})`);
    assert.equal(choices.filter((c) => c.isAnswer).length, 1);
    assert.equal(choices.find((c) => c.isAnswer).word, answer.word);
    for (const c of choices) {
      if (c.isAnswer) continue;
      assert.ok(Math.abs(c.word.length - answer.word.length) <= 2, `${c.word} vs ${answer.word}: similar length`);
      assert.ok(!(answer.alts || []).includes(c.word), `${c.word} is an alt of ${answer.word}`);
    }
  }
});

test('BRIEFING never offers a gloss-synonym of the answer (IMPEDE / STYMIE / HINDER)', () => {
  const impede = SAT.find((r) => r.word === 'impede');
  assert.ok(impede);
  for (let s = 0; s < 80; s++) {
    const words = buildChoices({ answer: impede, pool: SAT, rng: mulberry32(s), mode: 'briefing' }).choices.map((c) => c.word);
    assert.ok(!words.includes('stymie') && !words.includes('hinder'), `seed ${s}: ${words}`);
  }
});

test('BRIEFING distractors prefer the same part of speech and the nearest tier', () => {
  let samePos = 0;
  let total = 0;
  let tierGap = 0;
  for (let i = 0; i < 300; i++) {
    const rng = mulberry32(1000 + i);
    const answer = SAT[Math.floor(rng() * SAT.length)];
    const { choices } = buildChoices({ answer, pool: SAT, rng, mode: 'briefing' });
    const byWord = new Map(SAT.map((r) => [r.word, r]));
    for (const c of choices) {
      if (c.isAnswer) continue;
      const r = byWord.get(c.word);
      total += 1;
      if (r.pos === answer.pos) samePos += 1;
      tierGap += Math.abs(r.tier - answer.tier);
    }
  }
  assert.ok(samePos / total > 0.95, `same POS ${((100 * samePos) / total).toFixed(1)}%`);
  assert.ok(tierGap / total < 0.6, `mean tier gap ${(tierGap / total).toFixed(2)}`);
});

test('the order is STABLE for a seed and the answer position is shuffled across cards', () => {
  const answer = SAT.find((r) => r.word.length === 8 && r.pos === 'adj') || SAT[0];
  const a = buildChoices({ answer, pool: SAT, rng: mulberry32(7), mode: 'briefing' });
  const b = buildChoices({ answer, pool: SAT, rng: mulberry32(7), mode: 'briefing' });
  assert.deepEqual(a, b, 'same seed → same card');
  const slots = new Set();
  for (let s = 0; s < 60; s++) {
    const { choices } = buildChoices({ answer, pool: SAT, rng: mulberry32(s), mode: 'briefing' });
    slots.add(choices.findIndex((c) => c.isAnswer));
  }
  assert.equal(slots.size, TAP_CHOICES_BRIEFING, 'the answer lands in every position');
});

test('BRIEFING elimination: 4 → 4 → 3 (free) → 2 (tick); never below 2; the answer never crossed out', () => {
  for (let i = 0; i < 200; i++) {
    const rng = mulberry32(5000 + i);
    const answer = SAT[Math.floor(rng() * SAT.length)];
    const set = buildChoices({ answer, pool: SAT, rng, mode: 'briefing', finalStage: FINAL });
    assert.equal(set.tickElims, 1);
    assert.equal(choicesStanding(set.choices, 0, 0), 4);
    assert.equal(choicesStanding(set.choices, 1, 0), 4);
    assert.equal(choicesStanding(set.choices, FINAL, 0), 3);
    assert.equal(choicesStanding(set.choices, FINAL, 1), 2);
    assert.equal(choicesStanding(set.choices, FINAL, 99), 2, 'two always stand — the player makes the last call');
    const ans = set.choices.find((c) => c.isAnswer);
    assert.equal(choiceEliminated(ans, FINAL, 99), false);
    // help eliminations (the tap twin of revealed letters): 0 before the final stage, 1 free, 2 after a tick
    assert.equal(tapRevealed(set.choices, 1, 0, FINAL), 0);
    assert.equal(tapRevealed(set.choices, FINAL, 0, FINAL), 1);
    assert.equal(tapRevealed(set.choices, FINAL, 1, FINAL), 2);
  }
});

test('LINEUP reuses the suspect lineup verbatim (6/4/2, same order, stage eliminations, no ticks)', () => {
  for (let i = 0; i < 100; i++) {
    const rng = mulberry32(9000 + i);
    const answer = SAT[Math.floor(rng() * SAT.length)];
    const suspects = generateSuspects({ answer, pool: SAT, rng });
    const set = buildChoices({ answer, pool: SAT, rng, mode: 'lineup', suspects, finalStage: FINAL });
    assert.deepEqual(set.choices.map((c) => c.word), suspects.lineup.map((s) => s.word));
    assert.equal(set.tickElims, 0);
    for (let st = 0; st <= FINAL; st++) {
      const want = suspects.lineup.filter((s) => s.eliminatedAtStage == null || s.eliminatedAtStage > st).length;
      assert.equal(choicesStanding(set.choices, st, 0), want);
    }
    // stage-1 cuts are priced by the 3x multiplier, not help; the final-stage cuts are help
    assert.equal(tapRevealed(set.choices, 1, 0, FINAL), 0);
  }
});

// --- the engine: judge / eliminate / endgame, and the scoring rules surviving the input change ----

function tapEngine({ mode = 'briefing', seed = 3, config = {} } = {}) {
  return createSatRushEngine({ words: SAT, rng: mulberry32(seed), config: { mode, choices: true, ...config } });
}
const answerOf = (eng) => eng.getState().current.word;
const wrongOf = (eng) => {
  const v = eng.choiceView();
  return v.list.find((c) => !c.eliminated && c.word !== answerOf(eng)).word;
};

test('choices are off by default (the endless/typed engine is unchanged)', () => {
  const eng = createSatRushEngine({ words: SAT, rng: mulberry32(1) });
  eng.nextWord();
  assert.equal(eng.getState().current.choices, null);
  assert.equal(eng.choiceView(), null);
  assert.equal(eng.judgeChoice('anything').valid, false);
});

test('a correct pick at stage 0 pays the full 5x and bumps heat', () => {
  const eng = tapEngine();
  eng.nextWord();
  const j = eng.judgeChoice(answerOf(eng));
  assert.deepEqual(j, { valid: true, correct: true, revealed: 0 });
  const r = eng.submitCorrect({ revealed: j.revealed });
  assert.equal(r.breakdown.stageMultiplier, 5);
  assert.equal(r.heat, 1);
});

test('waiting still costs: a pick at the final stage pays 1x; after the free cut it still heats, after a tick it does not', () => {
  const eng = tapEngine({ seed: 11 });
  eng.nextWord();
  while (!eng.advanceStage().atFinal);
  let j = eng.judgeChoice(answerOf(eng));
  assert.equal(j.revealed, 1, 'the free stage-2 elimination = the free first letter');
  let r = eng.submitCorrect({ revealed: j.revealed });
  assert.equal(r.breakdown.stageMultiplier, 1);
  assert.equal(r.heat, 1, 'heatMaxRevealed = 1 → still heats');

  eng.nextWord();
  while (!eng.advanceStage().atFinal);
  const t = eng.eliminateNext();
  assert.equal(t.eliminated, true);
  assert.equal(t.standing, 2);
  assert.equal(eng.eliminateNext().eliminated, false, 'never below two standing');
  j = eng.judgeChoice(answerOf(eng));
  assert.equal(j.revealed, 2);
  r = eng.submitCorrect({ revealed: j.revealed });
  assert.equal(r.heat, 1, 'leaning on an endgame cut leaves heat unchanged (not reset)');
});

test('eliminateNext does nothing before the final stage (the stage clock owns the 5x/3x window)', () => {
  const eng = tapEngine();
  eng.nextWord();
  assert.equal(eng.eliminateNext().eliminated, false);
  assert.equal(eng.choiceView().standing, 4);
});

test('a wrong pick is judged a miss → the miss costs a life, zeroes heat and requeues a revenant', () => {
  const eng = tapEngine({ seed: 21, config: { revenantOffset: 2 } });
  eng.nextWord();
  eng.submitCorrect({ revealed: eng.judgeChoice(answerOf(eng)).revealed });
  assert.equal(eng.getState().heat, 1);
  eng.nextWord();
  const missed = answerOf(eng);
  const j = eng.judgeChoice(wrongOf(eng));
  assert.equal(j.valid, true);
  assert.equal(j.correct, false);
  const m = eng.miss();
  assert.equal(m.lives, DEFAULT_CONFIG.lives - 1);
  assert.equal(eng.getState().heat, 0);
  assert.equal(eng.getState().pendingRevenants, 1);
  let back = null;
  for (let i = 0; i < 4 && !back; i++) {
    eng.nextWord();
    const c = eng.getState().current;
    if (c.isRevenant) back = c;
    else eng.submitCorrect();
  }
  assert.ok(back, 'the missed word returns');
  assert.equal(back.word, missed);
  assert.ok(back.choices && back.choices.choices.some((c) => c.word === missed && c.isAnswer), 'with a fresh choice set');
});

test('a crossed-out or unknown pick is ignored, never a miss', () => {
  const eng = tapEngine({ seed: 31 });
  eng.nextWord();
  while (!eng.advanceStage().atFinal);
  const gone = eng.choiceView().list.find((c) => c.eliminated);
  assert.ok(gone);
  assert.equal(eng.judgeChoice(gone.word).valid, false);
  assert.equal(eng.judgeChoice('notonthecard').valid, false);
  assert.equal(eng.getState().lives, DEFAULT_CONFIG.lives);
});

test('the tap endgame is data: one tick per remaining cut on the spell-along cadence, then a 2-tick hold', () => {
  const eng = tapEngine({ config: { spellAlongMs: 1000 } });
  eng.nextWord();
  assert.deepEqual(eng.tapEndgame(), { tickMs: 1000, autoElimMax: 1, finalHoldMs: 2000 });
  const lineup = tapEngine({ mode: 'lineup' });
  lineup.nextWord();
  assert.equal(lineup.tapEndgame().autoElimMax, 0, 'lineup has no ticks — its last-call window runs instead');
});

test('choiceView never exposes which choice is the answer', () => {
  const eng = tapEngine({ mode: 'lineup', seed: 41 });
  eng.nextWord();
  const v = eng.choiceView();
  for (const c of v.list) assert.deepEqual(Object.keys(c).sort(), ['eliminated', 'word']);
  assert.equal(v.count, eng.getState().current.suspects.count);
});
