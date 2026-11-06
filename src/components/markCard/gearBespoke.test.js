// gearBespoke.test.js — BESPOKE stays per gear: real ids only, never a whole rarity; every part's art exists and stays inside the
// frame box (the 24px border room e2e/gear-borders.spec.js holds); every act is finite and transform-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GEAR_BESPOKE, BESPOKE_ACTS, bespokeOf } from './gearBespoke.js';
import { ROLL_MARKS } from '../../progress/markRollsCore.js';

test('bespoke is a few single gears: real ids, never every gear of a tier', () => {
  for (const id of Object.keys(GEAR_BESPOKE)) {
    const m = ROLL_MARKS.find((x) => x.id === id);
    assert.ok(m, `${id} is a gear`);
    const peers = ROLL_MARKS.filter((x) => x.tier === m.tier);
    assert.ok(peers.some((x) => !GEAR_BESPOKE[x.id]), `all of ${m.tier} is bespoke: that is a rarity treatment`);
  }
  assert.equal(bespokeOf('mk-nope'), null);
  assert.equal(bespokeOf('constructor'), null);
});

test('each part: art on disk, inside the frame box, an act that is finite + transform only', () => {
  for (const [id, spec] of Object.entries(GEAR_BESPOKE)) {
    assert.ok(spec.parts.length >= 1, id);
    for (const p of spec.parts) {
      assert.ok(fs.existsSync(new URL(`../../../public${p.src}`, import.meta.url)), `${p.src} missing`);
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 100.01, `${p.src} leaves the frame box`);
      const act = BESPOKE_ACTS[p.act || spec.act];
      assert.ok(act && act.ms > 0 && act.ms <= 700, `${id} act`);
      for (const f of act.frames) assert.deepEqual(Object.keys(f).filter((k) => k !== 'offset'), ['transform']);
    }
  }
});
