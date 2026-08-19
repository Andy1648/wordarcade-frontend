// runTimers.test.js — the run-clock cancel path.
// This is the guarantee behind a clean mid-run exit: after the player abandons a
// run, the two scheduled timers (the between-word pause holding a doMiss/next-word,
// and the stage/spell tick) must be cancelled so advancing the clock fires NOTHING.
// The hook calls clearRunTimers on abandon + unmount; here we drive it directly with
// node's fake timers (no DOM needed), mirroring the mid-word exit scenario.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { clearRunTimers } from './runTimers.js';

test('after a mid-word exit, advancing fake time fires no miss / stage tick', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let missFired = 0; // the between-word pause would fire doMiss / beginWord
    let stageTickFired = 0; // the stage timer would advance the stage / auto-reveal
    const pauseRef = { current: setTimeout(() => { missFired += 1; }, 1800) };
    const stageRef = { current: setTimeout(() => { stageTickFired += 1; }, 1000) };

    // Player hits the HUD ✕ mid-word → the run clock is cleared.
    clearRunTimers(pauseRef, stageRef);

    // Advance well past both delays: neither timer may fire.
    mock.timers.tick(5000);
    assert.equal(missFired, 0, 'no doMiss after the run is abandoned');
    assert.equal(stageTickFired, 0, 'no stage tick after the run is abandoned');
  } finally {
    mock.timers.reset();
  }
});

test('control: without the clear, those same timers DO fire (the clear is not a no-op)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let fired = 0;
    setTimeout(() => { fired += 1; }, 1800);
    setTimeout(() => { fired += 1; }, 1000);
    mock.timers.tick(5000);
    assert.equal(fired, 2, 'both timers fire when the run clock is left running');
  } finally {
    mock.timers.reset();
  }
});

test('clearRunTimers passes each timer id to the injected clear (the hook uses clearTimeout)', () => {
  const cleared = [];
  clearRunTimers({ current: 'pause-id' }, { current: 'stage-id' }, (id) => cleared.push(id));
  assert.deepEqual(cleared, ['pause-id', 'stage-id']);
});

test('a null timer (never scheduled) is cleared harmlessly', () => {
  assert.doesNotThrow(() => clearRunTimers({ current: null }, { current: null }));
});
