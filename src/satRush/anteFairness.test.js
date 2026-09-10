// anteFairness.test.js — the ante ladder should measure VOCABULARY, not reading speed.
//
// Three beats at 5/3/1 used to be the same wall-clock budget for every card, while the cards
// themselves range from ~5s to ~12s of read+type work. So AVG ANTE was largely a reading-speed
// stat, and a 196-character context made x5 unreachable however well you knew the word.
//
// The fix is a per-card beat: stageMs(card) scales with card.costMs, which is baked into
// words.json at build time by scripts/build-sat-costs.mjs. Three beats and the 5/3/1 multipliers
// are unchanged, so the scoring model and the meaning of AVG ANTE are untouched.
//
// These tests MEASURE the result rather than assume it, and print the ante distribution by tier.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { stageMs, STAGE_MS_MIN, STAGE_MS_MAX, STAGE_COST_FACTOR, DEFAULT_STAGE_MS } from './config.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CARDS = JSON.parse(readFileSync(resolve(HERE, '../data/satRush/words.json'), 'utf8'));

// THREE PLAYER SPEEDS, because 200wpm/35wpm is a good reader and tuning to one speed hides who
// the change actually helps. Each knows every word, so the only thing between them and a x5 is
// how much the card makes them read before they can answer.
const SPEEDS = [
  { key: 'a', label: 'slow   160wpm/25wpm', readWpm: 160, typeWpm: 25 },
  { key: 'b', label: 'median 200wpm/35wpm', readWpm: 200, typeWpm: 35 },
  { key: 'c', label: 'fast   260wpm/55wpm', readWpm: 260, typeWpm: 55 },
];
const charsPerSec = (wpm) => (wpm * 5) / 60; // 5 chars per word
const MAX_CONTEXT_CHARS = 140;

// At stage 0 the card shows its META + SENTENCE; the gloss only arrives at stage 1. A player who
// knows the word needs the sentence (to see which word is being asked for) and then types it.
const stage0CostMs = (c, sp) =>
  (1000 * (c.context || '').length) / charsPerSec(sp.readWpm) +
  (1000 * (c.word || '').length) / charsPerSec(sp.typeWpm);
// By stage 1 the gloss is up too, so the cumulative read is gloss + context.
const stage1CostMs = (c, sp) =>
  (1000 * ((c.context || '').length + (c.gloss || '').length)) / charsPerSec(sp.readWpm) +
  (1000 * (c.word || '').length) / charsPerSec(sp.typeWpm);

// Which ante this player lands on: x5 inside beat 1, x3 inside beats 1-2, else x1.
function anteFor(c, sp, beat = stageMs(c)) {
  if (stage0CostMs(c, sp) <= beat) return 5;
  if (stage1CostMs(c, sp) <= 2 * beat) return 3;
  return 1;
}
// The x5/x3/x1 split for one speed, as percentages.
function splitFor(sp, beatOf = stageMs) {
  const counts = { 5: 0, 3: 0, 1: 0 };
  for (const c of CARDS) counts[anteFor(c, sp, beatOf(c))] += 1;
  const p = (n) => (100 * n) / CARDS.length;
  return { x5: p(counts[5]), x3: p(counts[3]), x1: p(counts[1]) };
}

const quantile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

/* ------------------------------- the data ------------------------------- */

test('every card carries a build-time costMs', () => {
  assert.equal(CARDS.length, 956, 'the corpus is the expected size');
  for (const c of CARDS) {
    assert.ok(Number.isFinite(c.costMs), `"${c.word}" has a costMs`);
    assert.ok(c.costMs > 0, `"${c.word}" costMs is positive`);
  }
});

test('contexts are within the cap, except where trimming would cut the ___ blank', () => {
  const over = CARDS.filter((c) => (c.context || '').length > MAX_CONTEXT_CHARS);
  // THE BLANK IS SACRED — it is the prompt, and a card without one is unplayable. "affluent"
  // carries its blank at char 139 of 143, so the build leaves that context alone rather than
  // cutting it. Exactly one card is allowed to stay long, and only for that reason.
  console.log(`[ante] contexts still over ${MAX_CONTEXT_CHARS}: ${over.map((c) => c.word).join(', ') || '(none)'}`);
  assert.ok(over.length <= 1, `at most one context stays long (${over.length})`);
  for (const c of over) {
    const blank = c.context.indexOf('___');
    assert.ok(blank + 3 > MAX_CONTEXT_CHARS, `"${c.word}" is long ONLY because its blank sits past the cap`);
  }
  // Every card still has exactly one blank — the invariant the trim must never break.
  for (const c of CARDS) {
    const n = (c.context || '').split('___').length - 1;
    assert.equal(n, 1, `"${c.word}" has exactly one blank`);
  }
  // And a trimmed context still ends like a sentence, not mid-word.
  for (const c of CARDS) {
    assert.ok(!/\s$/.test(c.context || ''), `"${c.word}" context has no trailing space`);
  }
});

