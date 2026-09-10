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

// The measured player: reads 200 wpm (16.7 chars/sec), types 35 wpm (2.9 chars/sec), and KNOWS
// every word — so the only thing standing between them and a x5 is how much the card makes them
// read before they can answer.
const READ = 16.7;
const TYPE = 2.9;
const MAX_CONTEXT_CHARS = 140;

// At stage 0 the card shows its META + SENTENCE; the gloss only arrives at stage 1. A player who
// knows the word needs the sentence (to see which word is being asked for) and then types it.
const stage0CostMs = (c) => (1000 * (c.context || '').length) / READ + (1000 * (c.word || '').length) / TYPE;
// By stage 1 the gloss is up too, so the cumulative read is gloss + context.
const stage1CostMs = (c) =>
  (1000 * ((c.context || '').length + (c.gloss || '').length)) / READ + (1000 * (c.word || '').length) / TYPE;

// Which ante this player lands on: x5 inside beat 1, x3 inside beats 1-2, else x1.
function anteFor(c, beat = stageMs(c)) {
  if (stage0CostMs(c) <= beat) return 5;
  if (stage1CostMs(c) <= 2 * beat) return 3;
  return 1;
}
const pct = (n) => `${((100 * n) / CARDS.length).toFixed(1)}%`;
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

test('costMs after the trim: the 12000ms target is NOT met, and by how much', () => {
  const costs = CARDS.map((c) => c.costMs).sort((a, b) => a - b);
  const over = CARDS.filter((c) => c.costMs > 12000);
  console.log(
    `[ante] costMs p10 ${quantile(costs, 0.1)} · p50 ${quantile(costs, 0.5)} · p90 ${quantile(costs, 0.9)} · max ${costs[costs.length - 1]}`
  );
  console.log(`[ante] cards over 12000ms: ${over.length} (${pct(over.length)})`);
  // HONEST BOUND. The brief asked for zero cards over 12000ms after a 140-char context trim, but
  // only 7 contexts were over 140 in the first place — the trim moves the ceiling from 17475 to
  // 15936 and leaves 129 cards above 12000. It cannot get there: a 140-char context plus a ~30
  // char gloss is already ~10.2s of reading before a letter is typed. Reaching zero needs the
  // context cap down around 70 chars, which would gut the sentences. This asserts the real
  // number so it cannot rot; drop the cap if you want the target instead.
  assert.ok(costs[costs.length - 1] < 16000, `the trim did lower the ceiling (max ${costs[costs.length - 1]})`);
  assert.ok(over.length < 140, `and ${over.length} cards remain over 12000ms`);
});

/* ------------------------------ stageMs ------------------------------ */

