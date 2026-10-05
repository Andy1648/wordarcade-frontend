// revealPlan.test.js — MARK ROLL reveal timing + HOLD-TO-ROLL pacing (Andy H3; oct3 review hybrid), and the
// animation-budget rules for the timelines (finite, transform/opacity only, inside the reveal window).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  revealMs, MAX_REVEAL_MS, HOLD_GAP_MS, isHeavy, holdStopReason, createPacer, minHeldIntervalMs, needMoreText,
  revealKind, revealVersion, REVEAL_VERSIONS, bestIndex, multiPlan, multiPrice, MULTI_STAGGER_MS, MULTI_FLIP_MS, HEAVY_MS,
} from './revealPlan.js';
import { timeline, multiTimeline, coverBeats, reelStop, LADDER, PARTICLES } from './revealTimelines.js';

const TIERS = ['common', 'rare', 'epic', 'legendary', 'mythic', 'secret'];
const plain = { tier: 'common', newMark: false, goldUp: false, rainbowUp: false, decision: 'none' };

test('rarity scales the reveal: common ≈300 ms, rare in the panel, LEGENDARY+ full-screen ≤ 3 s', () => {
  assert.ok(revealMs('common') >= 250 && revealMs('common') <= 350);
  assert.ok(revealMs('rare') > revealMs('common') && revealMs('rare') <= 1000);
  assert.ok(revealMs('epic') > revealMs('rare'));
  for (let i = 1; i < TIERS.length; i += 1) assert.ok(revealMs(TIERS[i]) >= revealMs(TIERS[i - 1]), TIERS[i]);
  for (const t of TIERS) assert.ok(revealMs(t) <= MAX_REVEAL_MS);
  assert.ok(MAX_REVEAL_MS <= 3000);
  assert.equal(isHeavy('epic'), false, 'an EPIC reveals in the panel');
  for (const t of ['legendary', 'mythic', 'secret']) assert.equal(isHeavy(t), true, t);
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
  assert.equal(holdStopReason({ ...plain, tier: 'secret' }), 'heavy');
  assert.equal(holdStopReason({ ...plain, newMark: true }), 'new');
  assert.equal(holdStopReason({ ...plain, goldUp: true }), 'variant');
  assert.equal(holdStopReason({ ...plain, rainbowUp: true }), 'variant');
  assert.equal(holdStopReason(plain, { canAfford: false }), 'broke');
  const p = createPacer();
  p.start(0, 'common');
  assert.equal(p.holdStep(5000, true, { ...plain, newMark: true }), 'stop');
  assert.equal(p.holdStep(5000, false, plain), 'stop', 'letting go stops');
  assert.equal(needMoreText(300, 120.4, (n) => String(n)), 'NEED 180 MORE GEMS');
  assert.equal(needMoreText(300, 299.5), 'NEED 1 MORE GEMS');
});

