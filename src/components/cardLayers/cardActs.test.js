// cardActs.test.js — the card acts stay inside the animation budget and only move layers that exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTS, actLength, ACT_REST_MS, ACT_GAP_MS } from './cardActs.js';
import { GAMES } from '../../gameData.js';

test('every act moves only transform / opacity, finitely', () => {
  for (const [name, steps] of Object.entries(ACTS)) {
    for (const s of steps) {
      assert.ok(Number.isFinite(s.ms) && s.ms > 0 && s.ms <= 1200, `${name}.${s.el} duration`);
      for (const f of s.frames) {
        for (const k of Object.keys(f)) assert.ok(['transform', 'opacity', 'offset'].includes(k), `${name}.${s.el} animates ${k}`);
      }
    }
    assert.ok(actLength(name) < ACT_REST_MS, `${name} finishes long before it may play again`);
  }
  assert.ok(ACT_GAP_MS >= 2000, 'one act at a time across the grid');
});

test('every act step names the hero or a part its card paints, and every part rests invisible on a real asset', () => {
  for (const g of GAMES) {
    const L = g.artLayers;
    if (!L || !L.act) continue;
    assert.ok(ACTS[L.act], `${g.id} act ${L.act} exists`);
    const ids = new Set((L.parts || []).map((p) => p.id));
    assert.equal(ids.size, (L.parts || []).length, `${g.id} part ids are unique`);
    for (const s of ACTS[L.act]) assert.ok(s.el === 'hero' || ids.has(s.el), `${g.id} act moves ${s.el}`);
    for (const p of L.parts) assert.match(p.src, /^\/cards\/.+\.webp$/, `${g.id}.${p.id} is a painted asset`);
  }
});

test('a part fades out at the end of its burst / fling (no fill, so it returns to its resting opacity 0)', () => {
  for (const steps of Object.values(ACTS)) {
    for (const s of steps) {
      if (s.el === 'hero') continue;
      assert.equal(s.frames[s.frames.length - 1].opacity, 0);
    }
  }
});
