// jackpotCoins.test.js — JACKPOT's payout: real art, every flight a snappy transform/opacity one-shot, invisible at both ends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COIN_SRC, COIN_COUNT, COIN_MS, COIN_STAGGER_MS, coinFrames } from './jackpotCoins.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

test('the coin is real art', () => assert.ok(existsSync(join(PUBLIC, COIN_SRC))));

test('every flight is transform/opacity only, invisible at both ends, inside 800 ms', () => {
  for (let k = 0; k < COIN_COUNT; k += 1) {
    const f = coinFrames(k);
    assert.equal(f[0].opacity, 0);
    assert.equal(f[f.length - 1].opacity, 0);
    for (const fr of f) for (const p of Object.keys(fr)) assert.ok(['offset', 'opacity', 'transform', 'easing'].includes(p), p);
  }
  assert.ok(COIN_MS + COIN_STAGGER_MS * (COIN_COUNT - 1) <= 800);
});
