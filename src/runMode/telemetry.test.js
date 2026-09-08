// telemetry.test.js (feat/run-telemetry) — the run_round / run_over payload SHAPES are pinned here:
// exact key sets, types, coercions, and the emitter contract (tracker called with the event name +
// built payload; absent/throwing tracker is a no-op).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RUN_ROUND_EVENT, RUN_OVER_EVENT, RUN_OVER_REASONS,
  runRoundPayload, runOverPayload, emitRunRound, emitRunOver,
} from './telemetry.js';

const ROUND_KEYS = ['round', 'mode', 'seed', 'wall', 'accepted', 'attempts', 'rawScore', 'adjustedScore', 'cleared', 'stackIds', 'secondsLeft'];
const OVER_KEYS = ['roundReached', 'reason', 'cumulative', 'winsEarned', 'level'];

test('event names', () => {
  assert.equal(RUN_ROUND_EVENT, 'run_round');
  assert.equal(RUN_OVER_EVENT, 'run_over');
  assert.deepEqual(RUN_OVER_REASONS, ['wall', 'fumble', 'cleared']);
});

test('run_round payload: exact keys, types, and values pass through', () => {
  const p = runRoundPayload({
    round: 3, mode: 'fuse', seed: 12345, wall: 180, accepted: 7, attempts: 9,
    rawScore: 231.6, adjustedScore: 359, cleared: true, stackIds: ['snowball', 'momentum'], secondsLeft: 0,
  });
  assert.deepEqual(Object.keys(p).sort(), [...ROUND_KEYS].sort());
  assert.deepEqual(p, {
    round: 3, mode: 'fuse', seed: 12345, wall: 180, accepted: 7, attempts: 9,
    rawScore: 232, adjustedScore: 359, cleared: true, stackIds: ['snowball', 'momentum'], secondsLeft: 0,
  });
  assert.equal(typeof p.cleared, 'boolean');
  assert.ok(Number.isInteger(p.rawScore) && Number.isInteger(p.adjustedScore));
});

test('run_round payload: coerces garbage safely (never throws, never leaks non-ids)', () => {
  const p = runRoundPayload({ round: '2', mode: 7, seed: -1, wall: NaN, accepted: null, attempts: undefined,
    rawScore: 'x', adjustedScore: Infinity, cleared: 'yes', stackIds: ['ok', 3, null], secondsLeft: -4 });
  assert.deepEqual(p, {
    round: 0, mode: 'unknown', seed: 4294967295, wall: 0, accepted: 0, attempts: 0,
    rawScore: 0, adjustedScore: 0, cleared: true, stackIds: ['ok'], secondsLeft: 0,
  });
  assert.deepEqual(runRoundPayload().stackIds, []);
  assert.equal(runRoundPayload().seed, null);
  assert.equal(runRoundPayload({ cleared: 0 }).cleared, false);
});

test('run_over payload: exact keys, reason enum, level floor', () => {
  const p = runOverPayload({ roundReached: 10, reason: 'cleared', cumulative: 5432.4, winsEarned: 543, level: 12 });
  assert.deepEqual(Object.keys(p).sort(), [...OVER_KEYS].sort());
  assert.deepEqual(p, { roundReached: 10, reason: 'cleared', cumulative: 5432, winsEarned: 543, level: 12 });
  for (const r of RUN_OVER_REASONS) assert.equal(runOverPayload({ reason: r }).reason, r);
  assert.equal(runOverPayload({ reason: 'nope' }).reason, 'unknown');
  assert.equal(runOverPayload({ level: 0 }).level, 1);
  assert.equal(runOverPayload().level, 1);
});

test('emitters call the tracker with (event, payload); absent/throwing tracker is a no-op', () => {
  const calls = [];
  const spy = (e, props) => calls.push([e, props]);
  emitRunRound({ round: 1, mode: 'sat', seed: 9, wall: 80, accepted: 4, attempts: 5, rawScore: 90, adjustedScore: 90, cleared: true, stackIds: [], secondsLeft: 0 }, spy);
  emitRunOver({ roundReached: 2, reason: 'wall', cumulative: 150, winsEarned: 3, level: 4 }, spy);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'run_round');
  assert.deepEqual(Object.keys(calls[0][1]).sort(), [...ROUND_KEYS].sort());
  assert.equal(calls[1][0], 'run_over');
  assert.deepEqual(calls[1][1], { roundReached: 2, reason: 'wall', cumulative: 150, winsEarned: 3, level: 4 });
  assert.doesNotThrow(() => emitRunRound({ round: 1 }, undefined));
  assert.doesNotThrow(() => emitRunOver({ roundReached: 1 }, null));
  assert.doesNotThrow(() => emitRunRound({ round: 1 }, () => { throw new Error('posthog down'); }));
  assert.doesNotThrow(() => emitRunOver({ roundReached: 1 }, () => { throw new Error('posthog down'); }));
});
