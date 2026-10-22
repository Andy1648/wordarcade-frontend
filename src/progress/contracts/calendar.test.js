// calendar.test.js — the STREAK CALENDAR track: check-in gating, one claim a day, the escalation, the week wrap, and the
// missed-day rule (one missed day holds, two or more reset to DAY 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DAYS, fresh, calendarView, claimStep, settle } from './calendar.js';

test('the track escalates and ends on the LEGENDARY roll', () => {
  assert.equal(DAYS.length, 7);
  for (let i = 1; i < DAYS.length; i += 1) assert.ok(DAYS[i].gems >= DAYS[i - 1].gems || DAYS[i].kind !== 'gems', `day ${i + 1}`);
  assert.equal(DAYS[6].kind, 'legendary');
  assert.equal(DAYS[3].kind, 'roll');
});

test('a day is claimable only after playing today, once', () => {
  const t = 1000;
  assert.equal(calendarView(fresh(), t, false).needPlay, true);
  assert.equal(claimStep(fresh(), t, false), null);
  const r = claimStep(fresh(), t, true);
  assert.equal(r.paid.day, 1);
  assert.equal(claimStep(r.state, t, true), null, 'twice the same day');
  const v = calendarView(r.state, t, true);
  assert.equal(v.claimedToday, true);
  assert.deepEqual(v.days.slice(0, 2).map((d) => d.state), ['got', 'next']);
});

test('seven days in a row walk the track, then a new week starts at DAY 1', () => {
  let s = fresh();
  const paid = [];
  for (let d = 0; d < 7; d += 1) {
    const r = claimStep(s, 500 + d, true);
    paid.push(r.paid.day);
    s = r.state;
  }
  assert.deepEqual(paid, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(s.week, 2);
  assert.ok(calendarView(s, 506, true).days.every((d) => d.state === 'got'), 'DAY 7 day shows the full week');
  assert.equal(claimStep(s, 507, true).paid.day, 1);
});

test('one missed day holds the place; two or more reset to DAY 1', () => {
  let s = fresh();
  for (let d = 0; d < 3; d += 1) s = claimStep(s, 100 + d, true).state; // claimed DAY 1-3 on 100..102
  assert.equal(claimStep(s, 104, true).paid.day, 4, 'missed 103 only: held');
  assert.equal(settle(s, 105).reset, true, 'missed 103 + 104: reset');
  assert.equal(claimStep(s, 105, true).paid.day, 1);
});
