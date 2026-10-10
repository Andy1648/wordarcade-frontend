import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REVEAL_TIERS, LAYERS, revealTimeline, extensionPlan, extensionAt, EXT_MAX_MS, SPARKS, SPARK_POOL, SPARK_SPOTS, selfCloseMs,
  nextIdleSheen, IDLE_SHEEN_TIERS,
} from './revealPlan.js';

test('escalation: every tier keeps every layer of the tier below and ADDS at least one new one', () => {
  for (let i = 1; i < REVEAL_TIERS.length; i += 1) {
    const lo = LAYERS[REVEAL_TIERS[i - 1]];
    const hi = LAYERS[REVEAL_TIERS[i]];
    for (const l of lo) assert.ok(hi.includes(l), `${REVEAL_TIERS[i]} keeps ${l}`);
    assert.ok(hi.length > lo.length, `${REVEAL_TIERS[i]} adds a layer`);
  }
  assert.equal(LAYERS.common, undefined, 'GEAR POOL v2: no COMMON');
  assert.deepEqual(LAYERS.rare, ['flip', 'sheen', 'sparkles']);
});

test('reveal lengths scale ~0.5 / 1.0 / 1.6 / 2.2 / 3.0 s, strictly rising', () => {
  const want = { rare: 500, epic: 1000, legendary: 1600, mythic: 2200, secret: 3000 };
  let prev = 0;
  for (const t of REVEAL_TIERS) {
    const tl = revealTimeline(t);
    assert.ok(Math.abs(tl.total - want[t]) <= want[t] * 0.12, `${t} total ${tl.total}`);
    assert.ok(tl.total > prev);
    prev = tl.total;
  }
});

test('the rarity colour shows BEFORE the flip from LEGENDARY up (the telegraph ends where the flip starts)', () => {
  for (const t of ['rare', 'epic']) assert.equal(revealTimeline(t).telegraph, null);
  for (const t of ['legendary', 'mythic', 'secret']) {
    const tl = revealTimeline(t);
    assert.ok(tl.telegraph, t);
    assert.equal(tl.telegraph.at + tl.telegraph.ms, tl.flip.at);
  }
  // SECRET: the lights dim first, then a long spin-up, then the flip
  const s = revealTimeline('secret');
  assert.ok(s.dim.at <= s.spinUp.at && s.spinUp.ms >= 1000 && s.spinUp.at + s.spinUp.ms === s.flip.at);
  // EPIC rattles before it turns
  const e = revealTimeline('epic');
  assert.ok(e.preShake && e.preShake.at + e.preShake.ms <= e.flip.at);
});

test('only the layers a tier owns are scheduled', () => {
  assert.equal(revealTimeline('rare').burst, null);
  assert.equal(revealTimeline('epic').slam, null);
  assert.equal(revealTimeline('legendary').flash, null);
  assert.equal(revealTimeline('legendary').ring2, null);
  assert.ok(revealTimeline('mythic').flash && revealTimeline('mythic').ring2);
  assert.equal(revealTimeline('mythic').dim, null);
  assert.ok(revealTimeline('secret').dim);
});

test('sparkles fit the pool (SECRET plays it twice); every spot is a fixed % (a spawn never measures)', () => {
  for (const t of REVEAL_TIERS) assert.ok(SPARKS[t] <= SPARK_POOL * 2);
  for (const t of REVEAL_TIERS.filter((x) => x !== 'secret')) assert.ok(SPARKS[t] <= SPARK_POOL, t);
  assert.ok(SPARK_POOL >= 6 && SPARK_POOL <= 8);
  assert.equal(SPARK_SPOTS.length, SPARK_POOL);
});

test('the stats extension: main first, extras then perk ~120 ms apart, dupe stars last, never over 1.2 s', () => {
  const p = extensionPlan({ extras: 2, perk: true, dupe: true, stars: 5 });
  assert.equal(p.main.at, 0);
  assert.equal(p.extras.length, 2);
  assert.equal(p.extras[1].at - p.extras[0].at, 120);
  assert.equal(p.perk.at - p.extras[1].at, 120);
  assert.ok(p.dupe.at > p.perk.at);
  assert.equal(p.stars.length, 5);
  for (const s of p.stars) assert.ok(s.at + s.ms <= EXT_MAX_MS);
  assert.ok(p.total <= EXT_MAX_MS);
  const bare = extensionPlan({});
  assert.equal(bare.extras.length, 0);
  assert.equal(bare.perk, null);
  assert.equal(bare.dupe, null);
  assert.ok(bare.total <= 400);
});

test('a self-closing reveal waits for the reveal + the stats + a beat', () => {
  const ext = extensionPlan({ extras: 1 });
  assert.ok(selfCloseMs('rare', ext) > revealTimeline('rare').total);
  assert.ok(selfCloseMs('rare', ext) > extensionAt('rare') + ext.total);
  for (const t of REVEAL_TIERS) assert.ok(extensionAt(t) > revealTimeline(t).land, `${t}: the stats wait for the land`);
  assert.ok(selfCloseMs('rare', ext, { auto: true }) < selfCloseMs('rare', ext));
});

test('idle sheen: LEGENDARY+ only, round-robin over the visible cards, -1 when none is visible', () => {
  assert.deepEqual([...IDLE_SHEEN_TIERS].sort(), ['legendary', 'mythic', 'secret']);
  const ids = ['a', 'b', 'c'];
  assert.equal(nextIdleSheen(ids, new Set(['a', 'c']), -1), 0);
  assert.equal(nextIdleSheen(ids, new Set(['a', 'c']), 0), 2);
  assert.equal(nextIdleSheen(ids, new Set(['a', 'c']), 2), 0);
  assert.equal(nextIdleSheen(ids, new Set(), 0), -1);
  assert.equal(nextIdleSheen([], new Set(['a']), -1), -1);
});
