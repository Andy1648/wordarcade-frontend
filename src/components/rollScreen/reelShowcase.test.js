// REEL SHOWCASE (Andy oct9): the far filler cells show EPIC+ more often — VISUAL ONLY. These tests pin that the roll
// itself (odds, pity, the picked mark) is byte-for-byte what it was before the showcase, that the landing cell is the
// result, and that the cells next to the stop keep the live odds (no faked near-miss).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawShowcaseStrip, drawStrip, tableEntries, SHOWCASE, SHOWCASE_GUARD, REEL_LEN, LAND_AT, TIER_LADDER } from './reelPlan.js';
import { rollTable, roll, freshState, ROLL_MARKS, rollMarkById } from '../../progress/markRolls.js';

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
const isEpicPlus = (id) => TIER_LADDER.indexOf(tierOf(id)) >= TIER_LADDER.indexOf('epic');
const r12 = (x) => Math.round(x * 1e12) / 1e12;
const fresh = () => ({ ...freshState(), everEpic: true, rolls: 20, starter: true });
// captured from origin/main BEFORE the showcase landed (same seeds, same states)
const GOLDEN = JSON.parse(readFileSync(new URL('./rollOdds.golden.json', import.meta.url), 'utf8'));

test('the odds and the roll outcome are identical to before the showcase (golden from main)', () => {
  const states = {
    fresh: freshState(),
    pityEpic: { ...freshState(), everEpic: true, rolls: 20, sinceEpic: 9 },
    pityLeg: { ...freshState(), everEpic: true, rolls: 60, sinceEpic: 3, sinceLegendary: 49 },
  };
  for (const [k, s] of Object.entries(states)) {
    const t = rollTable(s, { permanentOwned: 0, markLuck: 0 });
    assert.equal(t.forced, GOLDEN.tables[k].forced, `${k} forced`);
    assert.deepEqual(Object.fromEntries([...t.probs].map(([id, p]) => [id, r12(p)])), GOLDEN.tables[k].probs, `${k} odds`);
  }
  const r = rng(1648);
  let s = freshState();
  const seq = [];
  for (let i = 0; i < 300; i += 1) {
    const o = roll(r, s, { permanentOwned: 0 });
    s = o.state;
    seq.push([o.result.markId, o.result.pityHit || null, o.result.shiny ? 1 : 0]);
  }
  assert.deepEqual(seq, GOLDEN.seq, '300 seeded rolls pick the same marks, pity and shiny');
});

test('the landing cell is the real result and the fillers never read it', () => {
  const { probs } = rollTable(fresh(), { permanentOwned: 0, markLuck: 0 });
  const a = drawShowcaseStrip(probs, rng(5), { resultId: 'mk-origin', marks: ROLL_MARKS });
  const b = drawShowcaseStrip(probs, rng(5), { resultId: 'mk-smith', marks: ROLL_MARKS });
  assert.equal(a.length, REEL_LEN);
  assert.equal(a[LAND_AT], 'mk-origin');
  assert.equal(b[LAND_AT], 'mk-smith');
  a.forEach((id, i) => { if (i !== LAND_AT) assert.equal(id, b[i], `cell ${i} must not change with the result`); });
  const ok = new Set(tableEntries(probs).map((e) => e.id));
  for (const id of a) assert.ok(ok.has(id) || id === 'mk-origin', `${id} is a rollable mark`);
});

test('the 3 cells either side of the stop keep the live odds (no parked near-miss); far fillers are ~37% EPIC+', () => {
  const { probs } = rollTable(fresh(), { permanentOwned: 0, markLuck: 0 });
  const live = {};
  for (const m of ROLL_MARKS) live[m.tier] = (live[m.tier] || 0) + (probs.get(m.id) || 0);
  const liveEpicPlus = 1 - live.rare;
  const r = rng(11);
  let near = 0;
  let nearEpic = 0;
  let far = 0;
  const farTier = {};
  for (let k = 0; k < 6000; k += 1) {
    const strip = drawShowcaseStrip(probs, r, { resultId: 'mk-smith', marks: ROLL_MARKS });
    strip.forEach((id, i) => {
      if (i === LAND_AT) return;
      if (Math.abs(i - LAND_AT) <= SHOWCASE_GUARD) {
        near += 1;
        if (isEpicPlus(id)) nearEpic += 1;
      } else {
        far += 1;
        farTier[tierOf(id)] = (farTier[tierOf(id)] || 0) + 1;
      }
    });
  }
  // near the stop: the live table's EPIC+ share (≈1.4%), nowhere near the showcase's
  const nearShare = nearEpic / near;
  assert.ok(Math.abs(nearShare - liveEpicPlus) < 0.006, `near-stop EPIC+ ${nearShare} vs live ${liveEpicPlus}`);
  assert.ok(nearShare < 0.05);
  // far fillers: 35–40% EPIC+, every showcase tier present, SECRET ≈ 1 in 30
  const farEpicPlus = (far - (farTier.rare || 0)) / far;
  assert.ok(farEpicPlus > 0.35 && farEpicPlus < 0.4, `far EPIC+ ${farEpicPlus}`);
  for (const t of Object.keys(SHOWCASE)) assert.ok(farTier[t] > 0, `${t} shows`);
  const secret = farTier.secret / far;
  assert.ok(secret > 1 / 40 && secret < 1 / 24, `secret ${secret}`);
});

test('the showcase never changes the live-odds draw (drawStrip) and with no marks it is a plain live strip', () => {
  const { probs } = rollTable(fresh(), { permanentOwned: 0, markLuck: 0 });
  assert.deepEqual(drawShowcaseStrip(probs, rng(3), { resultId: 'mk-nova' }), drawStrip(probs, rng(3), { resultId: 'mk-nova' }));
});

test('a pity-forced (EPIC+) table still yields only EPIC+ cells', () => {
  const t = rollTable({ ...fresh(), sinceEpic: 9 }, { permanentOwned: 0, markLuck: 0 });
  assert.equal(t.forced, 'epic');
  for (const id of drawShowcaseStrip(t.probs, rng(9), { resultId: 'mk-nova', marks: ROLL_MARKS })) assert.ok(isEpicPlus(id));
});
