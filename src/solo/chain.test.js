// chain.test.js — pins CHAIN's fitted numbers and the multiplier/reroute rules.
// These constants came from simulation fits + adversarial attacks; the tests are the
// guard rails that stop a future edit from quietly breaking them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  chainT,
  heatMul,
  chainScore,
  CHAIN_OPENERS,
  CHAIN_TMAX_FLOOR,
  createChainEngine,
} from './chain.js';
import { mulberry32 } from './shared.js';

// ---- the time curve ----
test('chainT(0) === 18000 (word 1 gets the full 18s)', () => {
  assert.equal(chainT(0), 18000);
});

test('chainT is monotonically decreasing', () => {
  let prev = Infinity;
  for (let k = 0; k <= 200; k++) {
    const v = chainT(k);
    assert.ok(v < prev, `chainT(${k}) = ${v} not < previous ${prev}`);
    prev = v;
  }
});

test('chainT(1000) is within 1ms of the 4500 floor', () => {
  assert.ok(Math.abs(chainT(1000) - CHAIN_TMAX_FLOOR) < 1);
});

// ---- heat ----
test('heatMul(0) === 1 (no heat on a fresh letter)', () => {
  assert.equal(heatMul(0), 1);
});

test('heatMul(16) clamps to 0.05 (the 0.95 cap)', () => {
  assert.ok(Math.abs(heatMul(16) - 0.05) < 1e-9);
});

test('heatMul never goes negative, however hot', () => {
  for (let n = 0; n <= 500; n++) assert.ok(heatMul(n) >= 0.05 - 1e-9);
});

// ---- score ----
test('chainScore = round(10 * length * multiplier)', () => {
  assert.equal(chainScore(3, 1.0), 30);
  assert.equal(chainScore(5, 2.0), 100);
  assert.equal(chainScore(4, 1.25), 50);
  assert.equal(chainScore(7, 2.5), 175);
});

// ---- openers ----
test('opener set is exactly the 18 verified letters', () => {
  assert.equal(CHAIN_OPENERS, 'abcdefghilmnoprstw');
  assert.equal(CHAIN_OPENERS.length, 18);
  assert.equal(new Set(CHAIN_OPENERS).size, 18);
});

// ---- a synthetic dictionary so dead-ends never fire unless we force them ----
// Every letter gets 3 "common" continuations (so supply >= 3 ⇒ no reroute) plus any
// chain words we add. `hollow` letters get ZERO commons, so ending on them is a dead end.
function synth({ hollow = '' } = {}) {
  const accept = new Set();
  const topCommon = [];
  for (const L of 'abcdefghijklmnopqrstuvwxyz') {
    if (hollow.includes(L)) continue;
    for (const s of ['qx', 'qy', 'qz']) {
      const w = L + s;
      accept.add(w);
      topCommon.push(w);
    }
  }
  return { accept, topCommon };
}

test('multiplier rises 0.25 per fresh end-letter and caps at 2.5', () => {
  const { accept, topCommon } = synth();
  // a → b → c → d → e → f → g → h : seven fresh end-letters.
  const chain = ['aab', 'bbc', 'ccd', 'dde', 'eef', 'ffg', 'ggh'];
  for (const w of chain) accept.add(w);
  const eng = createChainEngine({ accept, topCommon, rng: () => 0 }); // opener 'a'
  assert.equal(eng.state.requiredLetter, 'a');
  const seen = [];
  for (const w of chain) seen.push(eng.submit(w).multiplier);
  assert.deepEqual(seen, [1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.5]);
});

test('multiplier resets to 1.0 on a repeat end-letter', () => {
  const { accept, topCommon } = synth();
  for (const w of ['aab', 'bbc', 'ccb']) accept.add(w); // ...c then back to ending on b
  const eng = createChainEngine({ accept, topCommon, rng: () => 0 });
  eng.submit('aab'); // end b (fresh) → 1.25
  eng.submit('bbc'); // end c (fresh) → 1.5
  const r = eng.submit('ccb'); // end b (repeat) → reset
  assert.equal(r.multiplier, 1.0);
});

