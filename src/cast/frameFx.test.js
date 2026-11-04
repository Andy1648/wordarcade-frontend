// frameFx.test.js — the avatar frames' painted components: every frame maps to a tier + real art, each tier is its own
// structure (motes < corners < corners + orbit), small slots stay calm, and every breath is a finite transform/opacity
// one-shot that starts and ends invisible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAME_TIER, FRAME_SET, CLUSTER_SETS, clusterSrc, piecesFor, moteFrames, cornerFrames, orbitFrames, SMALL_PX, MOTE_MS, CORNER_MS, ORBIT_MS } from './frameFx.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

test('every frame has a tier and a colour set, and every cluster set ships its art', () => {
  for (const id of Object.keys(FRAME_TIER)) assert.ok(FRAME_SET[id], id);
  for (const s of CLUSTER_SETS) assert.ok(existsSync(join(PUBLIC, clusterSrc(s))), s);
  assert.equal(clusterSrc('nope'), '/fx/frame/cluster-cyan-v1.webp');
});

test('each tier is a different structure, stepping up; small slots wear less; no frame = nothing', () => {
  assert.deepEqual(piecesFor('frost'), { motes: 3, corners: 0, orbit: 0 });
  assert.deepEqual(piecesFor('bomb'), { motes: 0, corners: 4, orbit: 0 });
  assert.deepEqual(piecesFor('jackpot'), { motes: 0, corners: 4, orbit: 6 });
  assert.deepEqual(piecesFor('jackpot', SMALL_PX - 1), { motes: 0, corners: 2, orbit: 0 });
  assert.deepEqual(piecesFor('nope'), { motes: 0, corners: 0, orbit: 0 });
});

test('every breath is a finite transform/opacity one-shot, invisible at both ends', () => {
  for (const f of [moteFrames(0), moteFrames(1), moteFrames(2), cornerFrames(), orbitFrames()]) {
    assert.equal(f[0].opacity, 0);
    assert.equal(f[f.length - 1].opacity, 0);
    for (const k of f) for (const p of Object.keys(k)) assert.ok(['offset', 'opacity', 'transform', 'easing'].includes(p), p);
  }
  for (const ms of [MOTE_MS, CORNER_MS, ORBIT_MS]) assert.ok(ms > 0 && ms <= 2000);
});
