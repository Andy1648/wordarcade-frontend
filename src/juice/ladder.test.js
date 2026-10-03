// ladder.test.js — the ESCALATION LADDER's tier table, thresholds and caps (juice/ladder.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIER_THRESHOLDS,
  MAX_TIER,
  LADDER,
  PARTICLE_CAP,
  SLAM_MS,
  SLAM_TOTAL_MS,
  PUNCH_MS,
  heatTier,
  ladderFor,
  tierCrossed,
  particleCount,
  pitchRatio,
  slamLabel,
} from './ladder.js';

test('thresholds are the combo meter\'s 2 / 4 / 7 / 10', () => {
  assert.deepEqual([...TIER_THRESHOLDS], [2, 4, 7, 10]);
  assert.equal(MAX_TIER, 4);
  assert.equal(LADDER.length, 5);
});

test('heatTier: T0 0–1 · T1 2–3 · T2 4–6 · T3 7–9 · T4 10+', () => {
  const expect = { 0: 0, 1: 0, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4, 11: 4, 20: 4, 500: 4 };
  for (const [n, t] of Object.entries(expect)) assert.equal(heatTier(Number(n)), t, `count ${n}`);
  assert.equal(heatTier(-3), 0);
  assert.equal(heatTier(NaN), 0);
  assert.equal(heatTier(undefined), 0);
});

test('the spec table: punch 1.06 -> 1.20, particles 10 -> 40, ring 110 -> 190, pitch +0 -> +12 st', () => {
  assert.deepEqual(LADDER.map((r) => r.punch), [1.06, 1.09, 1.12, 1.16, 1.2]);
  assert.deepEqual(LADDER.map((r) => r.particles), [10, 16, 22, 30, 40]);
  assert.deepEqual(LADDER.map((r) => r.ring), [110, 130, 150, 170, 190]);
  assert.deepEqual(LADDER.map((r) => r.semis), [0, 2, 4, 7, 12]);
});

test('every rung strictly escalates', () => {
  for (let i = 1; i < LADDER.length; i++) {
    assert.ok(LADDER[i].punch > LADDER[i - 1].punch, `punch ${i}`);
    assert.ok(LADDER[i].particles > LADDER[i - 1].particles, `particles ${i}`);
    assert.ok(LADDER[i].ring > LADDER[i - 1].ring, `ring ${i}`);
    assert.ok(LADDER[i].semis > LADDER[i - 1].semis, `pitch ${i}`);
  }
});

test('per-word particles are CAPPED at 40, whatever the combo', () => {
  assert.equal(PARTICLE_CAP, 40);
  for (let n = 0; n <= 200; n++) assert.ok(particleCount(n) <= PARTICLE_CAP, `count ${n}`);
  assert.equal(particleCount(0), 10);
  assert.equal(particleCount(10), 40);
  assert.equal(particleCount(144), 40); // the old feel sprayed 24 + 6*20 = 144 at combo 20
});

test('cue pitch is capped at one octave', () => {
  assert.equal(pitchRatio(0), 1);
  assert.ok(Math.abs(pitchRatio(10) - 2) < 1e-9);
  assert.ok(Math.abs(pitchRatio(99) - 2) < 1e-9);
});

test('NO per-word screen flash: T0 flashes nothing, tier-ups 0.10 / 0.12 / 0.14 / 0.16', () => {
  assert.deepEqual(LADDER.map((r) => r.flash), [0, 0.1, 0.12, 0.14, 0.16]);
});

test('tierCrossed fires once per crossing UP, never inside a tier or going down', () => {
  // walking a streak 0 -> 12 fires exactly at 2, 4, 7, 10
  const fired = [];
  for (let n = 1; n <= 12; n++) {
    const t = tierCrossed(n - 1, n);
    if (t) fired.push([n, t]);
  }
  assert.deepEqual(fired, [[2, 1], [4, 2], [7, 3], [10, 4]]);
  assert.equal(tierCrossed(5, 6), 0); // inside T2
  assert.equal(tierCrossed(9, 0), 0); // a break
  assert.equal(tierCrossed(10, 3), 0); // a rollback
  assert.equal(tierCrossed(0, 10), 4); // a jump lands ONE crossing, for the tier landed in
});

test('slam timing is 320 in + 500 hold + 200 out; punch is 280', () => {
  assert.deepEqual({ ...SLAM_MS }, { in: 320, hold: 500, out: 200 });
  assert.equal(SLAM_TOTAL_MS, 1020);
  assert.equal(PUNCH_MS, 280);
});

test('slam labels are short (<= 2 words) and T0 has none', () => {
  assert.equal(slamLabel(0), '');
  for (let t = 1; t <= 4; t++) {
    const l = slamLabel(t);
    assert.ok(l.length > 0, `T${t} label`);
    assert.ok(l.split(/\s+/).length <= 2, `T${t} label "${l}" is <= 2 words`);
    assert.equal(l, l.toUpperCase());
  }
  assert.equal(slamLabel(9), '');
});

test('edge frame: none at T0, one colour per tier above', () => {
  assert.equal(LADDER[0].edge, null);
  const edges = LADDER.slice(1).map((r) => r.edge);
  assert.equal(new Set(edges).size, 4);
  assert.equal(ladderFor(10).edge, '#FF4FA3');
});
