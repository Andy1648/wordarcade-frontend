// winnerPayout.test.js — H4 (Andy oct3): MULTIPLAYER WINNER PAYS A TON, and cannot be farmed.
//
// winnerPayout() is the ONE pure function every multiplayer mode (Word Bomb, Category Blitz,
// WORD RACE) pays its winner through. Spec: claude/finetune/h4-winner-spec.md, version (c) HYBRID:
//   bonus = MATCH_MULT[mode] × gameTotal × (counted words / my words)
//   counted words = min(my words, CONTEST × best human rival's words, PACE[mode] × minutes)
// gated on facts the client can SEE: I won, I played ≥ MIN_WINNER_WORDS, and at least one
// non-bot rival who is not another tab of this browser played ≥ MIN_RIVAL_WORDS. A failed gate
// falls back to TODAY's rule for that mode (Word Bomb +50%, Blitz / RACE nothing) with a reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  winnerPayout, WINNER_MATCH, WINNER_GATES, WINNER_FALLBACK, winnerMatchMult,
  beginPayoutLedger, noteRoundBonus, readPayoutLedger, clearPayoutLedger,
} from './payout.js';

const human = (id, words) => ({ id, words, isBot: false });
const bot = (id, words) => ({ id, words, isBot: true });
// A normal, honest 2.5-minute Word Bomb 1v1: I played 15, my rival 14.
const honestWb = { mode: 'wordBomb', iWon: true, gameTotal: 300, myWords: 15, minutes: 2.5, rivals: [human('r', 14)] };

test('the table: one source for every mode, every multiplier clearly above the old +50%', () => {
  for (const k of ['wordBomb', 'blitz', 'wordRace']) {
    assert.ok(WINNER_MATCH[k], `${k} has a match tier`);
    assert.ok(WINNER_MATCH[k].mult >= 1, `${k} pays at least +100% (the old rule was +50%)`);
    assert.ok(WINNER_MATCH[k].pace > 0, `${k} has a pace ceiling`);
    // the copy quotes the TOTAL multiplier (your game ×N), from the same table
    assert.equal(winnerMatchMult(k), 1 + WINNER_MATCH[k].mult);
  }
  assert.equal(WINNER_FALLBACK.wordBomb, 0.5, 'Word Bomb keeps today\'s +50% when a gate fails');
  assert.equal(WINNER_FALLBACK.blitz, 0);
  assert.equal(WINNER_FALLBACK.wordRace, 0);
  assert.ok(WINNER_GATES.minWinnerWords >= 3 && WINNER_GATES.minRivalWords >= 3);
});

test('an honest win pays the full match multiplier on my own game total', () => {
  const p = winnerPayout(honestWb);
  assert.equal(p.tier, 'match');
  assert.equal(p.reason, null);
  assert.equal(p.wins, Math.round(300 * WINNER_MATCH.wordBomb.mult));
  assert.equal(p.mult, 1 + WINNER_MATCH.wordBomb.mult);
  assert.equal(p.capped, null);
});

test('kebab ids work too (the App sends gameType)', () => {
  assert.equal(winnerPayout({ ...honestWb, mode: 'word-bomb' }).wins, winnerPayout(honestWb).wins);
  assert.equal(winnerPayout({ ...honestWb, mode: 'category-blitz' }).tier, 'match');
  assert.equal(winnerPayout({ ...honestWb, mode: 'word-race' }).tier, 'match');
});

test('losing pays nothing; a zero game pays nothing', () => {
  assert.equal(winnerPayout({ ...honestWb, iWon: false }).wins, 0);
  assert.equal(winnerPayout({ ...honestWb, iWon: false }).tier, 'none');
  assert.equal(winnerPayout({ ...honestWb, gameTotal: 0 }).wins, 0);
});

test('BOT ROOM: bots never qualify as a rival -> paid by the hardest bot (Andy oct8), MEDIUM = the old +50%', () => {
  const p = winnerPayout({ ...honestWb, rivals: [bot('b1', 30), bot('b2', 30)] });
  assert.equal(p.tier, 'bots');
  assert.equal(p.reason, 'bots-medium', 'a bot without a difficulty is MEDIUM, the server default');
  assert.equal(p.wins, Math.round(300 * 0.5), 'Word Bomb vs medium bots is exactly the old +50%');
  assert.equal(p.mult, 1.5);
  const blitz = winnerPayout({ ...honestWb, mode: 'blitz', rivals: [bot('b', 9)] });
  assert.equal(blitz.wins, Math.round(300 * 0.5), 'Blitz vs a medium bot now pays +50% (was nothing)');
  assert.equal(winnerPayout({ ...honestWb, mode: 'wordRace', minutes: null, rivals: [bot('b', 25)] }).reason, 'bots', 'a race with no clock has no speed to pay');
  assert.equal(winnerPayout({ ...honestWb, mode: 'wordRace', rivals: [bot('b', 25)] }).reason, 'bots-race');
});

test('AFK DUMMY TAB: a rival who played under MIN_RIVAL_WORDS does not unlock the match bonus', () => {
  const p = winnerPayout({ ...honestWb, rivals: [human('dummy', WINNER_GATES.minRivalWords - 1)] });
  assert.equal(p.tier, 'fallback');
  assert.equal(p.reason, 'rival-words');
});

