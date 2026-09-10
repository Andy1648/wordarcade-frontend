// bootReady.test.js (perf/first-load) — the boot screen's readiness gate + fuse curve.
import test from 'node:test';
import assert from 'node:assert/strict';
import { appReady, markAppReady, bootReady, fontsReady, fuseProgress, FLOOR_MS, HARD_CAP_MS, HANDOFF_MS } from './bootReady.js';

test('constants: 700 ms floor, 5000 ms hard cap, 600 ms handoff', () => {
  assert.equal(FLOOR_MS, 700);
  assert.equal(HARD_CAP_MS, 5000);
  assert.equal(HANDOFF_MS, 600);
});

test('fontsReady resolves immediately without a document (no Font Loading API)', async () => {
  await fontsReady(); // node has no `document` — must not throw or hang
});

test('bootReady waits for markAppReady, then resolves (and never rejects)', async () => {
  let settled = false;
  const p = bootReady().then(() => { settled = true; });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(settled, false, 'not ready before App mounts');
  markAppReady();
  await p;
  assert.equal(settled, true);
  await appReady; // idempotent
  markAppReady(); // a second call is harmless
});

test('fuseProgress: brisk to 70% over the floor, creeps to 95% by the cap, never past 95 on its own', () => {
  assert.equal(fuseProgress(0), 0);
  assert.ok(Math.abs(fuseProgress(FLOOR_MS / 2) - 35) < 1e-9);
  assert.equal(fuseProgress(FLOOR_MS), 70);
  assert.ok(fuseProgress(FLOOR_MS + 1) > 70);
  assert.ok(fuseProgress(2000) > 70 && fuseProgress(2000) < 95);
  assert.equal(fuseProgress(HARD_CAP_MS), 95);
  assert.equal(fuseProgress(HARD_CAP_MS * 3), 95);
  // monotonic
  let prev = -1;
  for (let t = 0; t <= 6000; t += 50) { const p = fuseProgress(t); assert.ok(p >= prev); prev = p; }
});