test('stageMs is inside the clamp for all 956 cards', () => {
  for (const c of CARDS) {
    const ms = stageMs(c);
    assert.ok(Number.isInteger(ms), `"${c.word}" stage is a whole number of ms`);
    assert.ok(ms >= STAGE_MS_MIN && ms <= STAGE_MS_MAX, `"${c.word}" stage ${ms} is inside the clamp`);
  }
  const stages = CARDS.map(stageMs).sort((a, b) => a - b);
  console.log(`[ante] stageMs p10 ${quantile(stages, 0.1)} · p50 ${quantile(stages, 0.5)} · p90 ${quantile(stages, 0.9)}`);
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

/* --------------------- the simulated player + the report --------------------- */

test('ante distribution by tier, flat beat vs per-card beat', () => {
  const tiers = [...new Set(CARDS.map((c) => c.tier))].sort();
  const rows = [];
  for (const t of tiers) {
    const inTier = CARDS.filter((c) => c.tier === t);
    const before = inTier.map((c) => anteFor(c, DEFAULT_STAGE_MS));
    const after = inTier.map((c) => anteFor(c));
    const avg = (xs) => xs.reduce((n, x) => n + x, 0) / xs.length;
    rows.push({
      tier: t,
      n: inTier.length,
      beforeAvg: avg(before),
      afterAvg: avg(after),
      before5: before.filter((a) => a === 5).length,
      after5: after.filter((a) => a === 5).length,
    });
  }
  console.log('[ante] tier | cards |  AVG ANTE flat -> per-card |  x5 share flat -> per-card');
  for (const r of rows) {
    console.log(
      `[ante]   ${r.tier}  |  ${String(r.n).padStart(4)} |      ${r.beforeAvg.toFixed(2)} -> ${r.afterAvg.toFixed(2)}      |   ` +
        `${((100 * r.before5) / r.n).toFixed(1)}% -> ${((100 * r.after5) / r.n).toFixed(1)}%`
    );
  }
  // DIRECTION: 929 of 956 cards get a LONGER beat than the flat 2800ms; the 27 that get a
  // shorter one are the cheapest cards in the corpus (median costMs ~6.2s), which is the point —
  // a short card should not be handed the same budget as a 12-second one. So a tier's average may
  // dip a hair (tier 4 moves 1.01 -> 1.00) without that being a regression; what must hold is
  // that the corpus overall is not made harder.
  const shorter = CARDS.filter((c) => stageMs(c) < DEFAULT_STAGE_MS).length;
  const longer = CARDS.filter((c) => stageMs(c) > DEFAULT_STAGE_MS).length;
  console.log(`[ante] beats vs the flat 2800ms — longer: ${longer}, shorter: ${shorter}`);
  assert.ok(longer > shorter * 10, 'the overwhelming majority of cards get MORE time, not less');
  const totalBefore = CARDS.reduce((n, c) => n + anteFor(c, DEFAULT_STAGE_MS), 0);
  const totalAfter = CARDS.reduce((n, c) => n + anteFor(c), 0);
  console.log(`[ante] corpus-wide ante total: ${totalBefore} -> ${totalAfter} (of ${CARDS.length * 5} possible)`);
  // THE FINDING, in one number. At the shipped factor the per-card beat barely moves this player:
  // 958 -> 956 out of a possible 4780. The mechanism is in place and correct, but 0.42 makes the
  // beat a fraction of the card's own cost, so nobody clears a beat they need the whole cost for.
  // Raising the factor is what turns this on; see the x5 test below for the measured numbers.
  assert.ok(
    Math.abs(totalAfter - totalBefore) / totalBefore < 0.005,
    `corpus-wide ante is ~unchanged at the shipped factor (${totalBefore} -> ${totalAfter})`
  );
});

test('the x5 share for a 200wpm/35wpm player who knows every word', () => {
  const shipped = CARDS.filter((c) => anteFor(c) === 5).length;
  const flat = CARDS.filter((c) => anteFor(c, DEFAULT_STAGE_MS) === 5).length;
  console.log(`[ante] x5 share — flat 2800ms: ${pct(flat)} · shipped per-card: ${pct(shipped)}`);

  // WHAT WOULD REACH THE TARGET. The brief asked for 55-75% at x5. It is unreachable with
  // factor 0.42 and a 5200ms ceiling, and not because of the corpus: the beat is a FRACTION of
  // the card's own read+type cost, so a player who needs the whole cost can never finish inside
  // one beat. Raising the ceiling alone does nothing while the factor starves it.
  const share = (factor, hi) => {
    const n = CARDS.filter((c) => {
      const beat = Math.min(hi, Math.max(STAGE_MS_MIN, Math.round(c.costMs * factor)));
      return anteFor(c, beat) === 5;
    }).length;
    return (100 * n) / CARDS.length;
  };
  const target = share(0.8, 11000);
  console.log(
    `[ante] x5 at factor 0.42/ceiling 5200 (shipped): ${share(0.42, 5200).toFixed(1)}% · ` +
      `at 0.8/11000: ${target.toFixed(1)}% · at 0.85/9000: ${share(0.85, 9000).toFixed(1)}%`
  );
  assert.ok(target >= 55 && target <= 75, `factor 0.8 + ceiling 11000 lands in the 55-75% band (${target.toFixed(1)}%)`);
  assert.ok(share(0.42, 5200) < 5, 'the shipped constants do not reach the band — this is the finding');
  // The per-card beat is at least never worse than the flat one for this player.
  assert.ok(shipped >= flat, 'the per-card beat does not reduce the x5 share');
});
