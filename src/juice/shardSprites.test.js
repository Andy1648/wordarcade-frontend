// shardSprites.test.js — the painted accept particles: the house hues map to their painted shard set, everything else
// (SAT RUSH's ink / paper, greys, white) stays a flat square, and every sprite the map can pick ships.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setForColor, spriteUrl, SPRITE_SETS, SPRITE_PIECES } from './shardSprites.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

test('the house palette paints as its own shard set', () => {
  assert.equal(setForColor('#ff4fa3'), 'pink');
  assert.equal(setForColor('#FF3D7F'), 'pink');
  assert.equal(setForColor('#2EFFE0'), 'cyan');
  assert.equal(setForColor('#3D8BFF'), 'cyan');
  assert.equal(setForColor('#FFE94A'), 'gold');
  assert.equal(setForColor('#FF6B3D'), 'gold');
  assert.equal(setForColor('#FFC23D'), 'gold');
  assert.equal(setForColor('#9A1AFF'), 'violet');
  assert.equal(setForColor('#B04BFF'), 'violet');
});

test('off-palette colours keep the flat square (SAT RUSH ink / paper, greys, white, junk)', () => {
  for (const c of ['#ffffff', '#fff', '#000000', '#1a1a1a', '#f4ecd8', '#888888', 'red', '', null, undefined, 'rgb(1,2,3)']) {
    assert.equal(setForColor(c), null, String(c));
  }
});

test('every sprite the map can pick ships in public/', () => {
  for (const set of SPRITE_SETS) {
    for (let i = 0; i < SPRITE_PIECES; i += 1) assert.ok(existsSync(join(PUBLIC, spriteUrl(set, i))), spriteUrl(set, i));
  }
});
