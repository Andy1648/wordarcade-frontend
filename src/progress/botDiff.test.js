// botDiff.test.js — Andy oct8: "multiplayer bonuses with bots should scale with bot difficulty".
import test from 'node:test';
import assert from 'node:assert/strict';
import { hardestBot } from './botDiff.js';
import { winnerPayout, BOT_DIFF_BONUS, WINNER_FALLBACK } from './payout.js';
import { BOT_WIN_BY_DIFF, BOT_WIN } from './v3/econ.js';

const bots = (...d) => d.map((x, i) => ({ id: `b${i}`, isBot: true, botDifficulty: x, words: 9 }));

test('hardestBot picks the hardest bot; a bot with no difficulty is MEDIUM; no bots → null', () => {
  assert.equal(hardestBot(bots('easy', 'hard', 'medium')), 'hard');
  assert.equal(hardestBot(bots('easy', 'easy')), 'easy');
  assert.equal(hardestBot([{ id: 'x', isBot: true }]), 'medium');
  assert.equal(hardestBot([{ id: 'h', isBot: false }]), null);
});

test('a bots-only win pays by the hardest bot: easy +25% < medium +50% (= the old flat) < hard +100%', () => {
  const pay = (d, mode = 'word-bomb') => winnerPayout({ mode, iWon: true, gameTotal: 1000, myWords: 12, minutes: 2, rivals: bots(d), perkMult: 1 });
  assert.equal(BOT_DIFF_BONUS.medium, WINNER_FALLBACK.wordBomb, 'medium keeps the old Word Bomb +50%');
  assert.equal(pay('easy').wins, 250);
  assert.equal(pay('medium').wins, 500);
  assert.equal(pay('hard').wins, 1000);
  assert.equal(pay('hard').note, 'HARD BOTS: +100%');
  assert.ok(pay('easy', 'category-blitz').wins > 0, 'Blitz bot rooms now pay too (were 0)');
  // Word Race: bots are paced to you — the bonus follows YOUR speed (12 words in 0.2 min = 60 WPM → +50%)
  assert.equal(winnerPayout({ mode: 'word-race', iWon: true, gameTotal: 1000, myWords: 12, minutes: 0.2, rivals: bots('hard'), perkMult: 1 }).wins, 500);
  assert.equal(winnerPayout({ mode: 'word-race', iWon: true, gameTotal: 1000, myWords: 25, minutes: 0.1, rivals: bots('hard'), perkMult: 1 }).wins, 750, 'capped at +75% — a human win (+100%) always pays more');
});

test('the 5-word floor still holds in a bot room', () => {
  const p = winnerPayout({ mode: 'word-bomb', iWon: true, gameTotal: 1000, myWords: 2, rivals: bots('hard'), perkMult: 1 });
  assert.equal(p.reason, 'my-words');
});

test('season 2 gems: a bot win pays 8 / 18 / 30 by the hardest bot; MEDIUM is the old flat', () => {
  assert.deepEqual({ ...BOT_WIN_BY_DIFF }, { easy: 8, medium: 18, hard: 30 });
  assert.equal(BOT_WIN_BY_DIFF.medium, BOT_WIN);
});