/** The animation-budget rules every step list must keep (finite, transform/opacity only, inside `D`). */
function checkSteps(steps, D, label) {
  for (const s of steps) {
    assert.ok(Number.isFinite(s.duration) && s.duration > 0, `${label} ${s.node}: finite duration`);
    assert.ok(s.delay >= 0 && s.delay + s.duration <= D + 1, `${label} ${s.node}: ends by ${D} ms (${s.delay}+${s.duration})`);
    assert.equal(s.iterations, undefined, 'never repeats');
    let last = 0;
    for (const f of s.frames) {
      for (const k of Object.keys(f)) assert.ok(['transform', 'opacity', 'offset', 'easing'].includes(k), `${label} ${s.node}: animates ${k}`);
      if (f.offset != null) { assert.ok(f.offset >= last && f.offset <= 1, `${label} ${s.node}: offsets climb`); last = f.offset; }
      if (/scale\(0(\.0\d*)?,/.test(f.transform || '') || /scaleX\(0\)/.test(f.transform || '')) {
        assert.equal(f.opacity, 0, `${label} ${s.node}: a node at ${f.transform} must be at opacity 0`);
      }
    }
  }
  // ONE step per node at most when the steps are whole-window tracks (two would fight over the transform)
  const tracks = steps.filter((s) => s.delay === 0 && s.duration === D).map((s) => s.node);
  assert.equal(new Set(tracks).size, tracks.length, `${label}: one whole-window track per node (${tracks})`);
}

test('ANDY SPEC per tier: COMMON pop, RARE colour flash, EPIC dims + burst, LEGENDARY+ full-screen 1.5 s — in all three versions', () => {
  assert.deepEqual(TIERS.map(revealKind), ['pop', 'flash', 'burst', 'full', 'full', 'full']);
  for (const t of ['legendary', 'mythic', 'secret']) assert.equal(revealMs(t), 1500, `${t}: 1.5 s`);
  assert.equal(HEAVY_MS, 1500);
  for (const v of REVEAL_VERSIONS) {
    for (const tier of TIERS) {
      const steps = timeline(tier, false, v);
      const D = revealMs(tier);
      const nodes = new Set(steps.map((s) => s.node));
      const at = (n) => steps.find((s) => s.node === n);
      const peak = (n) => Math.max(...(at(n) ? at(n).frames.map((f) => (f.opacity == null ? 0 : f.opacity)) : [0]));
      checkSteps(steps, D, `${v}/${tier}`);
      const card = steps.filter((s) => s.node === 'card').pop();
      assert.equal(card.frames[card.frames.length - 1].opacity, 1, `${v}/${tier}: the card lands`);
      const kind = revealKind(tier);
      // the cover (full-screen layer) plays for EPIC+ only
      assert.equal(nodes.has('cover'), kind === 'burst' || kind === 'full', `${v}/${tier}: cover only for EPIC+`);
      if (kind === 'pop') assert.ok(!nodes.has('flash') || peak('flash') === 0, `${v}/common: no flash, a small pop`);
      if (kind === 'flash') assert.ok(peak('flash') >= 0.8, `${v}/rare: a colour flash`);
      if (kind === 'burst') {
        assert.ok(peak('dim') > 0.5 && peak('plate') === 0, `${v}/epic: the screen DIMS (no rarity plate)`);
        assert.ok(peak('stamp') === 0, `${v}/epic: no full-screen stamp`);
      }
      if (kind === 'full') {
        assert.ok(peak('plate') === 1 && peak('dim') === 0, `${v}/${tier}: the rarity colour fills the screen`);
        assert.ok(peak('stamp') === 1, `${v}/${tier}: "1 IN X" lands`);
        assert.ok(peak('show') === 1, `${v}/${tier}: the mark lands`);
      }
      if (kind === 'burst' || kind === 'full') {
        for (let i = 0; i < PARTICLES; i += 1) {
          const p = at(`p${i}`);
          assert.ok(p && peak(`p${i}`) === 1, `${v}/${tier}: particle ${i} bursts`);
          assert.equal(p.frames[p.frames.length - 1].opacity, 0, `${v}/${tier}: particle ${i} ends hidden`);
        }
      }
    }
  }
});

test('the three versions really differ: a slams + shakes, b turns over a ray fan, c spins a reel + tears a pack', () => {
  const nodes = (v, t) => new Set(timeline(t, false, v).map((s) => s.node));
  assert.ok(nodes('a', 'legendary').has('cshake') && nodes('a', 'rare').has('shake'));
  assert.ok(timeline('legendary', false, 'a').find((s) => s.node === 'stamp').frames.some((f) => /scale\(3\)/.test(f.transform || '')), 'a: the stamp slams from 3x');
  const rays = timeline('legendary', false, 'b').find((s) => s.node === 'rays');
  assert.ok(rays.frames.some((f) => f.opacity === 1), 'b: the ray fan opens');
  assert.ok(nodes('b', 'rare').has('srays'));
  for (const t of TIERS) {
    const tl = timeline(t, false, 'c');
    const reel = tl.find((s) => s.node === (revealKind(t) === 'burst' || revealKind(t) === 'full' ? 'reel' : 'sreel'));
    assert.ok(reel, `c/${t}: a reel`);
    assert.ok(reel.frames.some((f) => f.transform === `translateY(${reelStop(t).toFixed(3)}%)`), `c/${t}: the reel LANDS on ${t}`);
  }
  assert.ok(timeline('mythic', false, 'c').find((s) => s.node === 'packL').frames.some((f) => /translateX\(-70%\)/.test(f.transform || '')), 'c: the pack tears open');
  // the reel stop is in the 2nd lap and walks one row per tier
  assert.ok(reelStop('common') < -40 && reelStop('secret') > -100);
  assert.ok(Math.abs((reelStop('rare') - reelStop('common')) - (-100 / (LADDER.length * 2))) < 1e-9);
});

test('?mrv= picks the version (a | b | c), anything else falls back to the default', () => {
  assert.equal(revealVersion('?mrv=b'), 'b');
  assert.equal(revealVersion('?rolls=1&mrv=C'), 'c');
  assert.equal(revealVersion('?mrv=z'), 'a');
  assert.equal(revealVersion(''), 'a');
});

test('cover beats in order: mark → "1 IN X" → out, all inside 1.5 s', () => {
  for (const v of REVEAL_VERSIONS) {
    for (const tier of ['legendary', 'mythic', 'secret']) {
      const b = coverBeats(tier, v);
      assert.ok(b.showAt < b.stampAt && b.stampAt + 240 <= b.outAt && b.outAt < b.D, `${v}/${tier} beats in order`);
      assert.equal(b.full, true);
    }
    assert.equal(coverBeats('epic', v).full, false);
  }
});

test('SHINY: a one-shot gold sweep on the landed card, inside the window; never without shiny', () => {
  for (const v of REVEAL_VERSIONS) {
    for (const tier of TIERS) {
      assert.equal(timeline(tier, false, v).some((s) => s.node === 'shine'), false);
      const steps = timeline(tier, false, v, { shiny: true });
      const sh = steps.find((s) => s.node === 'shine');
      assert.ok(sh, `${v}/${tier}: shiny sweeps`);
      assert.equal(sh.frames[sh.frames.length - 1].opacity, 0, 'the sweep ends hidden');
      checkSteps(steps, revealMs(tier), `${v}/${tier}/shiny`);
    }
  }
});

const R = (tier, extra = {}) => ({ tier, newMark: false, shiny: false, markId: `x-${tier}`, ...extra });

test('x10: the BEST card is the rarest; SHINY breaks a tie; then NEW; then the earliest', () => {
  assert.equal(bestIndex([R('common'), R('epic'), R('rare'), R('epic')]), 1, 'rarest, earliest of a tie');
  assert.equal(bestIndex([R('epic'), R('epic', { shiny: true }), R('rare')]), 1, 'shiny breaks the tie');
  assert.equal(bestIndex([R('epic', { shiny: true }), R('legendary')]), 1, 'shiny never beats a rarer tier');
  assert.equal(bestIndex([R('rare'), R('rare', { newMark: true })]), 1, 'then a NEW mark');
  assert.equal(bestIndex([R('rare', { newMark: true }), R('rare', { shiny: true })]), 1, 'shiny before NEW');
  assert.equal(bestIndex([]), -1);
  assert.equal(multiPrice(1234), 12340, 'x10 is exactly ten single rolls');
});

test('x10: nine cards flip in 80 ms apart, the BEST gets its tier\'s full reveal LAST', () => {
  const list = [R('common'), R('rare'), R('common'), R('legendary'), R('common'), R('epic'), R('common'), R('common'), R('rare', { shiny: true }), R('common')];
  const plan = multiPlan(list);
  assert.equal(plan.best, 3);
  assert.equal(plan.flips.length, 9);
  assert.ok(!plan.flips.some((f) => f.idx === plan.best), 'the best never flips with the others');
  assert.deepEqual(plan.flips.map((f) => f.idx), [0, 1, 2, 4, 5, 6, 7, 8, 9], 'grid order');
  plan.flips.forEach((f, i) => assert.equal(f.at, i * MULTI_STAGGER_MS, '80 ms stagger'));
  assert.equal(plan.bestAt, 8 * MULTI_STAGGER_MS + MULTI_FLIP_MS, 'the best starts once the last flip lands');
  assert.equal(plan.D, plan.bestAt + revealMs('legendary'));
  for (const v of REVEAL_VERSIONS) {
    const steps = multiTimeline(list, false, v);
    checkSteps(steps.filter((s) => !/^m\d$/.test(s.node) || s.duration !== MULTI_FLIP_MS), plan.D, `x10/${v}`);
    for (const s of steps) assert.ok(s.delay + s.duration <= plan.D + 1, `x10/${v} ${s.node} ends in the window`);
    const flips = steps.filter((s) => /^m\d$/.test(s.node) && s.node !== `m${plan.best}`);
    assert.equal(flips.length, 9, `x10/${v}: nine flips`);
    for (const f of flips) assert.equal(f.frames[f.frames.length - 1].opacity, 1, 'each card lands face up');
    const bestSteps = steps.filter((s) => s.node === `m${plan.best}`);
    assert.ok(bestSteps.length >= 1, 'the best card is animated');
    for (const s of bestSteps) assert.ok(s.delay >= plan.bestAt, 'the best card waits for the last flip');
    assert.equal(bestSteps.pop().frames.slice(-1)[0].opacity, 1, 'and lands');
    // the best's full-screen layer plays AFTER every flip has started
    const cover = steps.find((s) => s.node === 'cover');
    assert.ok(cover && cover.delay >= plan.flips[plan.flips.length - 1].at, 'the full reveal comes LAST');
    assert.ok(!steps.some((s) => s.node === 'back'), 'no coin in the grid');
  }
  // every tier as the best: its own kind of reveal, last
  for (const tier of TIERS) {
    const l = [R(tier), R('common'), R('common')]; // the best first in the grid: it still reveals LAST
    const p = multiPlan(l);
    assert.equal(p.best, 0);
    assert.equal(p.D, p.bestAt + revealMs(tier));
    assert.equal(multiTimeline(l, false, 'a').some((s) => s.node === 'cover'), revealKind(tier) === 'burst' || revealKind(tier) === 'full');
  }
  assert.deepEqual(multiTimeline(list, true), [], 'reduced motion: no animation');
});

test('x10 pacing: the pacer holds the whole x10 window, a tap skips it', () => {
  const list = [R('common'), R('epic')];
  const plan = multiPlan(list);
  const p = createPacer();
  p.start(0, 'epic', plan.D);
  assert.equal(p.canRoll(plan.D - 1), false);
  assert.equal(p.canRoll(plan.D), true);
  p.start(0, 'epic', plan.D);
  p.finishNow(5);
  assert.equal(p.canRoll(5), true, 'tap anywhere skips to the result');
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
    assert.equal(steps.some((s) => s.node === 'cover'), isHeavy(tier) || tier === 'epic', `${tier}: the cover only for EPIC+`);
    const card = steps.filter((s) => s.node === 'card').pop();
    assert.equal(card.frames[card.frames.length - 1].opacity, 1, `${tier}: the card lands`);
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
