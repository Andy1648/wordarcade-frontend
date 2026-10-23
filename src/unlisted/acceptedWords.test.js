// acceptedWords.test.js — THE UNLISTED door (oct20, Andy "make accepted words count (not just randomly typing) … ensure
// 'newgrounds' has an opportunity … make it make sense - no matter the mode"): what each ACCEPTED word finds, that the
// riddle words can actually be accepted, and that typing alone finds nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judgeAcceptedWord, noteAcceptedWord, OG_WORD, MIDAS_ODDS, _typewriterRun } from './acceptedWords.js';
import { createTypewriterRun, TYPEWRITER_IDLE_MS, WISH_KEY } from './gearFinds.js';
import { UNLISTED_GEARS } from './unlisted.js';

const mem = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};
const NOON = new Date(2026, 9, 20, 12, 0, 0).getTime();
const never = () => 1; // MIDAS off
const judge = (w, o = {}) => judgeAcceptedWord(w, { now: NOON, rng: never, storage: mem(), ...o });

test('O.G.: the accepted word NEWGROUNDS — any case — and nothing else', () => {
  assert.equal(OG_WORD, 'newgrounds');
  assert.deepEqual(judge('NEWGROUNDS'), ['mk-ul-og']);
  assert.deepEqual(judge('newground'), []);
});

test('MIRROR: a 7+ letter palindrome; LEVEL / RADAR do nothing', () => {
  for (const w of ['racecar', 'rotator', 'reviver', 'deified', 'repaper']) assert.ok(judge(w).includes('mk-ul-mirror'), w);
  for (const w of ['level', 'radar', 'kayak', 'redder']) assert.deepEqual(judge(w), [], w);
});

test('TRIPLE DOUBLE: three separate double letters in the accepted word', () => {
  for (const w of ['bookkeeper', 'committee', 'keenness', 'mississippi']) assert.ok(judge(w).includes('mk-ul-tripledouble'), w);
  assert.deepEqual(judge('coffee'), []);
});

test('MIDAS: 1 accepted word in 750, any mode', () => {
  assert.equal(MIDAS_ODDS, 750);
  assert.deepEqual(judge('planet', { rng: () => 0 }), ['mk-ul-midas']);
  assert.deepEqual(judge('planet', { rng: () => 1 / 750 }), []);
});

test('WISHBONE: a word at 11:11 AM, then one at 11:11 PM, the same day', () => {
  const s = mem();
  const at = (h) => new Date(2026, 9, 20, h, 11, 5).getTime();
  assert.deepEqual(judgeAcceptedWord('planet', { now: at(11), rng: never, storage: s }), []);
  assert.ok(s.getItem(WISH_KEY));
  assert.deepEqual(judgeAcceptedWord('planet', { now: at(23), rng: never, storage: s }), ['mk-ul-wishbone']);
});

test('TYPEWRITER: 50 words of 5+ letters in a row; a 3-minute gap starts it over', () => {
  const run = createTypewriterRun();
  let t = NOON;
  let hit = false;
  for (let i = 0; i < 49; i += 1) hit = judge('planets', { run, now: (t += 5000) }).includes('mk-ul-typewriter') || hit;
  assert.equal(hit, false);
  assert.equal(run.count(), 49);
  // walked away for longer than TYPEWRITER_IDLE_MS: this word is the first of a new run
  assert.deepEqual(judge('planets', { run, now: (t += TYPEWRITER_IDLE_MS + 1) }), []);
  assert.equal(run.count(), 1);
  for (let i = 0; i < 48; i += 1) judge('planets', { run, now: (t += 5000) });
  assert.ok(judge('planets', { run, now: (t += 5000) }).includes('mk-ul-typewriter'), 'the 50th in a row');
});

test('junk is never a find: empty, spaces, digits, mixed', () => {
  for (const w of ['', '   ', 'race car', 'newgrounds1', null, undefined]) assert.deepEqual(judgeAcceptedWord(w, { rng: () => 0, storage: mem() }), []);
});

test('the live door reveals what it found and never throws', () => {
  const seen = [];
  const reveal = (id, w) => seen.push([id, w]);
  _typewriterRun.reset();
  const before = globalThis.window;
  globalThis.window = { __TAW_RARE_POP: 'off', addEventListener() {} };
  try {
    assert.deepEqual(noteAcceptedWord('NewGrounds', { mode: 'chain', reveal, now: NOON }), ['mk-ul-og']);
    assert.deepEqual(seen, [['mk-ul-og', 'newgrounds']]);
    assert.deepEqual(noteAcceptedWord('x', { reveal: () => { throw new Error('boom'); }, now: NOON }), []);
  } finally {
    if (before === undefined) delete globalThis.window;
    else globalThis.window = before;
  }
});

// ------------------------------------------------------------------------------- reachability (Andy: "ensure 'newgrounds' has an opportunity")
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const SOLO_ACCEPT = new Set([
  ...read('../solo/words.recall.txt').split(' '),
  ...read('../solo/words.accept.txt').split(' '),
  ...read('../solo/words.common.txt').split(/\s+/).map((w) => w.toLowerCase()),
]);

test('every word a riddle points at can be ACCEPTED in CHAIN / FUSE on the first run', () => {
  for (const w of [OG_WORD, 'racecar', 'reviver', 'deified', 'bookkeeper', 'committees', 'successfully']) {
    assert.ok(SOLO_ACCEPT.has(w), `${w} is not in the first-run solo accept set`);
  }
});

test('every riddle is one short, plain line (no gear says "type" — only accepted words count)', () => {
  for (const g of UNLISTED_GEARS) {
    assert.ok(g.riddle.length <= 48, g.id);
    assert.equal(g.riddle, g.riddle.toUpperCase());
  }
});
