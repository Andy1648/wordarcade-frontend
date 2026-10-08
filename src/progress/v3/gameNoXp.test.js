// gameNoXp.test.js — PROGRESSION v4 "SIMPLE" (Andy Oct 7 23:20): "games pay wins only". With SEASON2 on, a game can
// never move the level bar — not the typed letters (letterXp noteLetters / flush / creditLetterXp), not the accepted
// word (wins.awardWordXp, which used to top its letters up) — while the same word still banks its WINS. A MENU key is
// the only XP source and pays the full 1 × 2^T × 3^R.
// The flag is fixed at module load, so it is turned on BEFORE anything is imported (node --test: one process a file).
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
globalThis.location = { search: '?season2=1' };

const { SEASON2 } = await import('../season.js');
await import('./install.js');
const X = await import('../xp.js');
const W = await import('../wins.js');
const LX = await import('../letterXp.js');

const bar = () => {
  const p = X.loadProgress();
  return [p.level, p.intoLevel];
};

test('season 2: a game word adds 0 XP — typed letters, the flush and the accepted word leave the bar where it was', () => {
  assert.equal(SEASON2, true);
  localStorage.clear();
  LX.resetLetterXp();
  X.saveKeyTier(3);
  X.saveRebirths(1);
  X.saveProgress({ level: 7, frac: 0.4 });
  const before = bar();
  const wins0 = W.getWins();
  for (const mode of ['word-bomb', 'category-blitz', 'chain', 'fuse', 'sat-rush', 'word-race']) {
    // the letters as they are typed (the controlled-input path every game uses) …
    LX.noteTypedLetters('', 'q', mode);
    LX.noteTypedLetters('q', 'qu', mode);
    LX.noteLetters(5, mode);
    LX.flushLetterXp();
    assert.equal(LX.creditLetterXp(9, { mode }), null, `${mode}: a direct letter credit pays nothing`);
    assert.equal(LX.creditAcceptedWordLetters(5, mode), null, `${mode}: no accepted-word top-up`);
    // … and the accepted word (the one door every mode's word passes)
    W.awardWordXp({ mode, wordLength: 5, word: 'quiet' });
    W.bankWordWins({ mode, wordLength: 5, prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 4 });
    assert.deepEqual(bar(), before, `${mode}: the level bar did not move`);
  }
  assert.ok(W.getWins() > wins0, 'the same words still bank WINS');
});

test('season 2: a MENU key is the only XP — the full 1 × 2^T × 3^R, and it moves the bar', () => {
  localStorage.clear();
  X.saveKeyTier(3);
  X.saveRebirths(1);
  const per = X.xpPerInput({ mode: 'menu' });
  assert.equal(per, 2 ** 3 * 3, 'T3 R1 = 24 a key');
  assert.equal(per, LX.letterXpNow(), 'the rate line (+N XP / KEY) reads the same number');
  const p0 = X.loadProgress();
  const r = X.creditXp(p0, per);
  assert.ok(r.state.level > p0.level || r.state.intoLevel > p0.intoLevel, 'a menu key fills the bar');
});
