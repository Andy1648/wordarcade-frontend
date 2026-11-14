// quests.test.js — the pure QUEST engine (progress/quests.js): the seeded deal, the "a mode you haven't played" promise,
// the weekly, the one reroll, stacking, the end-of-game settle and the payout cap. node:test (npm test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POOL, BY_ID, WEEK, MODES, PAY_SHARE, CAP_X, XP_FRAC,
  dayKey, weekKey, daysBetween, pickDaily, pickWeekly, deal, rerollSlot, applyEvent, settleGame, questPayout,
  dailyAverage, nudge, board, staleMode, isStale, progressOf,
} from './quests.js';

const at = (iso) => new Date(iso).getTime();
const MON = at('2026-11-09T12:00:00'); // a Monday
const fixed = () => 0.42;

test('the pool: every quest is well formed; tiers 1–3 + weekly; nothing pays gems', () => {
  for (const q of POOL) {
    assert.ok(q.id && q.text && q.goal && q.target > 0, q.id);
    assert.ok([1, 2, 3, WEEK].includes(q.tier), q.id);
    assert.ok(q.mode === 'any' || MODES.includes(q.mode), q.id);
    assert.equal(typeof q.when, 'function', q.id);
    assert.ok(q.once || (Array.isArray(q.unit) && q.unit.length === 2), `${q.id} needs a nudge unit`);
    assert.equal(q.gems, undefined, `${q.id} must never carry gems`);
  }
  for (const t of [1, 2, 3, WEEK]) assert.ok(POOL.some((q) => q.tier === t), `tier ${t}`);
});

test('calendar: local day / Monday week / day distance', () => {
  assert.equal(dayKey(at('2026-11-13T23:59:00')), '2026-11-13');
  assert.equal(weekKey(at('2026-11-15T10:00:00')), '2026-11-09'); // Sunday → that week's Monday
  assert.equal(weekKey(at('2026-11-09T00:30:00')), '2026-11-09');
  assert.equal(weekKey(at('2026-11-16T00:30:00')), '2026-11-16');
  assert.equal(daysBetween('2026-11-09', '2026-11-13'), 4);
  assert.equal(daysBetween('2026-10-31', '2026-11-01'), 1);
});

test('the deal is seeded per day AND per player, EASY/MEDIUM/HARD in three different modes, at most one ANY', () => {
  const a = pickDaily('2026-11-13', 'player-a');
  assert.deepEqual(a, pickDaily('2026-11-13', 'player-a'), 'deterministic');
  let differs = 0;
  for (let i = 0; i < 20; i++) if (pickDaily('2026-11-13', `p${i}`).join() !== a.join()) differs += 1;
  assert.ok(differs >= 15, 'different players see different quests');
  for (let d = 1; d <= 28; d++) {
    for (const seed of ['x', 'y', 'z']) {
      const picks = pickDaily(`2026-11-${String(d).padStart(2, '0')}`, seed);
      assert.equal(picks.length, 3);
      assert.deepEqual(picks.map((id) => BY_ID[id].tier), [1, 2, 3]);
      const modes = picks.map((id) => BY_ID[id].mode);
      assert.equal(new Set(modes).size, 3, `three different modes: ${modes}`);
      assert.ok(modes.filter((m) => m === 'any').length <= 1);
    }
  }
});

test('at least one daily is for the mode the player played least recently', () => {
  const day = '2026-11-13';
  const played = { wb: '2026-11-13', blitz: '2026-11-12', sat: '2026-11-12', chain: '2026-11-13', fuse: '2026-11-12', race: '2026-11-01' };
  for (let i = 0; i < 30; i++) {
    const picks = pickDaily(day, `s${i}`, MODES, played);
    assert.ok(picks.some((id) => BY_ID[id].mode === 'race'), `race (last played 12 days ago) is on the board: ${picks}`);
  }
  // never-played beats played
  assert.equal(staleMode(['wb', 'chain'], { wb: '2026-11-01' }, fixed), 'chain');
  assert.equal(isStale('wb', { wb: '2026-11-12' }, day), false);
  assert.equal(isStale('wb', { wb: '2026-11-01' }, day), true);
  // only open modes are ever dealt
  for (let i = 0; i < 20; i++) {
    const picks = pickDaily(day, `o${i}`, ['wb', 'blitz', 'race'], {});
    for (const id of picks) assert.ok(['wb', 'blitz', 'race', 'any'].includes(BY_ID[id].mode), id);
  }
});

