import test from 'node:test';
import assert from 'node:assert/strict';
import { oneRowOf, draftRowOf, autocorrect, windupFrac, WINDUP, refillBreath, BREATH } from './powers.js';

test('ONE ROW finds words typed on a single keyboard row', () => {
  assert.equal(oneRowOf('typewriter'), 0);
  assert.equal(oneRowOf('flask'), 1);
  assert.equal(oneRowOf('pot'), -1, 'too short');
  assert.equal(oneRowOf('table'), -1);
  assert.equal(draftRowOf('ty'), 0);
  assert.equal(draftRowOf('tab'), -1);
});

test('AUTOCORRECT fixes one edit, keeps the fragment, skips used words', () => {
  const accept = new Set(['table', 'tablet', 'cable', 'stable', 'tale']);
  const rank = new Map([['table', 10], ['cable', 900], ['tablet', 500], ['stable', 400]]);
  assert.equal(autocorrect('tavle', 'ab', accept, new Set(), rank).word, 'table');
  assert.equal(autocorrect('tbale', 'ab', accept, new Set(), rank).word, 'table'); // swap
  assert.equal(autocorrect('tabel', 'ab', accept, new Set(), rank).word, 'table'); // swap at the end
  assert.equal(autocorrect('tale', 'ab', accept, new Set(), rank).word, 'table'); // insert
  assert.equal(autocorrect('tavle', 'ab', accept, new Set(['table']), rank), null);
  assert.equal(autocorrect('cavle', 'ab', accept, new Set(), rank).word, 'cable');
  assert.equal(autocorrect('zzzzz', 'ab', accept, new Set(), rank), null);
});

test('WIND-UP: a tap is not a wind-up, a full hold is 1', () => {
  assert.equal(windupFrac(50), 0);
  assert.equal(windupFrac(WINDUP.fullMs), 1);
  assert.ok(windupFrac(400) > 0 && windupFrac(400) < 1);
});

test('HOLD BREATH refills by letters and caps at the meter', () => {
  assert.equal(refillBreath(0, 7), 7 * BREATH.refillPerLetterMs);
  assert.equal(refillBreath(BREATH.capacityMs - 10, 9), BREATH.capacityMs);
});
