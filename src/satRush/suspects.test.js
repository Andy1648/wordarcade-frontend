// suspects.test.js — the LINEUP suspect generator. Covers every hard rule
// (same length, same POS, alts excluded, same-root excluded, no shared 5-substring),
// the count (6 suspects from a rich pool), every fallback tier (exact / +-1 / +-2
// and the reduced 4- and 2-suspect lineups), and the load-bearing invariant: the
// last surviving distractor differs from the answer at the FIRST letter, so the
// final 2-suspect stage is always solvable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSuspects, suspectsStanding } from './suspects.js';

// A small, seedable PRNG so we can sweep many lineups for the invariant.
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

function row(word, { pos = 'adj', morpheme = null, cousins = [], alts = [], gloss } = {}) {
  return {
    word,
    pos,
    tier: 1,
    gloss: gloss || `def of ${word}`,
    context: `use ___ (${word})`,
    root: morpheme ? { morpheme, meaning: 'x', cousins } : null,
    alts,
  };
}

// A generous pool of distinct 5-letter adjectives (distinct first letters, no
// shared 5-substrings, no shared roots) — a full 6-suspect lineup is always
// available from this.
const FIVE_ADJ = ['brave', 'clean', 'dizzy', 'eager', 'faint', 'gaudy', 'happy', 'jumpy', 'kinky', 'lucky', 'moldy', 'nervy'];
function richPool(extra = []) {
  return [...FIVE_ADJ.map((w) => row(w)), ...extra];
}

// The one non-answer suspect still standing at the final stage (eliminatedAtStage
// null and not the answer).
function survivorOf(lineup) {
  return lineup.find((s) => !s.isAnswer && s.eliminatedAtStage == null);
}

test('a rich pool yields exactly 6 suspects, one of them the answer', () => {
  const answer = row('brave');
  const { count, lineup, fallbackTier, reducedCount } = generateSuspects({
    answer,
    pool: richPool(),
    rng: mulberry32(1),
  });
  assert.equal(count, 6);
  assert.equal(lineup.length, 6);
  assert.equal(fallbackTier, 0);
  assert.equal(reducedCount, false);
  assert.equal(lineup.filter((s) => s.isAnswer).length, 1, 'exactly one answer');
  assert.equal(lineup.find((s) => s.isAnswer).word, 'brave');
});

test('every distractor has the SAME letter count as the answer (tier 0)', () => {
  const answer = row('brave');
  // Pool contaminated with 4- and 6-letter words that must never be chosen.
  const pool = richPool([row('sad'), row('tall'), row('gloomy'), row('ancient')]);
  const { lineup, fallbackTier } = generateSuspects({ answer, pool, rng: mulberry32(7) });
  assert.equal(fallbackTier, 0);
  for (const s of lineup) assert.equal(s.word.length, 5, `${s.word} must be 5 letters`);
});

test('every distractor shares the answer POS', () => {
  const answer = row('brave', { pos: 'adj' });
  // Same-length words of other parts of speech that must be excluded.
  const pool = richPool([row('crane', { pos: 'n' }), row('drive', { pos: 'v' })]);
  const { lineup } = generateSuspects({ answer, pool, rng: mulberry32(3) });
  for (const s of lineup) {
    if (s.isAnswer) continue;
    assert.notEqual(s.word, 'crane');
    assert.notEqual(s.word, 'drive');
  }
});

test("the answer's alts are never suspects", () => {
  const answer = row('brave', { alts: ['gutsy'] });
  const pool = richPool([row('gutsy')]); // a same-length, same-POS alt
  // Run several seeds — the alt must never slip in.
  for (let seed = 0; seed < 40; seed++) {
    const { lineup } = generateSuspects({ answer, pool, rng: mulberry32(seed) });
    assert.ok(!lineup.some((s) => s.word === 'gutsy'), `seed ${seed}: alt leaked`);
  }
});

test('words sharing the answer root morpheme are excluded', () => {
  const answer = row('brave', { morpheme: 'br-' });
  const pool = richPool([row('bract', { morpheme: 'br-' })]); // same root, same length
  for (let seed = 0; seed < 40; seed++) {
    const { lineup } = generateSuspects({ answer, pool, rng: mulberry32(seed) });
    assert.ok(!lineup.some((s) => s.word === 'bract'), `seed ${seed}: same-root leaked`);
  }
});

