// revealPlan.test.js — MARK ROLL reveal timing + HOLD-TO-ROLL pacing (Andy H3), and the animation-budget
// rules for the three reveal timelines (finite, transform/opacity only, inside the reveal window).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REVEAL_VERSIONS, revealVersion, revealMs, MAX_REVEAL_MS, HOLD_GAP_MS, isHeavy, holdStopReason, createPacer,
  minHeldIntervalMs,
} from './revealPlan.js';
import { timeline, REEL_SLOTS } from './revealTimelines.js';

const TIERS = ['common', 'rare', 'epic', 'legendary'];
const plain = { tier: 'common', newMark: false, goldUp: false, rainbowUp: false, decision: 'none' };

test('versions: ?mrv=a|b|c, default a, junk → a', () => {
  assert.deepEqual(REVEAL_VERSIONS, ['a', 'b', 'c']);
  assert.equal(revealVersion(''), 'a');
  assert.equal(revealVersion('?mrv=b'), 'b');
  assert.equal(revealVersion('?x=1&mrv=c'), 'c');
  assert.equal(revealVersion('?mrv=z'), 'a');
});

test('rarity scales the reveal: common ≈300 ms, rare short, epic/legendary ≤ 2.5 s', () => {
  for (const v of REVEAL_VERSIONS) {
    assert.ok(revealMs('common', v) >= 250 && revealMs('common', v) <= 350, `${v} common ≈300`);
    assert.ok(revealMs('rare', v) > revealMs('common', v) && revealMs('rare', v) <= 1000, `${v} rare is a short build-up`);
    assert.ok(revealMs('epic', v) > revealMs('rare', v), `${v} epic longer than rare`);
    assert.ok(revealMs('legendary', v) >= revealMs('epic', v), `${v} legendary ≥ epic`);
    for (const t of TIERS) assert.ok(revealMs(t, v) <= MAX_REVEAL_MS, `${v} ${t} ≤ 2.5 s`);
  }
  assert.equal(isHeavy('epic'), true);
  assert.equal(isHeavy('legendary'), true);
  assert.equal(isHeavy('rare'), false);
});

test('hold-to-roll: never faster than one roll per FINISHED reveal', () => {
  for (const v of REVEAL_VERSIONS) {
    const p = createPacer();
    let t = 0;
    let rolls = 0;
    const starts = [];
    // a 10 s hold over a run of plain commons, polled every 10 ms
    for (; t <= 10000; t += 10) {
      if (p.holdStep(t, true, rolls ? plain : null) === 'roll' || rolls === 0) {
        if (!p.canRoll(t)) continue;
        p.start(t, 'common', v);
        starts.push(t);
        rolls += 1;
      }
    }
    for (let i = 1; i < starts.length; i += 1) {
      const gap = starts[i] - starts[i - 1];
      assert.ok(gap >= revealMs('common', v), `${v}: roll ${i} started ${gap} ms after the last — before its reveal ended`);
      assert.ok(gap >= minHeldIntervalMs(v), `${v}: held rhythm keeps the ${HOLD_GAP_MS} ms beat`);
    }
    assert.ok(rolls > 5, `${v}: a held button does keep rolling (${rolls})`);
  }
});

test('hold-to-roll: a slower (rarer) reveal pushes the next roll back by its own length', () => {
  const p = createPacer();
  p.start(0, 'rare', 'a');
  assert.equal(p.holdStep(revealMs('rare', 'a') - 1, true, { ...plain, tier: 'rare' }), 'wait');
  assert.equal(p.holdStep(revealMs('rare', 'a') + HOLD_GAP_MS, true, { ...plain, tier: 'rare' }), 'roll');
  assert.equal(p.canRoll(10), false, 'a tap mid-reveal does not roll');
  p.finishNow(10);
  assert.equal(p.canRoll(10), true, 'a tap mid-reveal skips to the result; the next tap rolls');
});

test('hold-to-roll stops on EPIC+, a NEW mark, GOLD/RAINBOW, an EQUIP? question, or a short balance', () => {
  assert.equal(holdStopReason(plain), null);
  assert.equal(holdStopReason({ ...plain, tier: 'epic' }), 'heavy');
  assert.equal(holdStopReason({ ...plain, tier: 'legendary' }), 'heavy');
  assert.equal(holdStopReason({ ...plain, newMark: true }), 'new');
  assert.equal(holdStopReason({ ...plain, goldUp: true }), 'variant');
  assert.equal(holdStopReason({ ...plain, rainbowUp: true }), 'variant');
  assert.equal(holdStopReason({ ...plain, decision: 'ask' }), 'ask');
  assert.equal(holdStopReason(plain, { canAfford: false }), 'broke');
  const p = createPacer();
  p.start(0, 'common', 'a');
  assert.equal(p.holdStep(5000, true, { ...plain, newMark: true }), 'stop');
  assert.equal(p.holdStep(5000, false, plain), 'stop', 'letting go stops');
});

test('timelines: finite, transform/opacity ONLY, every step inside the reveal window', () => {
  for (const v of REVEAL_VERSIONS) {
    for (const tier of TIERS) {
      const D = revealMs(tier, v);
      const steps = timeline(v, tier);
      assert.ok(steps.length > 0, `${v} ${tier} has a timeline`);
      for (const s of steps) {
        assert.ok(Number.isFinite(s.duration) && s.duration > 0, `${v} ${tier} ${s.node}: finite duration`);
        assert.ok(s.delay >= 0 && s.delay + s.duration <= D + 1, `${v} ${tier} ${s.node}: ends by ${D} ms (${s.delay}+${s.duration})`);
        assert.equal(s.iterations, undefined, 'never repeats');
        for (const f of s.frames) {
          for (const k of Object.keys(f)) assert.ok(['transform', 'opacity', 'offset', 'easing'].includes(k), `${v} ${tier} ${s.node}: animates ${k}`);
          if (f.offset != null) assert.ok(f.offset >= 0 && f.offset <= 1);
        }
      }
      // only EPIC+ uses the cutscene layer (one heavy moment)
      const usesCover = steps.some((s) => s.node === 'cover');
      assert.equal(usesCover, isHeavy(tier), `${v} ${tier}: cover only for heavy tiers`);
      if (isHeavy(tier)) assert.ok(steps.some((s) => s.node === 'stamp'), `${v} ${tier}: stamps 1 IN X`);
      // the result card always ends visible
      const card = steps.filter((s) => s.node === 'card').sort((a, b) => (a.delay + a.duration) - (b.delay + b.duration)).pop();
      assert.ok(card && card.frames[card.frames.length - 1].opacity === 1, `${v} ${tier}: the card lands`);
    }
  }
  assert.equal(REEL_SLOTS, 6);
});

test('reduced motion: no animation — the static card holds for the same time', () => {
  for (const v of REVEAL_VERSIONS) {
    for (const tier of TIERS) {
      assert.deepEqual(timeline(v, tier, true), []);
      const p = createPacer();
      p.start(0, tier, v); // the pacer does not know about motion — the hold time is identical
      assert.equal(p.canRoll(revealMs(tier, v) - 1), false);
      assert.equal(p.canRoll(revealMs(tier, v)), true);
    }
  }
});
