// revealPlan.test.js — MARK ROLL reveal timing + HOLD-TO-ROLL pacing (Andy H3; oct3 review hybrid), and the
// animation-budget rules for the timelines (finite, transform/opacity only, inside the reveal window).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  revealMs, MAX_REVEAL_MS, HOLD_GAP_MS, isHeavy, holdStopReason, createPacer, minHeldIntervalMs, needMoreText,
} from './revealPlan.js';
import { timeline, cutsceneBeats } from './revealTimelines.js';

const TIERS = ['common', 'rare', 'epic', 'legendary'];
const plain = { tier: 'common', newMark: false, goldUp: false, rainbowUp: false, decision: 'none' };

test('rarity scales the reveal: common ≈300 ms, rare short, epic/legendary ≤ 2.5 s', () => {
  assert.ok(revealMs('common') >= 250 && revealMs('common') <= 350);
  assert.ok(revealMs('rare') > revealMs('common') && revealMs('rare') <= 1000);
  assert.ok(revealMs('epic') > revealMs('rare'));
  assert.ok(revealMs('legendary') >= revealMs('epic'));
  for (const t of TIERS) assert.ok(revealMs(t) <= MAX_REVEAL_MS);
  assert.equal(isHeavy('epic'), true);
  assert.equal(isHeavy('legendary'), true);
  assert.equal(isHeavy('rare'), false);
});

test('hold-to-roll: never faster than one roll per FINISHED reveal', () => {
  const p = createPacer();
  let rolls = 0;
  const starts = [];
  for (let t = 0; t <= 10000; t += 10) {
    if (rolls === 0 || p.holdStep(t, true, plain) === 'roll') {
      if (!p.canRoll(t)) continue;
      p.start(t, 'common');
      starts.push(t);
      rolls += 1;
    }
  }
  for (let i = 1; i < starts.length; i += 1) {
    const gap = starts[i] - starts[i - 1];
    assert.ok(gap >= revealMs('common'), `roll ${i} started ${gap} ms after the last — before its reveal ended`);
    assert.ok(gap >= minHeldIntervalMs(), `held rhythm keeps the ${HOLD_GAP_MS} ms beat`);
  }
  assert.ok(rolls > 5, `a held button does keep rolling (${rolls})`);
});

test('hold-to-roll: a slower (rarer) reveal pushes the next roll back; a mid-reveal tap skips, never rolls', () => {
  const p = createPacer();
  p.start(0, 'rare');
  assert.equal(p.holdStep(revealMs('rare') - 1, true, { ...plain, tier: 'rare' }), 'wait');
  assert.equal(p.holdStep(revealMs('rare') + HOLD_GAP_MS, true, { ...plain, tier: 'rare' }), 'roll');
  assert.equal(p.canRoll(10), false, 'a tap mid-reveal does not roll');
  p.finishNow(10);
  assert.equal(p.canRoll(10), true, 'a tap mid-reveal skips to the result; the next tap rolls');
});

test('hold-to-roll stops on EPIC+, a NEW mark, GOLD/RAINBOW, or a short balance — never on an equip', () => {
  assert.equal(holdStopReason(plain), null);
  assert.equal(holdStopReason({ ...plain, decision: 'auto' }), null, 'an auto-equip never stalls a hold');
  assert.equal(holdStopReason({ ...plain, tier: 'epic' }), 'heavy');
  assert.equal(holdStopReason({ ...plain, tier: 'legendary' }), 'heavy');
  assert.equal(holdStopReason({ ...plain, newMark: true }), 'new');
  assert.equal(holdStopReason({ ...plain, goldUp: true }), 'variant');
  assert.equal(holdStopReason({ ...plain, rainbowUp: true }), 'variant');
  assert.equal(holdStopReason(plain, { canAfford: false }), 'broke');
  const p = createPacer();
  p.start(0, 'common');
  assert.equal(p.holdStep(5000, true, { ...plain, newMark: true }), 'stop');
  assert.equal(p.holdStep(5000, false, plain), 'stop', 'letting go stops');
  assert.equal(needMoreText(300, 120.4, (n) => String(n)), 'NEED 180 MORE WINS');
  assert.equal(needMoreText(300, 299.5), 'NEED 1 MORE WINS');
});

test('timelines: finite, transform/opacity ONLY, every step inside the reveal window, every flip fades out', () => {
  for (const tier of TIERS) {
    const D = revealMs(tier);
    const steps = timeline(tier);
    assert.ok(steps.length > 0, `${tier} has a timeline`);
    for (const s of steps) {
      assert.ok(Number.isFinite(s.duration) && s.duration > 0, `${tier} ${s.node}: finite duration`);
      assert.ok(s.delay >= 0 && s.delay + s.duration <= D + 1, `${tier} ${s.node}: ends by ${D} ms (${s.delay}+${s.duration})`);
      assert.equal(s.iterations, undefined, 'never repeats');
      let last = 0;
      for (const f of s.frames) {
        for (const k of Object.keys(f)) assert.ok(['transform', 'opacity', 'offset', 'easing'].includes(k), `${tier} ${s.node}: animates ${k}`);
        if (f.offset != null) { assert.ok(f.offset >= last && f.offset <= 1, `${tier} ${s.node}: offsets climb`); last = f.offset; }
        // THE STRAY DOT: anything squeezed to (near) zero width must be invisible
        if (/scale\(0(\.0\d*)?,/.test(f.transform || '') || /scaleX\(0\)/.test(f.transform || '')) {
          assert.equal(f.opacity, 0, `${tier} ${s.node}: a node at ${f.transform} must be at opacity 0`);
        }
      }
    }
    assert.equal(steps.some((s) => s.node === 'cover'), isHeavy(tier), `${tier}: cutscene only for heavy tiers`);
    const card = steps.filter((s) => s.node === 'card').pop();
    assert.equal(card.frames[card.frames.length - 1].opacity, 1, `${tier}: the card lands`);
  }
});

test('the cutscene order: ladder → FINAL tier → the mark (art + name) → "1 IN X" → back to the panel', () => {
  for (const tier of ['epic', 'legendary']) {
    const b = cutsceneBeats(tier);
    assert.ok(b.finalAt < b.showAt && b.showAt < b.stampAt && b.stampAt + 300 <= b.outAt && b.outAt < b.D, `${tier} beats in order`);
    assert.equal(b.below, tier === 'epic' ? 2 : 3, 'one ladder bar per tier below');
    const nodes = timeline(tier).map((s) => s.node);
    for (const n of ['cover', 'ladder', 'final', 'show', 'stamp', 'card']) assert.ok(nodes.includes(n), `${tier} plays ${n}`);
  }
});

test('reduced motion: no animation — the hold time is identical', () => {
  for (const tier of TIERS) {
    assert.deepEqual(timeline(tier, true), []);
    const p = createPacer();
    p.start(0, tier);
    assert.equal(p.canRoll(revealMs(tier) - 1), false);
    assert.equal(p.canRoll(revealMs(tier)), true);
  }
});
