// shardPlan.test.js — the painted blade shards: every tier maps to real art, and a flight is a finite
// transform/opacity one-shot that points the blade's tip along its path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHARD_PIECES, SHARD_SETS, TIER_SETS, TIP_DEG, shardSrc, setSrc, bladeFrames, bladeFlavour, clearVectors, fitInside, edgeStart, SHARD_MS, SHARD_MAX } from './shardPlan.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public');

test('every set ships all its painted pieces', () => {
  for (const set of SHARD_SETS) {
    for (let i = 0; i < SHARD_PIECES; i += 1) assert.ok(existsSync(join(PUBLIC, 'fx', 'shards', `${set}-${i}.webp`)), `${set}-${i}`);
  }
});

test('each burst tier throws its own colours; mythic mixes pink + cyan; unknown falls back to epic', () => {
  assert.equal(shardSrc('epic', 0), '/fx/shards/violet-0.webp');
  assert.equal(shardSrc('legendary', 5), '/fx/shards/gold-1.webp');
  assert.equal(shardSrc('mythic', 0), '/fx/shards/pink-0.webp');
  assert.equal(shardSrc('mythic', 1), '/fx/shards/cyan-1.webp');
  assert.equal(shardSrc('secret', 3), '/fx/shards/prism-3.webp');
  assert.equal(shardSrc('nope', 2), '/fx/shards/violet-2.webp');
  for (const sets of Object.values(TIER_SETS)) for (const s of sets) assert.ok(SHARD_SETS.includes(s));
});

test('a flight is transform/opacity only, starts and ends invisible, and lands on its vector', () => {
  const f = bladeFrames({ x: 100, y: 0 }, { s: 1, turn: 0, drift: 0 });
  assert.equal(f[0].offset, 0);
  assert.equal(f[f.length - 1].offset, 1);
  assert.equal(f[0].opacity, 0);
  assert.equal(f[f.length - 1].opacity, 0);
  for (const k of f) for (const p of Object.keys(k)) assert.ok(['offset', 'opacity', 'transform', 'easing'].includes(p), p);
  assert.match(f[f.length - 1].transform, /^translate3d\(100px,0px,0\)/);
});

test('the blade tip points along the flight (sprite tip angle cancelled)', () => {
  // flying straight right (0deg) with piece 0: rotate = 0 - TIP_DEG[0]
  const f = bladeFrames({ x: 50, y: 0 }, { turn: 0, drift: 0, piece: 0 });
  assert.match(f[2].transform, new RegExp(`rotate\\(${-TIP_DEG[0]}deg\\)`));
  // flying straight up (-90deg)
  const up = bladeFrames({ x: 0, y: -50 }, { turn: 0, drift: 0, piece: 1 });
  assert.match(up[2].transform, new RegExp(`rotate\\(${-90 - TIP_DEG[1]}deg\\)`));
});

