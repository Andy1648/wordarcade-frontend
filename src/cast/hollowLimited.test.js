// hollowLimited.test.js — HOLLOW, the first LIMITED hero (oct21): sold for gems in October 2026 only, never again; an
// owner keeps it after the sale ends. The gate is a DATE (HERO_UNLOCK.hollow.until), not a rebirth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { HERO_UNLOCK, HERO_PRICE, HOLLOW_UNTIL, heroById, heroGateMet, limitedDaysLeft, castSrc, hasPose } from './cast.js';

test('HOLLOW is a priced LIMITED legend with all three poses painted on disk', () => {
  const h = heroById('hollow');
  assert.ok(h && h.legend && h.limited);
  assert.equal(HERO_PRICE.hollow, 1500);
  assert.equal(HERO_UNLOCK.hollow.until, HOLLOW_UNTIL);
  for (const pose of ['hero', 'win', 'ko']) {
    assert.ok(hasPose('hollow', pose), pose);
    assert.equal(castSrc('hollow', pose), `/cast/hollow-${pose}.webp`);
    assert.ok(existsSync(join(process.cwd(), 'public', 'cast', `hollow-${pose}.webp`)), pose);
  }
});

test('the sale window: buyable until Nov 1 2026 (Pacific), never after; the days-left clock counts down', () => {
  const oct21 = Date.UTC(2026, 9, 21, 20, 0, 0);
  assert.equal(heroGateMet('hollow', oct21), true);
  assert.equal(limitedDaysLeft('hollow', oct21), 11);
  assert.equal(limitedDaysLeft('hollow', HOLLOW_UNTIL - 60_000), 1);
  assert.equal(heroGateMet('hollow', HOLLOW_UNTIL), false);
  assert.equal(heroGateMet('hollow', HOLLOW_UNTIL + 86400000 * 400), false, 'never again');
  assert.equal(limitedDaysLeft('hollow', HOLLOW_UNTIL), null);
  assert.equal(limitedDaysLeft('mecha', oct21), null, 'only a LIMITED hero has a clock');
});
