import test from 'node:test';
import assert from 'node:assert/strict';
import {
  drawStrip, tableEntries, REEL_LEN, LAND_AT, spinMs, SPIN_MS, easePow, reelPos, tickTimes, spinFrom, revealMode,
  hasCutscene, dimFor, hasLight, burstCount, BURST_POOL, shakePx, shakeFrames, autoShouldStop, needMoreText,
  burstVectors, TIER_LADDER, restOffset, REST_MAX, crossShare, timeAt, DIM_CELLS,
} from './reelPlan.js';
import { rollTable, freshState, ROLL_MARKS, rollMarkById } from '../../progress/markRolls.js';

// a small seeded rng (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const tierOf = (id) => rollMarkById(id).tier;
const fresh = () => ({ ...freshState(), everEpic: true, rolls: 20, starter: true });

test('the strip is drawn from the live odds: commons dominate, rares at their true rate', () => {
  const { probs } = rollTable(fresh(), { permanentOwned: 0, markLuck: 0 });
  const want = {};
  for (const m of ROLL_MARKS) want[m.tier] = (want[m.tier] || 0) + (probs.get(m.id) || 0);
  const r = rng(7);
  const n = {};
  let total = 0;
  for (let k = 0; k < 2000; k += 1) {
    const strip = drawStrip(probs, r, { resultId: 'mk-bomber' });
    strip.forEach((id, i) => {
      if (i === LAND_AT) return;
      n[tierOf(id)] = (n[tierOf(id)] || 0) + 1;
      total += 1;
    });
  }
  assert.ok(n.common / total > 0.8, `commons dominate (${(n.common / total).toFixed(3)})`);
  // RARE share within 10% (relative) of the table's
  assert.ok(Math.abs(n.rare / total - want.rare) / want.rare < 0.1, `rare ${n.rare / total} vs ${want.rare}`);
  // every filler is a real, rollable mark with p > 0
  const ok = new Set(tableEntries(probs).map((e) => e.id));
  for (const id of drawStrip(probs, rng(3), { resultId: 'mk-eclipse' })) assert.ok(ok.has(id) || id === 'mk-eclipse');
});

test('the landing cell is the result and the fillers never depend on it (no inserted near-miss)', () => {
  const { probs } = rollTable(fresh(), { permanentOwned: 0, markLuck: 0 });
  const a = drawStrip(probs, rng(42), { resultId: 'mk-origin' });
  const b = drawStrip(probs, rng(42), { resultId: 'mk-bomber' });
  assert.equal(a.length, REEL_LEN);
  assert.equal(a[LAND_AT], 'mk-origin');
  assert.equal(b[LAND_AT], 'mk-bomber');
  a.forEach((id, i) => { if (i !== LAND_AT) assert.equal(id, b[i], `cell ${i} must not change with the result`); });
});

test('a pity-forced roll draws its strip from the forced (EPIC+) table — still the real odds of that roll', () => {
  const st = { ...fresh(), sinceEpic: 49 };
  const t = rollTable(st, { permanentOwned: 0, markLuck: 0 });
  assert.equal(t.forced, 'epic');
  const strip = drawStrip(t.probs, rng(9), { resultId: 'mk-nova' });
  for (const id of strip) assert.ok(TIER_LADDER.indexOf(tierOf(id)) >= 2);
});

test('duration by tier: ~2.5 s COMMON → ~4 s SECRET, monotonic; slowdown power grows too', () => {
  assert.equal(spinMs('common'), 2500);
  assert.equal(spinMs('secret'), 4000);
  for (let i = 1; i < TIER_LADDER.length; i += 1) {
    assert.ok(SPIN_MS[TIER_LADDER[i]] > SPIN_MS[TIER_LADDER[i - 1]]);
    assert.ok(easePow(TIER_LADDER[i]) > easePow(TIER_LADDER[i - 1]));
  }
  assert.ok(spinMs('secret', 'short') < 700);
  assert.equal(spinMs('secret', 'none'), 0);
});

test('the reel lands exactly on the result and never overshoots; ticks slow down', () => {
  const dur = spinMs('legendary');
  const pow = easePow('legendary');
  let prev = -1;
  for (let t = 0; t <= dur + 50; t += 16) {
    const p = reelPos(t, { dur, pow });
    assert.ok(p >= prev - 1e-9 && p <= LAND_AT + 1e-9);
    prev = p;
  }
  assert.equal(reelPos(dur, { dur, pow }), LAND_AT);
  const ticks = tickTimes({ dur, pow });
  assert.equal(ticks.length, LAND_AT);
  for (let i = 2; i < ticks.length; i += 1) assert.ok(ticks[i] - ticks[i - 1] >= ticks[i - 1] - ticks[i - 2] - 1e-6);
  // rarer = longer crawl: the share of time spent on the last 3 cells grows with the tier
  const crawl = (tier) => {
    const d = spinMs(tier);
    const tt = tickTimes({ dur: d, pow: easePow(tier) });
    return (d - tt[tt.length - 3]) / d;
  };
  assert.ok(crawl('secret') > crawl('common'));
  // a SHORT land starts near the result
  assert.equal(spinFrom('short'), LAND_AT - 6);
  assert.equal(spinFrom('full'), 0);
});

