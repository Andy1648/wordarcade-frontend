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

test('the strip is drawn from the live odds: RARE (the floor) dominates, EPICs at their true rate', () => {
  const { probs } = rollTable(fresh(), { permanentOwned: 0, markLuck: 0 });
  const want = {};
  for (const m of ROLL_MARKS) want[m.tier] = (want[m.tier] || 0) + (probs.get(m.id) || 0);
  const r = rng(7);
  const n = {};
  let total = 0;
  for (let k = 0; k < 2000; k += 1) {
    const strip = drawStrip(probs, r, { resultId: 'mk-smith' });
    strip.forEach((id, i) => {
      if (i === LAND_AT) return;
      n[tierOf(id)] = (n[tierOf(id)] || 0) + 1;
      total += 1;
    });
  }
  assert.ok(n.rare / total > 0.97, `RARE dominates (${(n.rare / total).toFixed(3)})`);
  assert.equal(n.common, undefined, 'no COMMON exists');
  // EPIC share within 10% (relative) of the table's
  assert.ok(Math.abs(n.epic / total - want.epic) / want.epic < 0.1, `epic ${n.epic / total} vs ${want.epic}`);
  // every filler is a real, rollable mark with p > 0
  const ok = new Set(tableEntries(probs).map((e) => e.id));
  for (const id of drawStrip(probs, rng(3), { resultId: 'mk-eclipse' })) assert.ok(ok.has(id) || id === 'mk-eclipse');
});

test('the landing cell is the result and the fillers never depend on it (no inserted near-miss)', () => {
  const { probs } = rollTable(fresh(), { permanentOwned: 0, markLuck: 0 });
  const a = drawStrip(probs, rng(42), { resultId: 'mk-origin' });
  const b = drawStrip(probs, rng(42), { resultId: 'mk-smith' });
  assert.equal(a.length, REEL_LEN);
  assert.equal(a[LAND_AT], 'mk-origin');
  assert.equal(b[LAND_AT], 'mk-smith');
  a.forEach((id, i) => { if (i !== LAND_AT) assert.equal(id, b[i], `cell ${i} must not change with the result`); });
});

test('a pity-forced roll draws its strip from the forced (EPIC+) table — still the real odds of that roll', () => {
  const st = { ...fresh(), sinceEpic: 9 };
  const t = rollTable(st, { permanentOwned: 0, markLuck: 0 });
  assert.equal(t.forced, 'epic');
  const strip = drawStrip(t.probs, rng(9), { resultId: 'mk-nova' });
  for (const id of strip) assert.ok(TIER_LADDER.indexOf(tierOf(id)) >= TIER_LADDER.indexOf('epic'));
});