/* ------------------------------ stageMs ------------------------------ */

test('stageMs is inside [2200, 9000] for all 956 cards', () => {
  assert.equal(STAGE_MS_MIN, 2200);
  assert.equal(STAGE_MS_MAX, 9000);
  for (const c of CARDS) {
    const ms = stageMs(c);
    assert.ok(Number.isInteger(ms), `"${c.word}" stage is a whole number of ms`);
    assert.ok(ms >= 2200 && ms <= 9000, `"${c.word}" stage ${ms} is inside [2200, 9000]`);
  }
  const stages = CARDS.map(stageMs).sort((a, b) => a - b);
  console.log(
    `[ante] stageMs min ${stages[0]} · p10 ${quantile(stages, 0.1)} · p50 ${quantile(stages, 0.5)} · p90 ${quantile(stages, 0.9)} · max ${stages[stages.length - 1]}`
  );
});

test("the x5 window vs each card's own cost — 4 of 956 fall under 60%", () => {
  const ratios = CARDS.map((c) => ({ word: c.word, r: stageMs(c) / c.costMs }));
  const under = ratios.filter((x) => x.r < 0.6).sort((a, b) => a.r - b.r);
  const min = Math.min(...ratios.map((x) => x.r));
  console.log(`[ante] beat / own cost — min ${min.toFixed(3)} · under 60%: ${under.map((x) => `${x.word} ${x.r.toFixed(3)}`).join(', ') || '(none)'}`);
  // HONEST BOUND. The ask was that no card's x5 window falls under 60% of its own read+type cost.
  // Four of the longest cards do, because the 9000ms CEILING bites before the 0.85 factor does:
  // "incontrovertible" costs 15936ms and gets the 9000ms cap, i.e. 0.565. Raising the ceiling to
  // 9562+ removes all four — but it also pushes the median player from 74.6% to 82% at x5, outside
  // the 55-80 band this tuning was chosen for. That is the trade; these numbers are asserted so it
  // stays visible.
  assert.ok(min > 0.55, `no card drops below 55% of its own cost (min ${min.toFixed(3)})`);
  assert.equal(under.length, 4, 'exactly the four longest cards sit under 60%');
  for (const u of under) assert.ok(stageMs(CARDS.find((c) => c.word === u.word)) === STAGE_MS_MAX, `"${u.word}" is capped by the ceiling, not the factor`);
});

test('stageMs tracks cost inside the clamp, and falls back for a card with no costMs', () => {
  const inBand = CARDS.filter((c) => {
    const raw = c.costMs * STAGE_COST_FACTOR;
    return raw > STAGE_MS_MIN && raw < STAGE_MS_MAX;
  });
  assert.ok(inBand.length > 100, `most cards sit inside the clamp band (${inBand.length})`);
  for (const c of inBand) assert.equal(stageMs(c), Math.round(c.costMs * STAGE_COST_FACTOR));
  // A longer card always gets at least as long a beat — the whole point.
  const sorted = CARDS.slice().sort((a, b) => a.costMs - b.costMs);
  assert.ok(stageMs(sorted[sorted.length - 1]) > stageMs(sorted[0]), 'the longest card gets a longer beat');
  // Missing data can never crash or produce NaN.
  assert.equal(stageMs({ word: 'x' }), DEFAULT_STAGE_MS);
  assert.equal(stageMs(null), DEFAULT_STAGE_MS);
});

/* --------------------- the three simulated players --------------------- */

