import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { emblemBand, emblemSrc } from './rebirthEmblem.js';

test('the rebirth emblem climbs a band every jackpot rebirth (R5 / R10 / R15 / R20) and every band is painted', () => {
  assert.deepEqual([0, 4, 5, 9, 10, 14, 15, 19, 20, 99].map(emblemBand), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(emblemBand(undefined), 1);
  for (let b = 1; b <= 5; b += 1) assert.ok(existsSync(`public/rebirth/emblem-${b}-v1.webp`), `band ${b} art`);
  assert.equal(emblemSrc(12), '/rebirth/emblem-3-v1.webp');
});