test('the travel snaps (most of the distance inside the first ~36 %)', () => {
  const f = bladeFrames({ x: 200, y: 0 }, { turn: 0, drift: 0 });
  const mid = f.find((k) => k.offset > 0.3 && k.offset < 0.4);
  assert.match(mid.transform, /^translate3d\(160px/);
});

test('flavour alternates sides so neighbours never spin the same way', () => {
  const a = bladeFlavour(0);
  const b = bladeFlavour(1);
  assert.ok(Math.sign(a.turn) !== Math.sign(b.turn));
  assert.ok(Math.sign(a.drift) !== Math.sign(b.drift));
  assert.equal(bladeFlavour(5).piece, 1);
});

test('clear vectors leave the card: every blade ends outside the box, by reach', () => {
  const [w, h] = [252, 420];
  const vs = clearVectors(14, w, h, { reach: [50, 150] });
  assert.equal(vs.length, 14);
  for (const v of vs) {
    // how far past the card's edge the blade lands, measured along its own ray
    const a = Math.atan2(v.y, v.x);
    const exit = Math.min(w / 2 / Math.abs(Math.cos(a) || 1e-6), h / 2 / Math.abs(Math.sin(a) || 1e-6));
    assert.ok(Math.hypot(v.x, v.y) - exit >= 48, JSON.stringify(v));
    assert.ok(Math.hypot(v.x, v.y) < Math.hypot(w / 2, h / 2) + 160, JSON.stringify(v));
    assert.ok(v.s >= 0.8 && v.s <= 1.2);
  }
  // spread all the way round: some up, some down, some left, some right
  assert.ok(vs.some((v) => v.y < -h / 2) && vs.some((v) => v.y > h / 2));
  assert.ok(vs.some((v) => v.x < -w / 2) && vs.some((v) => v.x > w / 2));
});

test('one strong idea: at most 14 blades, every flight under 600 ms', () => {
  assert.ok(SHARD_MAX >= 8 && SHARD_MAX <= 14);
  assert.ok(SHARD_MS < 600);
});

test('a named set picks its own art; an unknown set is violet', () => {
  assert.equal(setSrc('gold', 6), '/fx/shards/gold-2.webp');
  assert.equal(setSrc('nope', 1), '/fx/shards/violet-1.webp');
});

test('fitInside keeps every blade on screen (direction kept, reach shortened)', () => {
  const from = { x: 40, y: 60 };
  const vs = fitInside([{ x: -200, y: 0, s: 1 }, { x: 300, y: 0, s: 1 }, { x: 0, y: -200, s: 1 }, { x: -150, y: -150, s: 1 }], from, 390, 844, { pad: 20, min: 10 });
  assert.deepEqual(vs[1], { x: 300, y: 0, s: 1 }); // room to the right: untouched
  for (const v of vs) {
    assert.ok(from.x + v.x >= 20 - 0.5 && from.x + v.x <= 370 + 0.5, JSON.stringify(v));
    assert.ok(from.y + v.y >= 20 - 0.5 && from.y + v.y <= 824 + 0.5, JSON.stringify(v));
  }
  assert.ok(vs[0].x < 0 && vs[0].y === 0); // still flies left
});

test('edgeStart: a blade starts where its ray leaves the box (never inside the face), before its end', () => {
  const [w, h] = [200, 280];
  for (const v of clearVectors(10, w, h, { reach: [30, 100] })) {
    const e = edgeStart(v, w, h);
    const onRim = Math.abs(Math.abs(e.x) - w / 2) <= 1 || Math.abs(Math.abs(e.y) - h / 2) <= 1;
    assert.ok(onRim, JSON.stringify({ v, e }));
    assert.ok(Math.hypot(e.x, e.y) < Math.hypot(v.x, v.y));
  }
  assert.deepEqual(edgeStart({ x: 300, y: 0 }, 200, 280), { x: 100, y: 0 });
});

test('an arc fans the blades over that arc only (a burst that must stay ABOVE the text under it)', () => {
  const vs = clearVectors(12, 150, 150, { reach: [40, 120], arc: [-Math.PI * 0.95, -Math.PI * 0.05] });
  assert.equal(vs.length, 12);
  for (const v of vs) assert.ok(v.y < 0, JSON.stringify(v)); // every blade flies upward
  assert.ok(vs.some((v) => v.x < -60) && vs.some((v) => v.x > 60)); // still a wide fan
});

test('the Aamon orbit: forms on a ring OUTSIDE the card, laps it tip-first, then lashes out and fades', async () => {
  const { orbitLashFrames } = await import('./shardPlan.js');
  const [w, h] = [252, 420];
  for (let i = 0; i < 12; i += 1) {
    const f = orbitLashFrames(i, 12, w, h, { reach: 120 });
    assert.equal(f[0].offset, 0);
    assert.equal(f[0].opacity, 0);
    assert.equal(f[f.length - 1].offset, 1);
    assert.equal(f[f.length - 1].opacity, 0);
    for (let k = 1; k < f.length; k += 1) assert.ok(f[k].offset > f[k - 1].offset, `offsets rise ${i}`);
    for (const k of f) for (const p of Object.keys(k)) assert.ok(['offset', 'opacity', 'transform', 'easing'].includes(p), p);
    const pos = f.map((k) => k.transform.match(/translate3d\((-?[\d.]+)px,(-?[\d.]+)px/).slice(1).map(Number));
    // every ring point sits outside the card's box (it circles the card, never crosses its face)
    for (const [x, y] of pos) assert.ok(Math.abs(x) > w / 2 || Math.abs(y) > h / 2, `${i}: ${x},${y}`);
    // the lash ends farther out than the lap
    const d = ([x, y]) => Math.hypot(x, y);
    assert.ok(d(pos[pos.length - 1]) > d(pos[pos.length - 3]) + 100);
    // rotation is continuous (no 360° snaps between keyframes)
    const rots = f.map((k) => Number(k.transform.match(/rotate\((-?[\d.]+)deg/)[1]));
    for (let k = 1; k < rots.length; k += 1) assert.ok(Math.abs(rots[k] - rots[k - 1]) <= 150, `${i}: ${rots}`);
  }
});