test('skip rules: below the setting → short; at/above → full; a first-time mark ALWAYS full; reduced → none', () => {
  const r = (tier, newMark = false) => ({ tier, newMark });
  assert.equal(revealMode(r('common'), { skipBelow: 'epic' }), 'short');
  assert.equal(revealMode(r('rare'), { skipBelow: 'epic' }), 'short');
  assert.equal(revealMode(r('epic'), { skipBelow: 'epic' }), 'full');
  assert.equal(revealMode(r('legendary'), { skipBelow: 'mythic' }), 'short');
  assert.equal(revealMode(r('common', true), { skipBelow: 'secret' }), 'full');
  assert.equal(revealMode(r('common'), { skipBelow: 'common' }), 'full');
  assert.equal(revealMode(r('secret', true), { reduced: true }), 'none');
});

test('rarity scaling: cutscene LEGENDARY+, dim/light/burst EPIC+, shake grows; short lands stay quiet', () => {
  assert.equal(hasCutscene('epic'), false);
  assert.equal(hasCutscene('legendary'), true);
  assert.equal(hasCutscene('secret', 'short'), false);
  assert.equal(dimFor('rare'), 0);
  assert.ok(dimFor('secret') > dimFor('epic') && dimFor('epic') > 0);
  assert.equal(hasLight('rare'), false);
  assert.equal(hasLight('epic'), true);
  assert.equal(burstCount('rare'), 0);
  assert.ok(burstCount('epic') > 0 && burstCount('secret') <= BURST_POOL);
  let prev = -1;
  for (const t of TIER_LADDER) { assert.ok(shakePx(t) >= prev); prev = shakePx(t); }
  assert.equal(shakePx('secret', 'short'), 0);
  assert.deepEqual(shakeFrames(0), []);
  for (const f of shakeFrames(9)) assert.deepEqual(Object.keys(f), ['transform']);
  assert.equal(burstVectors(BURST_POOL).length, BURST_POOL);
});

test('auto roll stops on the goal tier or better (incl. a double roll extra)', () => {
  assert.equal(autoShouldStop({ tier: 'rare' }, 'epic'), false);
  assert.equal(autoShouldStop({ tier: 'epic' }, 'epic'), true);
  assert.equal(autoShouldStop({ tier: 'mythic' }, 'epic'), true);
  assert.equal(autoShouldStop({ tier: 'common', extra: [{ tier: 'legendary' }] }, 'legendary'), true);
  assert.equal(autoShouldStop({ tier: 'secret' }, 'secret'), true);
});

test('copy helpers: the short-balance sentence (screen readers only — the screen shows −N + gem)', () => {
  assert.equal(needMoreText(100, 40), 'NEED 60 MORE GEMS');
});

test('tension: the result crosses the line at >= 85% of the spin, rests INSIDE its cell, every tier', () => {
  for (const t of TIER_LADDER) {
    for (const rest of [-REST_MAX, 0, REST_MAX]) {
      assert.ok(crossShare(t, rest) >= 0.85, `${t} rest ${rest}: ${crossShare(t, rest).toFixed(3)}`);
    }
  }
  const r = rng(11);
  for (let i = 0; i < 500; i += 1) {
    const o = restOffset(r);
    assert.ok(o >= -REST_MAX && o <= REST_MAX && Math.abs(o) < 0.5);
  }
  // timeAt inverts reelPos
  const dur = 3000;
  const pow = 1.9;
  const t = timeAt(LAND_AT - DIM_CELLS, { dur, pow });
  assert.ok(Math.abs(reelPos(t, { dur, pow }) - (LAND_AT - DIM_CELLS)) < 1e-6);
  assert.ok(t / dur > 0.6, 'the dim starts late, near the end of the spin');
});

test('full reveal: a first-time mark in a double roll extra, and the hit that stops AUTO ROLL', () => {
  assert.equal(revealMode({ tier: 'common', extra: [{ tier: 'rare', newMark: true }] }, { skipBelow: 'epic' }), 'full');
  assert.equal(revealMode({ tier: 'rare' }, { skipBelow: 'epic', autoUntil: 'rare' }), 'full');
  assert.equal(revealMode({ tier: 'common' }, { skipBelow: 'epic', autoUntil: 'rare' }), 'short');
  assert.equal(revealMode({ tier: 'rare' }, { skipBelow: 'epic', autoUntil: null }), 'short');
});

test('ROLL v1 reveals are rarity-scaled: line < EPIC, dim at EPIC, full LEGENDARY+; short / none lands are a line', async () => {
  const { revealKind } = await import('./reelPlan.js');
  assert.equal(revealKind('common'), 'line');
  assert.equal(revealKind('rare'), 'line');
  assert.equal(revealKind('epic'), 'dim');
  for (const t of ['legendary', 'mythic', 'secret']) assert.equal(revealKind(t), 'full');
  assert.equal(revealKind('secret', 'short'), 'line');
  assert.equal(revealKind('legendary', 'none'), 'line');
});

test('the AUTO cycle: OFF → RARE+ → EPIC+ → LEGENDARY+ → OFF', async () => {
  const { nextAutoTarget, AUTO_CYCLE } = await import('./reelPlan.js');
  assert.deepEqual(AUTO_CYCLE, [null, 'rare', 'epic', 'legendary']);
  assert.equal(nextAutoTarget(null), 'rare');
  assert.equal(nextAutoTarget('rare'), 'epic');
  assert.equal(nextAutoTarget('epic'), 'legendary');
  assert.equal(nextAutoTarget('legendary'), null);
  assert.equal(nextAutoTarget('bogus'), 'rare');
});
