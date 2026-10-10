// marksV2.test.js — MARKS v2 (Andy oct5): the stats reach the payout (BASE 10 → 10 + N on wins AND letter XP, the
// OVERDRIVE length), the LEGENDARY+ pity in 125 + the ladder, the skip setting, the INDEX entry + rewards.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLL_STATE_KEY, freshState, roll, pityLeft, pityLadder, PITY, getSkipBelow, setSkipBelow, shouldSkipReveal,
  indexEntry, loadRollState, statOf, ROLL_MARKS, INDEX_NEW_WORDS, INDEX_COMPLETE_WORDS, completedTiers, normalize,
  markWinsMult, LEGENDARY_PITY_HARD, indexRewardWins, milestoneWins,
} from './markRolls.js';
import { perWordRateNow, wordWinsBase } from './wins.js';
import { levelXpPerLetter, xpPerWord } from './xp.js';
import { letterXpNow } from './letterXp.js';
import { overdriveLengthMs } from './overdrive.js';
import { MARKS_EQUIPPED_KEY } from './marks.js';

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn(map);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${msg || ''} ${a} vs ${b}`);
const owning = (id, extra = {}) => JSON.stringify({ v: 2, starter: true, marks: { [id]: { n: 1 } }, ...extra });

test('+N BASE WINS/WORD reaches the payout: BASE 10 → 10 + N before every multiplier, and the receipt base agrees', () => {
  const bare = withStorage({ [ROLL_STATE_KEY]: owning('mk-singularity') }, () => perWordRateNow({ mode: 'wordBomb' }));
  withStorage({ [ROLL_STATE_KEY]: owning('mk-singularity'), [MARKS_EQUIPPED_KEY]: 'mk-singularity' }, () => {
    const r = perWordRateNow({ mode: 'wordBomb' });
    assert.ok(Math.abs(r.rate / bare.rate - 10) < 0.05, 'MYTHIC +90 BASE: 10 → 100 (whole-XP grid)');
    near(r.factors.baseWins, 90);
    near(wordWinsBase({}), 100, 'the receipt BASE row carries the +90');
    assert.equal(Math.round(r.base * r.factors.bonus * 10) / 10, r.rate, 'base × the multipliers = the rate (to the tenth)');
  });
  // pure: xpPerWord's addend
  assert.equal(xpPerWord({ mode: 'word-bomb', wordLength: 5, rebirthCount: 0, baseWinsAdd: 1 }), 110);
  assert.equal(xpPerWord({ mode: 'word-bomb', wordLength: 5, rebirthCount: 0 }), 100);
});

test('+N% WINS reaches the payout as a multiplier (and never the roll price)', () => {
  withStorage({ [ROLL_STATE_KEY]: owning('mk-eclipse'), [MARKS_EQUIPPED_KEY]: 'mk-eclipse' }, () => {
    const r = perWordRateNow({ mode: 'wordBomb' });
    near(r.factors.bonus, 3 * (1 + 0.005 * (100 / ROLL_MARKS.length)));
    near(r.factors.baseWins, 0);
  });
});

test('+N BASE XP/LETTER reaches every letter: (BASE 10 + N) × KEY × REBIRTH × …', () => {
  assert.equal(levelXpPerLetter(0, 0, 1, 0), 10);
  assert.equal(levelXpPerLetter(0, 0, 1, 2.5), 12.5);
  withStorage({ [ROLL_STATE_KEY]: owning('mk-kraken'), [MARKS_EQUIPPED_KEY]: 'mk-kraken', 'taw.keytier': '0', 'taw.rebirths': '0' }, () => {
    near(levelXpPerLetter(0, 0), 100, 'the worn +90 is read when baseAdd is omitted');
    const ix = 1 + 0.005 * (100 / ROLL_MARKS.length);
    near(letterXpNow(), 100 * ix);
  });
  withStorage({}, () => assert.equal(levelXpPerLetter(0, 0), 10, 'nothing worn → BASE 10'));
});

test('+N s OVERDRIVE lengthens the next OVERDRIVE', () => {
  withStorage({}, () => assert.equal(overdriveLengthMs(), 300000));
  withStorage({ [ROLL_STATE_KEY]: owning('mk-tinder'), [MARKS_EQUIPPED_KEY]: 'mk-tinder' }, () => assert.equal(overdriveLengthMs(), 375000));
});

test('pity ladder (GEAR POOL v2, Genshin): EPIC+ in 10 AND LEGENDARY+ in 50 — always shown, both forced on time', () => {
  assert.equal(PITY.legendary.hard, 50);
  assert.equal(LEGENDARY_PITY_HARD, 50);
  assert.deepEqual(pityLadder(freshState()), [{ tier: 'epic', left: 10 }, { tier: 'legendary', left: 50 }]);
  assert.deepEqual(pityLadder(null), [{ tier: 'epic', left: 10 }, { tier: 'legendary', left: 50 }]);
  const s = { ...freshState(), everEpic: true, rolls: 1000, sinceEpic: 3, sinceLegendary: 49 };
  assert.equal(pityLeft(s).legendary, 1);
  const out = roll(() => 0.999, s);
  assert.equal(out.result.pityHit, 'legendary');
  assert.ok(['legendary', 'mythic', 'secret'].includes(out.result.tier));
  assert.equal(out.state.sinceLegendary, 0);
  assert.equal(out.state.sinceEpic, 0);
  // the worst draw every time (a RARE, or an EPIC on the 10th): a LEGENDARY+ at least every 50
  let st = freshState();
  let last = 0;
  let maxGap = 0;
  for (let i = 1; i <= 2600; i++) {
    const o = roll(() => 0.985, st);
    st = o.state;
    if (['legendary', 'mythic', 'secret'].includes(o.result.tier)) {
      maxGap = Math.max(maxGap, i - last);
      last = i;
    }
  }
  assert.ok(last > 0 && maxGap === 50, `gap ${maxGap}`);
});

test('skip reveals below [tier]: default EPIC, stored in taw.markRolls; a first-time mark is never skipped', () => {
  withStorage({}, (m) => {
    assert.equal(getSkipBelow(), 'epic');
    assert.equal(setSkipBelow('legendary'), 'legendary');
    assert.equal(getSkipBelow(), 'legendary');
    assert.equal(JSON.parse(m.get(ROLL_STATE_KEY)).skipBelow, 'legendary');
    assert.equal(setSkipBelow('nope'), 'legendary', 'junk is ignored');
    assert.equal(markWinsMult(), 1, 'storing the setting changes no payout');
    assert.equal(loadRollState().rolls, 0);
  });
  assert.equal(shouldSkipReveal({ tier: 'rare', newMark: false }, 'epic'), true);
  assert.equal(shouldSkipReveal({ tier: 'epic', newMark: false }, 'epic'), false);
  assert.equal(shouldSkipReveal({ tier: 'rare', newMark: true }, 'secret'), false, 'a first-time mark plays in full');
  assert.equal(shouldSkipReveal({ tier: 'rare', newMark: false }, 'rare'), false, '< RARE skips nothing');
  assert.equal(normalize({ v: 2, skipBelow: 'common' }).skipBelow, 'epic', 'a stored < COMMON reads as the default');
  assert.equal(shouldSkipReveal(null, 'epic'), false);
  assert.equal(normalize({ v: 2, skipBelow: 'mythic' }).skipBelow, 'mythic');
  assert.equal(normalize({ v: 2, skipBelow: 'x' }).skipBelow, 'epic');
});

test('INDEX entry: owned count, first roll #, ★ line, the stat as it pays, 1 IN X', () => {
  let s = { ...freshState(), everEpic: true, rolls: 41 };
  const pick0 = () => { let i = 0; return () => (i++ % 2 ? 0.5 : 0); }; // DETONATOR, never shiny
  const a = roll(pick0(), s); // DETONATOR, new, roll #42
  s = a.state;
  assert.equal(a.result.firstRoll, 42);
  assert.equal(a.result.newMark, true);
  const b = roll(pick0(), s);
  assert.equal(b.result.firstRoll, 42, 'first roll # never moves');
  const e = indexEntry('mk-detonator', b.state);
  assert.equal(e.owned, 2);
  assert.equal(e.firstRoll, 42);
  assert.deepEqual([e.pips, e.have, e.need], [0, 1, 5]);
  assert.deepEqual(e.stat, statOf('mk-detonator', b.state));
  assert.equal(e.statLine, '×1.5 WINS IN WORD BOMB');
  assert.equal(e.oneInX, Math.round(ROLL_MARKS[0].x));
  assert.equal(indexEntry('mk-origin', b.state).owned, 0);
  assert.equal(indexEntry('mk-origin', b.state).firstRoll, null);
  assert.equal(indexEntry('nope', b.state), null);
  assert.equal(statOf('mk-eternal', null), null, 'a PERMANENT has no stat (it pays its MAIN)');
});

test('INDEX rewards: new mark + completion once, priced at your rate; milestones are LUCK only now', () => {
  const rares = ROLL_MARKS.filter((m) => m.tier === 'rare');
  const s = { ...freshState(), everEpic: true, rolls: 5, marks: Object.fromEntries(rares.slice(1).map((m) => [m.id, { n: 1 }])) };
  const a = roll(() => 0, s);
  assert.equal(a.result.completed, 'rare');
  assert.deepEqual(a.result.rewards.map((r) => r.kind), ['new', 'complete']);
  assert.equal(a.result.rewardWords, INDEX_NEW_WORDS.rare + INDEX_COMPLETE_WORDS.rare);
  assert.deepEqual(a.state.done, ['rare']);
  assert.deepEqual(completedTiers(a.state), ['rare']);
  assert.equal(indexRewardWins(a.result, 12.5), Math.round(a.result.rewardWords * 12.5));
  assert.equal(indexRewardWins(a.result, 0), 0);
  // completion pays once: lose nothing, roll the tier again
  const b = roll(() => 0, a.state);
  assert.equal(b.result.completed, null);
  assert.equal(b.result.rewardWords, 0);
  assert.equal(milestoneWins('base-25', 100), 0);
});
