// markFlavour.test.js — every mark the INDEX can draw has ONE flavour line, ≤ 32 chars, all caps, one line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MARK_FLAVOUR, FLAVOUR_MAX, flavourOf } from './markFlavour.js';
import { ROLL_MARKS, PERMANENT_MARKS, RETIRED_MARK_IDS } from './markRolls.js';

const ALL_IDS = [...ROLL_MARKS.map((m) => m.id), ...PERMANENT_MARKS.map((m) => m.id), ...RETIRED_MARK_IDS];

test('every rollable, PERMANENT and retired mark has a flavour line', () => {
  const missing = ALL_IDS.filter((id) => !flavourOf(id));
  assert.deepEqual(missing, []);
});

test('flavour lines are ONE line, ≤ 32 chars, all caps', () => {
  assert.equal(FLAVOUR_MAX, 32);
  for (const [id, line] of Object.entries(MARK_FLAVOUR)) {
    assert.ok(line.length > 0 && line.length <= FLAVOUR_MAX, `${id}: ${line.length} chars`);
    assert.ok(!/[\r\n]/.test(line), `${id}: one line`);
    assert.equal(line, line.toUpperCase(), `${id}: all caps`);
  }
});

test('no flavour line for an id the INDEX never draws, and no duplicate lines', () => {
  const known = new Set(ALL_IDS);
  assert.deepEqual(Object.keys(MARK_FLAVOUR).filter((id) => !known.has(id)), []);
  const lines = Object.values(MARK_FLAVOUR);
  assert.equal(new Set(lines).size, lines.length);
});

test('flavourOf: an unknown id → empty', () => {
  assert.equal(flavourOf('mk-nope'), '');
  assert.equal(flavourOf('constructor'), '');
});
