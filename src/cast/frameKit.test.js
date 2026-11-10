// frameKit.test.js — every avatar frame is built from its own painted parts (Andy nov9: "i dont see components"):
// art on disk, sane geometry, a face window inside the band, and only finite transform/opacity acts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FRAMES } from './kit.js';
import { FRAME_KIT, FRAME_ACTS, frameKitOf, kitPieces, kitWindow } from './frameKit.js';

const art = (src) => fs.existsSync(new URL(`../../public${src}`, import.meta.url));

test('every frame has a kit: its own corner, bar and props, all painted', () => {
  const corners = new Set();
  for (const f of FRAMES) {
    const k = frameKitOf(f.id);
    assert.ok(k, `${f.id} has no kit`);
    for (const src of [k.corner, k.bar, k.cornerB, ...k.parts.map((p) => p.src)].filter(Boolean)) assert.ok(art(src), `${f.id}: ${src} missing`);
    assert.ok(k.parts.length >= 1, `${f.id} has no prop of its own`);
    assert.ok(!corners.has(k.corner), `${f.id} reuses another frame's corner`); corners.add(k.corner);
    if (k.cornerB) assert.ok(k.geoB, `${f.id} cornerB without geoB`);
  }
  assert.equal(frameKitOf('../evil'), null);
});

test('the pieces stay in the box and the face window sits inside the band', () => {
  for (const [id, k] of Object.entries(FRAME_KIT)) {
    const ps = kitPieces(k);
    assert.equal(ps.filter((p) => p.kind === 'corner').length, 4, id);
    assert.equal(ps.filter((p) => p.kind === 'bar').length, 4, id);
    for (const p of ps.filter((q) => q.kind === 'bar')) assert.ok(p.w > 0 && p.h > 0, `${id} bar collapsed`);
    const [cx, cy, r] = kitWindow(k);
    assert.ok(r >= 25 && cx - r >= 0 && cx + r <= 100 && cy - r >= 0 && cy + r <= 100, `${id} window ${r}`);
    for (const p of k.parts) assert.ok(FRAME_ACTS[p.act], `${id} prop act ${p.act}`);
  }
});

test('every act is a short finite one-shot of transform / opacity only', () => {
  for (const [name, a] of Object.entries(FRAME_ACTS)) {
    assert.ok(a.ms > 0 && a.ms <= 800, `${name} ${a.ms}ms`);
    for (const fr of a.frames) for (const key of Object.keys(fr)) assert.ok(['transform', 'opacity', 'offset'].includes(key), `${name} animates ${key}`);
  }
});