test('deal: a new day refreshes the dailies, keeps the seed + weekly progress; a new week deals a new weekly', () => {
  const s0 = deal(null, MON, MODES, fixed);
  assert.equal(s0.day, '2026-11-09');
  assert.equal(s0.week, '2026-11-09');
  assert.equal(BY_ID[s0.wpick].tier, WEEK);
  assert.equal(deal(s0, MON + 3600e3), s0, 'same day → same object');
  const ticked = { ...s0, prog: { ...s0.prog, [s0.wpick]: 7, [s0.picks[0]]: 1 }, done: [s0.picks[1]], rerolled: true };
  const tue = deal(ticked, MON + 86400e3, MODES, fixed);
  assert.equal(tue.day, '2026-11-10');
  assert.equal(tue.seed, s0.seed);
  assert.equal(tue.wpick, s0.wpick, 'the weekly stays all week');
  assert.equal(progressOf(tue, tue.wpick), Math.min(BY_ID[s0.wpick].target, 7));
  assert.equal(tue.rerolled, false, 'one free reroll a day');
  assert.deepEqual(tue.done, []);
  assert.equal(tue.prog[s0.picks[0]], undefined);
  const nextMon = deal(tue, MON + 7 * 86400e3, MODES, fixed);
  assert.equal(nextMon.week, '2026-11-16');
  assert.equal(nextMon.wpick, pickWeekly('2026-11-16', s0.seed));
  assert.equal(progressOf(nextMon, nextMon.wpick), 0);
});

test('reroll: once a day, same tier, a different mode, never a finished quest', () => {
  const s = deal(null, MON, MODES, fixed);
  const r = rerollSlot(s, 1);
  assert.ok(r);
  assert.notEqual(r.picks[1], s.picks[1]);
  assert.equal(BY_ID[r.picks[1]].tier, 2);
  assert.notEqual(BY_ID[r.picks[1]].mode, BY_ID[s.picks[1]].mode);
  assert.equal(new Set(r.picks.map((id) => BY_ID[id].mode)).size, 3);
  assert.equal(rerollSlot(r, 0), null, 'one reroll a day');
  assert.equal(rerollSlot({ ...s, done: [s.picks[2]] }, 2), null, 'never a finished quest');
});

test('events tick, STACK (one game finishes two), and a finish waits for the game end to pay', () => {
  const base = deal(null, MON, MODES, fixed);
  const s = { ...base, picks: ['q-games3', 'q-wb-run5', 'q-wb-win'], wpick: 'w-games25', prog: {}, done: [] };
  let st = s;
  for (let n = 1; n <= 5; n++) st = applyEvent(st, { type: 'run', mode: 'word-bomb', n }).state;
  assert.deepEqual(st.done, ['q-wb-run5']);
  assert.deepEqual(st.pending, ['q-wb-run5']);
  const { state: end, ticks } = applyEvent(st, { type: 'game', mode: 'word-bomb', won: true, rivals: 2 });
  assert.deepEqual(ticks.map((t) => t.id).sort(), ['q-games3', 'q-wb-win', 'w-games25'].sort(), 'one game event ticks three quests');
  assert.ok(ticks.find((t) => t.id === 'q-wb-win').done);
  assert.deepEqual(end.pending, ['q-wb-run5', 'q-wb-win']);
  assert.equal(progressOf(end, 'q-games3'), 1);
  // a win against no-one is not a win
  const solo = applyEvent(st, { type: 'game', mode: 'word-bomb', won: true, rivals: 0 }).state;
  assert.ok(!solo.done.includes('q-wb-win'));
  // nothing moved → same object
  assert.equal(applyEvent(end, { type: 'sat', stage: 0 }).state, end);
});

test('distinct modes count each mode once; letters add by length; best keeps the max', () => {
  const s = { ...deal(null, MON, MODES, fixed), picks: ['q-modes3', 'q-long7x3', 'q-ch-run10'], wpick: 'w-letters', prog: {}, done: [] };
  let st = s;
  for (const m of ['wb', 'wb', 'chain', 'sat']) st = applyEvent(st, { type: 'game', mode: m }).state;
  assert.equal(progressOf(st, 'q-modes3'), 3);
  st = applyEvent(st, { type: 'word', mode: 'chain', word: 'elephants', len: 9 }).state;
  assert.equal(progressOf(st, 'w-letters'), 9);
  assert.equal(progressOf(st, 'q-long7x3'), 1);
  st = applyEvent(st, { type: 'run', mode: 'chain', n: 7 }).state;
  st = applyEvent(st, { type: 'run', mode: 'chain', n: 3 }).state; // a new run starts lower: never drops
  assert.equal(progressOf(st, 'q-ch-run10'), 7);
});