test('multiplier resets to 1.0 on a rejection', () => {
  const { accept, topCommon } = synth();
  for (const w of ['aab', 'bbc']) accept.add(w);
  const eng = createChainEngine({ accept, topCommon, rng: () => 0 });
  eng.submit('aab');
  eng.submit('bbc'); // mult 1.5, required now 'c'
  const r = eng.submit('zzz'); // wrong start → reject
  assert.equal(r.ok, false);
  assert.equal(eng.state.multiplier, 1.0);
});

test('reroute targets the MAX-endCount opener (never random) and resets the multiplier', () => {
  // 's' is a fine letter (has commons); 'q' is hollow (a dead end). We end on 's' a few
  // times to make it the hottest opener, then get forced onto 'q' → reroute must land on 's'.
  const { accept, topCommon } = synth({ hollow: 'q' });
  for (const w of ['aas', 'sus', 'sos', 'ssq']) accept.add(w);
  const eng = createChainEngine({ accept, topCommon, rng: () => 0 }); // opener 'a'
  eng.submit('aas'); // end s (endCount s = 1)
  eng.submit('sus'); // end s (2)
  eng.submit('sos'); // end s (3), mult building on repeats resets each time anyway
  const before = eng.endCountOf('s');
  assert.equal(before, 3);
  const r = eng.submit('ssq'); // end q → dead end → reroute to max-endCount opener = 's'
  assert.equal(r.ok, true);
  assert.equal(r.rerouted, true);
  assert.equal(eng.state.requiredLetter, 's');
  assert.equal(eng.endCountOf('s'), 4); // reroute bumps the target's heat
  assert.equal(eng.state.multiplier, 1.0);
});

test('supply readout: DEAD END / FEW LEFT / plenty', () => {
  const { accept, topCommon } = synth({ hollow: 'q' }); // 'q' hollow, everything else has 3
  // Give 'z' 40 commons so it lands in the "plenty" band (>= 35).
  for (let i = 0; i < 40; i++) topCommon.push('z' + String(i).padStart(2, '0'));
  const eng = createChainEngine({ accept, topCommon, rng: () => 0 });
  assert.equal(eng.supply('q').count, 0);
  assert.equal(eng.supply('q').label, 'DEAD END');
  assert.equal(eng.supply('a').count, 3); // 3 commons ⇒ FEW LEFT
  assert.ok(eng.supply('a').label.startsWith('FEW LEFT'));
  assert.equal(eng.supply('z').count, 43); // 3 synth commons + 40 added
  assert.equal(eng.supply('z').label, '43 common words start with Z');
});

// ---- rejection vocabulary ----
test('validate returns the right reject codes, incl. ALREADY USED', () => {
  const { accept, topCommon } = synth();
  accept.add('aba'); // starts 'a', ends 'a' — lets us loop back to a required 'a'
  const eng = createChainEngine({ accept, topCommon, rng: () => 0 }); // required 'a'
  assert.equal(eng.validate('aa'), 'too_short');
  assert.equal(eng.validate('bqx'), 'bad_start'); // valid word, wrong start letter
  assert.equal(eng.validate('azz'), 'not_in_list'); // right start, 3 chars, not in accept
  eng.submit('aba'); // end 'a' ⇒ required is 'a' again, and 'aba' is now used
  assert.equal(eng.validate('aba'), 'already_used');
});

// ============================================================================
// SIMULATION GUARDS — a headless model of players, ~500 seeded runs each.
//
// These validate that the FITTED CONSTANTS above produce the intended difficulty
// and that HEAT actually defeats the two known exploits. The PLAYER MODELS here
// (vocabulary, recall speed) represent player skill and are ours to choose; the
// GAME CONSTANTS they run against are fixed. If a future edit weakens heat or the
// time curve, these bands break — that's the point.
// ============================================================================
const _recall = readFileSync(new URL('./words.recall.txt', import.meta.url), 'utf8').split(' ');
const _accept = new Set(_recall);
for (const w of readFileSync(new URL('./words.accept.txt', import.meta.url), 'utf8').split(' ')) _accept.add(w);
const _topCommon = _recall.slice(0, 3000);

function byFirst(words, sort) {
  const m = new Map();
  for (const w of words) {
    const c = w[0];
    let a = m.get(c);
    if (!a) m.set(c, (a = []));
    a.push(w);
  }
  if (sort) for (const a of m.values()) a.sort(sort);
  return m;
}
const _median = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