test('words sharing a 5-character substring with the answer are excluded', () => {
  // 'bravery' shares "brave" (5 chars) with the answer 'braves'.
  const answer = row('braves');
  const sixAdj = ['cloudy', 'dreamy', 'feisty', 'greasy', 'grumpy', 'hearty', 'chilly'];
  const pool = [...sixAdj.map((w) => row(w)), row('bravey' /* shares 'brave' */)];
  for (let seed = 0; seed < 40; seed++) {
    const { lineup } = generateSuspects({ answer, pool, rng: mulberry32(seed) });
    assert.ok(!lineup.some((s) => s.word === 'bravey'), `seed ${seed}: 5-substring leaked`);
  }
});

// --- the SYNONYM GUARD (gloss overlap) — the worst-failure case --------------
// Same-length, same-POS words whose glosses mean the same thing but aren't
// cross-listed in alts must never appear as a distractor for each other, or a
// player who fully understood the sentence gets rejected for typing the true
// synonym. These use the REAL dataset glosses for the two named pairs.

// 9-letter adjective fillers with glosses that share no content with the pair
// below (so the lineup still fills to six once the synonym is excluded).
const NINE_FILLERS = ['malicious', 'ferocious', 'strenuous', 'audacious', 'garrulous'].map((w, i) =>
  row(w, { gloss: `filler descriptor number ${i}` })
);
const TEN_FILLERS = ['diplomatic', 'methodical', 'articulate', 'boisterous', 'despondent'].map((w, i) =>
  row(w, { gloss: `filler descriptor number ${i}` })
);

test('SYNONYM GUARD: transient and ephemeral never stand in for each other', () => {
  const transient = row('transient', { gloss: 'here for a short while and then gone' });
  const ephemeral = row('ephemeral', { gloss: 'here for a moment and then gone' });
  const pool = [transient, ephemeral, ...NINE_FILLERS];
  for (let seed = 0; seed < 60; seed++) {
    const forT = generateSuspects({ answer: transient, pool, rng: mulberry32(seed) });
    assert.ok(!forT.lineup.some((s) => s.word === 'ephemeral'), `seed ${seed}: ephemeral stood in for transient`);
    assert.equal(forT.count, 6, 'the lineup still fills to six (a safe distractor replaces the synonym)');
    const forE = generateSuspects({ answer: ephemeral, pool, rng: mulberry32(seed) });
    assert.ok(!forE.lineup.some((s) => s.word === 'transient'), `seed ${seed}: transient stood in for ephemeral`);
  }
});

test('SYNONYM GUARD: benevolent and altruistic never stand in for each other', () => {
  const benevolent = row('benevolent', { gloss: 'kind and generous, wanting good things for people' });
  const altruistic = row('altruistic', { gloss: "putting other people's good ahead of your own" });
  const pool = [benevolent, altruistic, ...TEN_FILLERS];
  for (let seed = 0; seed < 60; seed++) {
    const forB = generateSuspects({ answer: benevolent, pool, rng: mulberry32(seed) });
    assert.ok(!forB.lineup.some((s) => s.word === 'altruistic'), `seed ${seed}: altruistic stood in for benevolent`);
    assert.equal(forB.count, 6);
    const forA = generateSuspects({ answer: altruistic, pool, rng: mulberry32(seed) });
    assert.ok(!forA.lineup.some((s) => s.word === 'benevolent'), `seed ${seed}: benevolent stood in for altruistic`);
  }
});

test('SYNONYM GUARD is a HEURISTIC: an unrelated-gloss word of the same shape is still allowed', () => {
  // The guard keys on shared gloss vocabulary, so a genuinely-different word with
  // no content-word overlap is a fine distractor (it must be able to fill the lineup).
  const transient = row('transient', { gloss: 'here for a short while and then gone' });
  const pool = [transient, ...NINE_FILLERS];
  const { lineup, count } = generateSuspects({ answer: transient, pool, rng: mulberry32(1) });
  assert.equal(count, 6);
  assert.ok(lineup.some((s) => NINE_FILLERS.map((r) => r.word).includes(s.word)), 'fillers are allowed');
});