test('SAME BROWSER: a rival seat registered by another tab of this browser is me, not a rival', () => {
  const p = winnerPayout({ ...honestWb, selfIds: ['r'] });
  assert.equal(p.tier, 'fallback');
  assert.equal(p.reason, 'self');
  // ...but a genuine rival in the same room still counts
  const q = winnerPayout({ ...honestWb, selfIds: ['r'], rivals: [human('r', 14), human('x', 12)] });
  assert.equal(q.tier, 'match');
});

test('VERY SHORT GAME: the winner must have played MIN_WINNER_WORDS', () => {
  const p = winnerPayout({ ...honestWb, myWords: WINNER_GATES.minWinnerWords - 1, gameTotal: 40 });
  assert.equal(p.tier, 'fallback');
  assert.equal(p.reason, 'my-words');
  assert.equal(p.wins, 20);
});

test('CONTEST CAP: the bonus counts at most CONTEST × the best rival\'s words', () => {
  // I played 30, the dummy played 3 (just over the gate): only 2×3 = 6 of my 30 words count.
  const p = winnerPayout({ ...honestWb, myWords: 30, gameTotal: 600, minutes: 10, rivals: [human('d', 3)] });
  assert.equal(p.tier, 'match');
  assert.equal(p.capped, 'rival');
  const share = (WINNER_GATES.contest * 3) / 30;
  assert.equal(p.wins, Math.round(600 * WINNER_MATCH.wordBomb.mult * share));
  // a close honest race (rival played over half of my words) is never capped
  assert.equal(winnerPayout({ ...honestWb, myWords: 20, rivals: [human('r', 10)] }).capped, null);
});

test('PACE CAP: words typed faster than a strong honest player do not grow the bonus', () => {
  const pace = WINNER_MATCH.wordBomb.pace;
  // 40 words in 1 minute of self-play: only pace × 1 count.
  const p = winnerPayout({ ...honestWb, myWords: 40, gameTotal: 800, minutes: 1, rivals: [human('r', 40)] });
  assert.equal(p.capped, 'pace');
  assert.equal(p.wins, Math.round(800 * WINNER_MATCH.wordBomb.mult * (pace / 40)));
  // an unknown duration does not cap (it never punishes a clock we failed to stamp)
  assert.equal(winnerPayout({ ...honestWb, minutes: null }).capped, null);
});

test('a capped match bonus never pays LESS than the mode\'s fallback', () => {
  const p = winnerPayout({ ...honestWb, myWords: 100, gameTotal: 1000, minutes: 10, rivals: [human('d', 3)] });
  assert.ok(p.wins >= Math.round(1000 * WINNER_FALLBACK.wordBomb));
  assert.ok(p.mult >= 1 + WINNER_FALLBACK.wordBomb);
});

test('FORFEIT: a rival who LEFT after playing still counts (a rage-quit is a real win)', () => {
  const p = winnerPayout({ ...honestWb, mode: 'wordRace', myWords: 12, gameTotal: 120, minutes: 0.8, rivals: [{ id: 'r', words: 8, isBot: false, left: true }] });
  assert.equal(p.tier, 'match');
});

test('RE-DELIVERED game_over: the ledger note pays once (noteRoundBonus dedupe still holds)', () => {
  beginPayoutLedger('category-blitz');
  const p = winnerPayout(honestWb);
  assert.equal(noteRoundBonus({ key: 'winner', label: 'WINNER BONUS', mult: p.mult, wins: p.wins, note: p.note }), true);
  assert.equal(noteRoundBonus({ key: 'winner', label: 'WINNER BONUS', mult: p.mult, wins: p.wins, note: p.note }), false);
  const led = readPayoutLedger();
  assert.equal(led.bonuses.length, 1);
  assert.equal(led.bonuses[0].wins, p.wins);
  clearPayoutLedger();
});

test('every fallback carries a human-readable note for the receipt', () => {
  for (const reason of ['bots', 'self', 'rival-words', 'my-words']) {
    const args = {
      bots: { mode: 'wordRace', minutes: null, rivals: [bot('b', 9)] },
      self: { selfIds: ['r'] },
      'rival-words': { rivals: [human('r', 1)] },
      'my-words': { myWords: 2 },
    }[reason];
    const p = winnerPayout({ ...honestWb, ...args });
    assert.equal(p.reason, reason);
    assert.match(p.note, /[A-Z]/, `${reason} has a note`);
    assert.ok(p.note.length <= 40, `${reason} note fits a receipt row: "${p.note}"`);
  }
});

test('garbage in never throws and never pays', () => {
  assert.equal(winnerPayout().wins, 0);
  assert.equal(winnerPayout({ mode: 'chain', iWon: true, gameTotal: 100, myWords: 10, rivals: [human('r', 10)] }).wins, 0);
  assert.equal(winnerPayout({ ...honestWb, gameTotal: NaN }).wins, 0);
  assert.equal(winnerPayout({ ...honestWb, rivals: null }).reason, 'bots');
});
