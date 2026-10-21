// castFrames.test.js — every painted flipbook ships every frame it plays (a 6-frame spec over a 4-frame sheet would
// flash a broken image mid-loop: GOLD members borrow their member's beat, so a member re-painted at 6 frames must not
// drag its 4-frame GOLD along). Specs are module-level objects, so components can key effects on them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAST_FRAMES, CAST_WIN_FRAMES, castFrames } from './cast.js';

const has = (f) => fs.existsSync(new URL(`../../public/cast/anim/${f}.webp`, import.meta.url));

test('every HERO flipbook frame exists, and every step names a real frame', () => {
  for (const [id, F] of Object.entries(CAST_FRAMES)) {
    for (let k = 0; k < F.n; k++) assert.ok(has(`${id}-${k}`), `${id}-${k}.webp missing`);
    for (const [f, ms] of F.seq) assert.ok(f >= 0 && f < F.n && ms > 0, `${id}: bad step ${f}/${ms}`);
  }
});

test('every WIN flipbook frame exists', () => {
  for (const [id, F] of Object.entries(CAST_WIN_FRAMES)) for (let k = 0; k < F.n; k++) assert.ok(has(`${id}-win-${k}`), `${id}-win-${k}.webp missing`);
});

test('castFrames returns the SAME object every call (stable effect deps under App re-render churn)', () => {
  assert.equal(castFrames('riot'), castFrames('riot'));
  assert.equal(castFrames('riot', 'win'), castFrames('riot', 'win'));
  assert.equal(castFrames('riot', 'ko'), null);
});