test('fallback tier 1: no exact-length distractors, widen to +-1', () => {
  const answer = row('brave'); // 5 letters
  // NO other 5-letter words; plenty of 4/6-letter same-POS words at +-1.
  const pool = [
    answer,
    ...['tall', 'slim', 'wide', 'cold', 'warm'].map((w) => row(w)), // 4
    ...['gloomy', 'strong'].map((w) => row(w)), // 6
  ];
  const { fallbackTier, count } = generateSuspects({ answer, pool, rng: mulberry32(2) });
  assert.equal(fallbackTier, 1);
  assert.equal(count, 6);
});

test('fallback tier 2: nothing within +-1, widen to +-2', () => {
  const answer = row('brave'); // 5
  const pool = [
    answer,
    ...['odd', 'shy', 'big', 'wee', 'coy'].map((w) => row(w)), // 3 (delta 2)
    ...['awkward', 'genuine'].map((w) => row(w)), // 7 (delta 2)
  ];
  const { fallbackTier, count } = generateSuspects({ answer, pool, rng: mulberry32(5) });
  assert.equal(fallbackTier, 2);
  assert.equal(count, 6);
});

test('reduced count 4: only 3 valid distractors → a 4-suspect lineup', () => {
  const answer = row('brave');
  const pool = richPool().slice(0, 4); // 'brave' + exactly 3 others
  const { count, lineup } = generateSuspects({ answer, pool, rng: mulberry32(9) });
  assert.equal(count, 4);
  assert.equal(lineup.length, 4);
  assert.equal(suspectsStanding(lineup, 0), 4);
  assert.equal(suspectsStanding(lineup, 2), 2, 'still narrows to 2 at the final stage');
});

test('reduced count 2: only 1 valid distractor → a 2-suspect lineup', () => {
  const answer = row('brave');
  const pool = [answer, row('clean')]; // one distractor only
  const { count, lineup } = generateSuspects({ answer, pool, rng: mulberry32(4) });
  assert.equal(count, 2);
  assert.equal(lineup.length, 2);
  assert.equal(suspectsStanding(lineup, 0), 2);
  assert.equal(suspectsStanding(lineup, 2), 2);
});

test('the narrowing schedule is 6 → 4 → 2 for a full lineup', () => {
  const answer = row('brave');
  const { lineup } = generateSuspects({ answer, pool: richPool(), rng: mulberry32(11) });
  assert.equal(suspectsStanding(lineup, 0), 6);
  assert.equal(suspectsStanding(lineup, 1), 4);
  assert.equal(suspectsStanding(lineup, 2), 2);
});

test('INVARIANT: the last surviving distractor differs from the answer at the first letter', () => {
  const answer = row('brave'); // first letter 'b'
  // A pool where MOST candidates share the answer's first letter ('b...'), with a
  // few that differ — the survivor must always be one that differs.
  const pool = [
    answer,
    ...['blaze', 'bliss', 'bloke', 'blush', 'brine'].map((w) => row(w)), // share 'b'
    ...['clean', 'dizzy', 'eager'].map((w) => row(w)), // differ
  ];
  for (let seed = 0; seed < 200; seed++) {
    const { lineup } = generateSuspects({ answer, pool, rng: mulberry32(seed) });
    const surv = survivorOf(lineup);
    assert.ok(surv, `seed ${seed}: a surviving distractor must exist`);
    assert.notEqual(surv.word[0], answer.word[0], `seed ${seed}: survivor ${surv.word} shares first letter`);
    // And the final two standing are exactly the answer + that survivor.
    const standing = lineup.filter((s) => s.eliminatedAtStage == null || s.eliminatedAtStage > 2);
    assert.equal(standing.length, 2, `seed ${seed}: final stage must leave 2`);
    assert.ok(standing.some((s) => s.isAnswer), `seed ${seed}: the answer always survives`);
  }
});

test('INVARIANT holds for the 2-suspect lineup too (the single distractor differs at [0])', () => {
  const answer = row('brave');
  const pool = [answer, row('clean')];
  for (let seed = 0; seed < 30; seed++) {
    const { lineup } = generateSuspects({ answer, pool, rng: mulberry32(seed) });
    const surv = survivorOf(lineup);
    assert.notEqual(surv.word[0], answer.word[0]);
  }
});

test('deterministic under a seeded RNG', () => {
  const answer = row('brave');
  const a = generateSuspects({ answer, pool: richPool(), rng: mulberry32(42) });
  const b = generateSuspects({ answer, pool: richPool(), rng: mulberry32(42) });
  assert.deepEqual(a.lineup, b.lineup);
});