test('payout: +50% of the game wins, capped at 2x the daily average, plus XP of the level bar — never gems', () => {
  const p = questPayout({ tier: 2, gameWins: 400, dailyAvg: 1000, need: 600 });
  assert.equal(p.wins, 400 * PAY_SHARE);
  assert.equal(p.xp, Math.round(XP_FRAC[2] * 600));
  assert.equal(p.capped, false);
  assert.equal('gems' in p, false, 'quests never pay gems');
  // a jackpot game: 50% would be 25,000 — capped at 2 × the 1,000 a day average
  const j = questPayout({ tier: 3, gameWins: 50000, dailyAvg: 1000, need: 600 });
  assert.equal(j.wins, CAP_X * 1000);
  assert.equal(j.capped, true);
  // no history: the cap is 2 × today's game wins (this game included) — a first day can never out-pay itself
  const first = questPayout({ tier: 1, gameWins: 300, dailyAvg: 0, todayWins: 300, need: 100 });
  assert.equal(first.wins, 150);
  // nothing earned → nothing paid; XP still lands
  const zero = questPayout({ tier: 1, gameWins: 0, need: 100 });
  assert.equal(zero.wins, 0);
  assert.equal(zero.xp, 10);
  // every tier's XP is under one level: a quest never crosses two levels
  for (const t of [1, 2, 3, WEEK]) assert.ok(XP_FRAC[t] < 1);
});

test('dailyAverage reads the last 7 played days, today excluded', () => {
  const hist = { '2026-11-13': 9999, '2026-11-12': 100, '2026-11-11': 300, '2026-11-01': 50000, '2026-11-10': 0 };
  assert.equal(dailyAverage(hist, '2026-11-13'), 200);
  assert.equal(dailyAverage({}, '2026-11-13'), 0);
});

test('settleGame pays every pending finish from THIS game, records the mode + the wins, and pays once', () => {
  let st = { ...deal(null, MON, MODES, fixed), picks: ['q-games3', 'q-wb-run5', 'q-wb-win'], wpick: 'w-games25', prog: {}, done: [], hist: { '2026-11-08': 1000 } };
  for (let n = 1; n <= 5; n++) st = applyEvent(st, { type: 'run', mode: 'wb', n }).state;
  st = applyEvent(st, { type: 'game', mode: 'wb', won: true, rivals: 1 }).state;
  const { state, payouts } = settleGame(st, { mode: 'word-bomb', gameWins: 500, now: MON, need: 1000 });
  assert.deepEqual(payouts.map((p) => p.id), ['q-wb-run5', 'q-wb-win']);
  assert.equal(payouts[0].wins, 250);
  assert.equal(payouts[0].xp, 150);
  assert.equal(payouts[1].xp, 250);
  assert.equal(state.played.wb, '2026-11-09');
  assert.equal(state.hist['2026-11-09'], 500);
  assert.deepEqual(state.pending, []);
  assert.ok(state.paid['q-wb-run5']);
  const again = settleGame(state, { mode: 'wb', gameWins: 500, now: MON, need: 1000 });
  assert.deepEqual(again.payouts, [], 'a quest pays once');
  // the cap binds on a jackpot game: 2 × the 1,000 a day average
  let j = { ...state, prog: {}, done: [], pending: [], paid: {}, picks: ['q-games3', 'q-wb-run5', 'q-wb-win'] };
  j = applyEvent(j, { type: 'game', mode: 'wb', won: true, rivals: 1 }).state;
  const jp = settleGame(j, { mode: 'wb', gameWins: 90000, now: MON, need: 1000 }).payouts;
  assert.equal(jp[0].wins, 2000);
});

test('a quest finished but not paid before midnight is paid by the next game (never lost)', () => {
  let st = { ...deal(null, MON, MODES, fixed), picks: ['q-wb-run5', 'q-games3', 'q-long10'], prog: {}, done: [] };
  for (let n = 1; n <= 5; n++) st = applyEvent(st, { type: 'run', mode: 'wb', n }).state;
  const tue = deal(st, MON + 86400e3, MODES, fixed);
  assert.deepEqual(tue.carry, ['q-wb-run5']);
  const { payouts } = settleGame(tue, { mode: 'chain', gameWins: 100, now: MON + 86400e3, need: 100 });
  assert.deepEqual(payouts.map((p) => p.id), ['q-wb-run5']);
});

test('nudge: the closest quest and what finishes it', () => {
  const s = { ...deal(null, MON, MODES, fixed), picks: ['q-games3', 'q-wb-words', 'q-long10'], wpick: 'w-games25', prog: { 'q-games3': 2, 'q-wb-words': 3 }, done: [] };
  assert.equal(nudge(s).text, '1 MORE GAME FINISHES A QUEST');
  const words = { ...s, prog: { 'q-games3': 0, 'q-wb-words': 8 } };
  assert.equal(nudge(words).text, '2 MORE WORDS FINISH A QUEST');
  const once = { ...s, picks: ['q-ch-run10'], wpick: 'w-games25', prog: {} };
  assert.equal(nudge(once).text, 'A CHAIN OF 10 FINISHES A QUEST');
  const modes = { ...s, picks: ['q-modes3'], prog: { 'q-modes3': 2 }, wpick: 'w-games25' };
  assert.equal(nudge(modes).text, '1 MORE MODE FINISHES A QUEST');
  const all = { ...s, done: [...s.picks, s.wpick] };
  assert.equal(nudge(all), null);
  assert.equal(board(s).length, 4);
  assert.equal(board(s)[3].slot, -1);
});