test('x5 / x3 / x1 split at three player speeds', () => {
  console.log('[ante] speed                |    x5 |    x3 |    x1');
  const out = {};
  for (const sp of SPEEDS) {
    const r = splitFor(sp);
    out[sp.key] = r;
    console.log(
      `[ante] ${sp.label} | ${r.x5.toFixed(1).padStart(5)}% | ${r.x3.toFixed(1).padStart(5)}% | ${r.x1.toFixed(1).padStart(5)}%`
    );
  }

  // (b) THE MEDIAN PLAYER — the one this tuning targets, and the only band that is met.
  assert.ok(out.b.x5 >= 55 && out.b.x5 <= 80, `median player lands 55-80% at x5 (${out.b.x5.toFixed(1)}%)`);

  // (a) and (c) CANNOT both be satisfied — see the overlap test below for the proof. These
  // assertions record where they actually land so a future tuning change is visible.
  assert.ok(out.a.x5 < 5, `slow player is starved at x5 (${out.a.x5.toFixed(1)}%, target was >25%)`);
  assert.ok(out.c.x5 > 95, `fast player is saturated at x5 (${out.c.x5.toFixed(1)}%, target was <95%)`);
  // Nobody is stranded on x1: every speed still clears essentially everything by beat 2.
  for (const sp of SPEEDS) assert.ok(splitFor(sp).x1 < 5, `${sp.label} is rarely pushed to x1`);
});

test('the slow and fast bands cannot both be met — the distributions do not overlap', () => {
  const sortedCost = (sp) => CARDS.map((c) => stage0CostMs(c, sp)).sort((x, y) => x - y);
  const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
  const slow = sortedCost(SPEEDS[0]);
  const fast = sortedCost(SPEEDS[2]);
  const slowP25 = q(slow, 0.25);
  const fastP95 = q(fast, 0.95);
  console.log(
    `[ante] slow p25 stage-0 cost ${Math.round(slowP25)}ms vs fast p95 ${Math.round(fastP95)}ms ` +
      `-> overlap window ${Math.round(fastP95 - slowP25)}ms`
  );
  // A single beat per card is one number for all three players. To hand the SLOW player a quarter
  // of the x5s the beat must clear their p25 cost; but that is already ABOVE the FAST player's p95,
  // so the same beat hands the fast player ~everything. The window is negative: no factor and no
  // ceiling can satisfy "slow > 25%" and "fast < 95%" at once on this corpus.
  assert.ok(fastP95 < slowP25, 'the fast p95 sits BELOW the slow p25 — there is no beat between them');

  // And a direct search agrees: nothing in a wide grid meets all three bands at once.
  let feasible = 0;
  for (let f = 0.6; f <= 2.0; f += 0.05) {
    for (const hi of [7000, 9000, 11000, 13000, 99999]) {
      const beatOf = (c) => Math.min(hi, Math.max(STAGE_MS_MIN, Math.round(c.costMs * f)));
      const a = splitFor(SPEEDS[0], beatOf).x5;
      const b = splitFor(SPEEDS[1], beatOf).x5;
      const cc = splitFor(SPEEDS[2], beatOf).x5;
      if (b >= 55 && b <= 80 && a > 25 && cc < 95) feasible += 1;
    }
  }
  console.log(`[ante] grid search over factor x ceiling: ${feasible} parameter pairs meet all three bands`);
  assert.equal(feasible, 0, 'no (factor, ceiling) pair satisfies slow>25 AND median 55-80 AND fast<95');
});

test('ante distribution by tier, flat beat vs per-card beat (median player)', () => {
  const median = SPEEDS[1];
  const tiers = [...new Set(CARDS.map((c) => c.tier))].sort();
  console.log('[ante] tier | cards |  AVG ANTE flat -> per-card |  x5 share flat -> per-card');
  const avg = (xs) => xs.reduce((n, x) => n + x, 0) / xs.length;
  for (const t of tiers) {
    const inTier = CARDS.filter((c) => c.tier === t);
    const before = inTier.map((c) => anteFor(c, median, DEFAULT_STAGE_MS));
    const after = inTier.map((c) => anteFor(c, median));
    const b5 = before.filter((x) => x === 5).length;
    const a5 = after.filter((x) => x === 5).length;
    console.log(
      `[ante]   ${t}  |  ${String(inTier.length).padStart(4)} |      ${avg(before).toFixed(2)} -> ${avg(after).toFixed(2)}      |   ` +
        `${((100 * b5) / inTier.length).toFixed(1)}% -> ${((100 * a5) / inTier.length).toFixed(1)}%`
    );
    // Every tier must improve for the player this is tuned for.
    assert.ok(avg(after) >= avg(before), `tier ${t} is not worse under the per-card beat`);
  }
  const totalBefore = CARDS.reduce((n, c) => n + anteFor(c, median, DEFAULT_STAGE_MS), 0);
  const totalAfter = CARDS.reduce((n, c) => n + anteFor(c, median), 0);
  console.log(`[ante] corpus-wide ante total: ${totalBefore} -> ${totalAfter} (of ${CARDS.length * 5} possible)`);
  assert.ok(totalAfter > totalBefore * 2, `the per-card beat transforms the ante (${totalBefore} -> ${totalAfter})`);
});
