// navWipe.test.js — the pooled nav transition (the game-transition-screen look): one node set replayed, finite,
// transform/opacity only, will-change only while playing, the word written into POOLED letters, coalesced, and
// skipped under REDUCE MOTION.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWipe, playWipe, splitLines, _resetWipeClock, WIPE_MS, SPLIT_AT, WORDLESS_MS, COALESCE_MS, MAX_LETTERS } from './navWipe.js';
import { setReduceMotion } from './reduceMotion.js';

function fakeEl() {
  const el = { style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, textContent: '', hidden: false, anims: [] };
  el.animate = (frames, timing) => {
    const a = { frames, timing, cancelled: false, cancel() { this.cancelled = true; }, onfinish: null };
    el.anims.push(a);
    return a;
  };
  return el;
}
function copy() {
  return {
    slots: [fakeEl(), fakeEl()],
    lines: [fakeEl(), fakeEl()],
    letters: [0, 1].map(() => Array.from({ length: MAX_LETTERS }, fakeEl)),
  };
}
function parts() {
  return {
    root: fakeEl(), live: fakeEl(), stage: fakeEl(), halves: [fakeEl(), fakeEl()], flash: fakeEl(), slash: fakeEl(),
    copies: [copy(), copy(), copy()],
  };
}
const every = (p) => [
  p.root, p.live, p.stage, ...p.halves, p.flash, p.slash,
  ...p.copies.flatMap((c) => [...c.lines, ...c.letters.flat()]),
];
const allAnims = (p) => every(p).flatMap((e) => e.anims);
const text = (c, i) => c.letters[i].map((s) => s.textContent).join('');

test('replays the SAME registered nodes; finite; transform/opacity only; will-change cleared on finish', () => {
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  assert.equal(playWipe('Leaderboard', 'forward'), true);
  assert.equal(p.root.dataset.state, 'play');
  assert.equal(p.root.dataset.word, 'LEADERBOARD');
  assert.equal(p.halves[0].style.willChange, 'transform');
  const anims = allAnims(p);
  assert.ok(anims.length > 10);
  for (const a of anims) {
    const end = (a.timing.delay || 0) + a.timing.duration;
    assert.ok(end <= WIPE_MS, `ends inside the card (${end})`);
    assert.ok(!a.timing.iterations || Number.isFinite(a.timing.iterations), 'never infinite');
    for (const f of a.frames) for (const k of Object.keys(f)) assert.ok(['transform', 'opacity', 'offset', 'easing'].includes(k), `animates ${k}`);
  }
  // the clock (the top half) runs the full card; finishing it returns everything to rest
  const clock = p.halves[0].anims[0];
  assert.equal(clock.timing.duration, WIPE_MS);
  clock.onfinish();
  assert.equal(p.root.dataset.state, 'idle');
  for (const e of every(p)) assert.equal(e.style.willChange || '', '', 'will-change off at rest');
  off();
});

test('the card is long enough to read and the split comes after every entrance has landed', () => {
  assert.ok(WIPE_MS >= 450 && WIPE_MS <= 600, 'nav card 450–600ms');
  assert.ok(SPLIT_AT >= 280, 'never shorter than the intro punch');
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  playWipe('DAILY CONTRACTS');
  const entrances = [p.stage, ...p.copies[0].lines, ...p.copies[0].letters.flat()].flatMap((e) => e.anims);
  for (const a of entrances) assert.ok((a.timing.delay || 0) + a.timing.duration <= SPLIT_AT, 'settled before the knife');
  off();
});

test('the word is written into the POOLED letters of all three copies, two words → two lines', () => {
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  playWipe('DAILY BLITZ');
  for (const c of p.copies) {
    assert.equal(text(c, 0), 'DAILY');
    assert.equal(text(c, 1), 'BLITZ');
    assert.equal(c.slots[1].hidden, false);
  }
  _resetWipeClock();
  playWipe('STATS', 'back');
  for (const c of p.copies) {
    assert.equal(text(c, 0), 'STATS');
    assert.equal(text(c, 1), '');
    assert.equal(c.slots[1].hidden, true);
  }
  assert.equal(p.root.dataset.tone, 'pink');
  off();
});

test('a wordless card (a sheet closing) is a short cut + split', () => {
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  assert.equal(playWipe('', 'back'), true);
  assert.equal(p.halves[0].anims[0].timing.duration, WORDLESS_MS);
  assert.equal(p.copies[0].lines[0].anims.length, 0);
  off();
});

test('splitLines', () => {
  assert.deepEqual(splitLines(''), []);
  assert.deepEqual(splitLines("let's go!"), ["LET'S", 'GO!']);
  assert.deepEqual(splitLines('A B C'), ['A', 'B C']);
  assert.equal(splitLines('X'.repeat(40))[0].length, MAX_LETTERS);
});

test('a burst of navigations inside the coalesce window gets ONE card', () => {
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  assert.equal(playWipe('READY?'), true);
  assert.equal(playWipe('SQUAD UP'), false);
  assert.ok(COALESCE_MS >= 500);
  assert.equal(p.halves[0].anims.length, 1);
  off();
});

test('REDUCE MOTION skips the card entirely', () => {
  const p = parts();
  const off = registerWipe(p);
  _resetWipeClock();
  setReduceMotion(true);
  try {
    assert.equal(playWipe('STATS'), false);
    assert.equal(allAnims(p).length, 0);
    assert.notEqual(p.root.dataset.state, 'play');
  } finally {
    setReduceMotion(false);
    off();
  }
});

test('no overlay registered: a no-op, never a throw', () => {
  _resetWipeClock();
  assert.equal(playWipe('X'), false);
});
