// gameXp.test.js — GAME XP in season 2 (Andy oct21: "fine with games giving xp … start noticeably less than spamming
// keys on the main menu"; was gameNoXp.test.js, v4 "games pay wins only"). A TYPED game letter still pays nothing —
// only an ACCEPTED word moves the bar, at GAME_WORD_XP_SHARE menu keys a letter, through the same XP-per-key stack the
// menu pays, with no mode multiplier — and the same word still banks its WINS. A MENU key pays the full 1 × 2^T × 3^R.
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
const G = await import('../gameXp.js');

const bar = () => {
  const p = X.loadProgress();
  return [p.level, p.intoLevel];
};

test('season 2: typed game letters pay 0 XP — only the accepted word moves the bar, at 0.2 menu keys a letter', () => {
  assert.equal(SEASON2, true);
  assert.equal(LX.GAME_WORD_XP_SHARE, 0.2);
  localStorage.clear();
  LX.resetLetterXp();
  G.resetGameXp();
  X.saveKeyTier(3);
  X.saveRebirths(1);
  X.saveProgress({ level: 7, frac: 0.4 });
  const perKey = LX.letterXpNow(); // T3 R1 = 24 a menu key
  const wins0 = W.getWins();
  const mark = G.gameXpMark();
  let paid = 0;
  for (const mode of ['word-bomb', 'category-blitz', 'chain', 'fuse', 'sat-rush', 'word-race']) {
    const before = X.loadProgress();
    // the letters as they are typed (the controlled-input path every game uses) pay nothing …
    LX.noteTypedLetters('', 'q', mode);
    LX.noteTypedLetters('q', 'qu', mode);
    LX.noteLetters(5, mode);
    LX.flushLetterXp();
    assert.equal(LX.creditLetterXp(9, { mode }), null, `${mode}: a direct typed-letter credit pays nothing`);
    const mid = X.loadProgress();
    assert.equal(mid.totalXp ?? mid.intoLevel, before.totalXp ?? before.intoLevel, `${mode}: typing alone did not move the bar`);
    // … the accepted word (the one door every mode's word passes) pays 5 letters × 0.4 × the menu key — NO mode mult
    W.awardWordXp({ mode, wordLength: 5, word: 'quiet' });
    W.bankWordWins({ mode, wordLength: 5, prevWords: 3, nowWords: 4, prevWeight: 3, nowWeight: 4 });
    const want = X.roundWordXp(5 * 0.2 * perKey);
    const got = G.gameXpSince(mark).xp - paid;
    assert.equal(got, want, `${mode}: one 5-letter word = 1 menu key (${want} XP)`);
    paid += got;
  }
  assert.equal(paid, 6 * X.roundWordXp(1 * perKey), 'six modes, the same XP each');
  assert.ok(W.getWins() > wins0, 'the same words still bank WINS');
  assert.ok(paid < 6 * 5 * perKey, 'a game word pays less than typing its letters on the menu');
});

test('season 2: menu words never take the game path', () => {
  G.resetGameXp();
  const mark = G.gameXpMark();
  assert.equal(LX.creditAcceptedWordLetters(5, 'menu'), null);
  assert.equal(G.gameXpSince(mark).xp, 0);
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