// A median human: knows the ~9000 most common words, recall time is stochastic and
// slower when few words come to mind, and they chase the multiplier (fresh end-letters).
const _humanVocabByFirst = byFirst(_recall.slice(0, 9000));
function runHuman(rng) {
  const eng = createChainEngine({ accept: _accept, topCommon: _topCommon, rng });
  let links = 0;
  for (let g = 0; g < 5000; g++) {
    const pool = _humanVocabByFirst.get(eng.state.requiredLetter) || [];
    const cands = [];
    for (const w of pool) {
      if (!eng.state.used.has(w)) cands.push(w);
      if (cands.length >= 30) break;
    }
    if (cands.length === 0) break; // can't think of a word
    const word =
      cands.find((w) => !eng.state.endedLetters.has(w[w.length - 1])) ||
      cands[Math.floor(rng() * cands.length)];
    const scarcity = cands.length < 6 ? (6 - cands.length) * 300 : 0;
    const produce = 1600 + rng() * 4600 + 300 * word.length + scarcity; // ~1.6-6.2s recall + typing
    if (produce > eng.currentTMax()) break; // too slow under the shrinking clock
    if (!eng.submit(word).ok) break;
    links += 1;
  }
  return links;
}

// The two exploit bots: full vocabulary, deterministic ~2.2s/word masher speed.
const _acceptArr = [...(_accept)];
const _shortestByFirst = byFirst(_acceptArr, (a, b) => a.length - b.length || (a < b ? -1 : 1));
const _endSByFirst = byFirst(
  _acceptArr.filter((w) => w[w.length - 1] === 's'),
  (a, b) => a.length - b.length
);
const BOT_REACT = 1500;
const BOT_PER_CHAR = 220;
function runBot(rng, endOnS) {
  const eng = createChainEngine({ accept: _accept, topCommon: _topCommon, rng });
  let links = 0;
  for (let g = 0; g < 20000; g++) {
    const arr = (endOnS ? _endSByFirst : _shortestByFirst).get(eng.state.requiredLetter) || [];
    const word = arr.find((w) => !eng.state.used.has(w));
    if (!word) break;
    if (BOT_REACT + BOT_PER_CHAR * word.length > eng.currentTMax()) break;
    if (!eng.submit(word).ok) break;
    links += 1;
  }
  return links;
}

function runMany(fn, arg, runs = 500, seed = 999) {
  const rng = mulberry32(seed);
  const out = [];
  for (let i = 0; i < runs; i++) out.push(fn(rng, arg));
  return out;
}

test('SIM: median player lands 14-20 links (target 17)', () => {
  const med = _median(runMany(runHuman));
  assert.ok(med >= 14 && med <= 20, `median links ${med} outside 14-20`);
});

test('SIM: a shortest-word bot never exceeds 60 links (heat caps it; 143 before heat)', () => {
  const runs = runMany((rng) => runBot(rng, false));
  const worst = Math.max(...runs);
  assert.ok(worst <= 60, `shortest-word bot reached ${worst} links (> 60 — heat broken?)`);
});

test('SIM: a memorised s→s bank bot never exceeds 30 links (heat caps it; 86 before heat)', () => {
  const runs = runMany((rng) => runBot(rng, true));
  const worst = Math.max(...runs);
  assert.ok(worst <= 30, `s→s bot reached ${worst} links (> 30 — heat broken?)`);
});

// The death blame line must BRANCH on the killed letter's real state (fix/logic-pass #7): a
// plain timeout on a healthy letter is NOT "nothing left starting with X".
test('timeout snapshots killedWasDeadEnd: false for a healthy letter, true for a genuine dead end', () => {
  const healthy = synth(); // opener 'a' has 3 common continuations
  const engH = createChainEngine({ accept: healthy.accept, topCommon: healthy.topCommon, rng: () => 0 });
  assert.equal(engH.state.requiredLetter, 'a');
  engH.timeout();
  assert.equal(engH.state.killedLetter, 'a');
  assert.equal(engH.state.killedWasDeadEnd, false); // → "RAN OUT OF TIME ON A"

  const dead = synth({ hollow: 'a' }); // 'a' has ZERO common continuations
  const engD = createChainEngine({ accept: dead.accept, topCommon: dead.topCommon, rng: () => 0 });
  assert.equal(engD.state.requiredLetter, 'a');
  engD.timeout();
  assert.equal(engD.state.killedWasDeadEnd, true); // → "nothing left starting with A"
});