test('duration: 2.4 s for every tier (NIGHT oct8); the slowdown power still grows with rarity', () => {
  assert.equal(spinMs('rare'), 2400);
  assert.equal(spinMs('secret'), 2400);
  for (let i = 1; i < TIER_LADDER.length; i += 1) {
    assert.equal(SPIN_MS[TIER_LADDER[i]], 2400);
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
  assert.ok(crawl('secret') > crawl('rare'));
  // a SHORT land starts near the result
  assert.equal(spinFrom('short'), LAND_AT - 6);
  assert.equal(spinFrom('full'), 0);
});

test('skip rules: below the setting → short; at/above → full; a first-time mark ALWAYS full; reduced → none', () => {
  const r = (tier, newMark = false) => ({ tier, newMark });
  assert.equal(revealMode(r('rare'), { skipBelow: 'epic' }), 'short');
  assert.equal(revealMode(r('epic'), { skipBelow: 'epic' }), 'full');
  assert.equal(revealMode(r('legendary'), { skipBelow: 'mythic' }), 'short');
  assert.equal(revealMode(r('rare', true), { skipBelow: 'secret' }), 'full');
  assert.equal(revealMode(r('rare'), { skipBelow: 'rare' }), 'full', '< RARE skips nothing (RARE is the floor)');
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
  assert.equal(autoShouldStop({ tier: 'rare', extra: [{ tier: 'legendary' }] }, 'legendary'), true);
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
  assert.equal(revealMode({ tier: 'rare', extra: [{ tier: 'rare', newMark: true }] }, { skipBelow: 'epic' }), 'full');
  assert.equal(revealMode({ tier: 'epic' }, { skipBelow: 'legendary', autoUntil: 'epic' }), 'full');
  assert.equal(revealMode({ tier: 'rare' }, { skipBelow: 'epic', autoUntil: 'epic' }), 'short');
  assert.equal(revealMode({ tier: 'rare' }, { skipBelow: 'epic', autoUntil: null }), 'short');
});

test('ROLL v1 reveals are rarity-scaled: lite < EPIC (REVEAL v2), dim at EPIC, full LEGENDARY+; short / none lands are a line', async () => {
  const { revealKind } = await import('./reelPlan.js');
  assert.equal(revealKind('rare'), 'lite');
  assert.equal(revealKind('epic'), 'dim');
  for (const t of ['legendary', 'mythic', 'secret']) assert.equal(revealKind(t), 'full');
  assert.equal(revealKind('secret', 'short'), 'line');
  assert.equal(revealKind('legendary', 'none'), 'line');
});

test('the AUTO cycle: OFF → EPIC+ → LEGENDARY+ → OFF (GEAR POOL v2: RARE+ is every roll, so it is gone)', async () => {
  const { nextAutoTarget, AUTO_CYCLE } = await import('./reelPlan.js');
  assert.deepEqual(AUTO_CYCLE, [null, 'epic', 'legendary']);
  assert.equal(nextAutoTarget(null), 'epic');
  assert.equal(nextAutoTarget('epic'), 'legendary');
  assert.equal(nextAutoTarget('legendary'), null);
  assert.equal(nextAutoTarget('bogus'), 'epic');
});

test('R4 HOLD TO ROLL: the charge is 400–600 ms, the overhold fires on its own, the whole spin stays ≤ 3 s', async () => {
  const { CHARGE_MS, OVERHOLD_MS, CHARGE_RATTLE, SPIN_MS } = await import('./reelPlan.js');
  assert.ok(CHARGE_MS >= 400 && CHARGE_MS <= 600, `charge ${CHARGE_MS}`);
  assert.ok(OVERHOLD_MS > 0 && OVERHOLD_MS <= 1500);
  assert.ok(CHARGE_RATTLE.hard > CHARGE_RATTLE.light, 'the rattle ramps');
  for (const t of Object.keys(SPIN_MS)) assert.ok(SPIN_MS[t] + 320 <= 3000, `${t} spin + land ≤ 3 s`);
});

test('R4 THE TELL: EPIC+ only, honest (never for RARE or a short land), intensity climbs with the tier', async () => {
  const { tellFor, tellFrames, TELL } = await import('./reelPlan.js');
  assert.equal(tellFor('rare'), null);
  assert.equal(tellFor('epic', 'short'), null);
  assert.equal(tellFor('legendary', 'none'), null);
  assert.deepEqual(tellFrames('rare'), []);
  let lastPulses = 0; let lastPeak = 0;
  for (const t of ['epic', 'legendary', 'mythic', 'secret']) {
    const tell = tellFor(t);
    assert.ok(tell.pulses > lastPulses && tell.peak > lastPeak, `${t} is louder than the tier below`);
    lastPulses = tell.pulses; lastPeak = tell.peak;
    const f = tellFrames(t);
    assert.equal(f[0].opacity, 0);
    assert.ok(f.every((k) => k.opacity <= tell.peak && k.offset >= 0 && k.offset <= 1));
    assert.ok(f.every((k, i) => i === 0 || k.offset >= f[i - 1].offset), 'offsets never go backwards');
    assert.equal(f.filter((k) => k.opacity === tell.peak).length, tell.pulses);
  }
  assert.equal(TELL.epic.rumble, false);
  assert.equal(TELL.legendary.rumble, true);
});
