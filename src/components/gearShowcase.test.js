// gearShowcase.test.js — the YOUR GEAR showcase stays a finite, transform-only one-shot that fits its cadence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOWCASE_EVERY_MS, showcasePlan, popFrames, punchFrames } from './gearShowcase.js';

const TIERS = ['epic', 'legendary', 'mythic', 'secret'];
const scaleOf = (frames) => Math.max(...frames.map((f) => Number((/scale\(([\d.]+)\)/.exec(f.transform) || [0, 1])[1])));

test('every run ends well inside its cadence (6–8 s), so runs never overlap', () => {
  for (const t of TIERS) {
    const every = SHOWCASE_EVERY_MS[t];
    assert.ok(every >= 6000 && every <= 8000, `${t}: ${every}`);
    const p = showcasePlan(t);
    const end = Math.max(p.pop.at + p.pop.ms, p.punch.at + p.punch.ms, p.sheen ? p.sheen.at + p.sheen.ms : 0, p.ring ? p.ring.at + p.ring.ms : 0, p.flash ? p.flash.at + p.flash.ms : 0);
    assert.ok(end < every / 3, `${t} run ${end} ms`);
  }
});

test('frames are transform-only and come back to rest', () => {
  for (const t of TIERS) {
    for (const frames of [popFrames(t), punchFrames(t)]) {
      for (const f of frames) assert.deepEqual(Object.keys(f).filter((k) => k !== 'offset'), ['transform']);
      assert.match(frames[0].transform, /scale\(1\)/);
      assert.match(frames[frames.length - 1].transform, /scale\(1\)/);
    }
  }
});

test('the ladder: epic is the lighter version; legendary+ flare and sweep; louder tiers pop bigger', () => {
  assert.equal(showcasePlan('epic').flare, null);
  assert.equal(showcasePlan('epic').sheen, null);
  for (const t of ['legendary', 'mythic', 'secret']) {
    assert.equal(showcasePlan(t).flare, 0);
    assert.ok(showcasePlan(t).sheen);
  }
  assert.ok(scaleOf(popFrames('epic')) < scaleOf(popFrames('legendary')));
  assert.ok(scaleOf(popFrames('legendary')) < scaleOf(popFrames('mythic')));
  assert.ok(scaleOf(punchFrames('epic')) < scaleOf(punchFrames('legendary')));
});
