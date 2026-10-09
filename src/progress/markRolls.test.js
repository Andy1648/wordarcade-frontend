// markRolls.test.js — MARK ROLLS engine (MARKS via ROLLS, PROGRESSION FINAL): six tiers + odds, the one MARK
// stats, pity (EPIC 50 + LEGENDARY 125 — oct8, was 500), dupes → ★ pips, the INDEX bonus + rewards, no caps, determinism, migration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLL_MARKS, PERMANENT_MARKS, RETIRED_MARK_IDS, ACHIEVEMENT_PLAN, KEPT_ACHIEVEMENTS, TIER_ODDS, TIER_MAIN,
  PITY, DUPES_PER_PIP, MAX_PIPS, PIP_STEP, ROLL_STATE_KEY, INDEX_BONUS_PER_PCT,
  freshState, normalize, rollTable, roll, oneInX, yourOneInX, markLevel, indexMult, markMult,
  mainMultOf, mainTag, markTag, perkTag, luck, pityLeft, collection, migrate,
  shouldAutoEquip, rollAndSave, ensureRollState, equipRolled, loadRollState, statOf, pipProgress, INDEX_PIP_WORDS,
  markWinsMult, markXpMult, markBaseWins, markBaseXp, markLuck, markOverdriveSec, STAT_KINDS,
  equipDecision, wornMainOf, SHINY_CHANCE, SHINY_MULT, isShiny,
} from './markRolls.js';
const DUPES_PER_GOLD = 10; // the v1 finish, for the migration tests
const GOLDS_PER_RAINBOW = 10;
import { MARKS, MARKS_OWNED_KEY, MARKS_EQUIPPED_KEY, MARK_TIERS } from './marks.js';
import { MARK_ROLLS_STORE_KEY, MARK_PERKS } from './markPerks.js';
import { ACHIEVEMENTS } from './achievements.js';
import { mulberry32 } from './luck.js';

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn(map);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}
const sumProbs = (t) => [...t.probs.values()].reduce((s, p) => s + p, 0);
const tierMass = (t, tier) => ROLL_MARKS.filter((m) => m.tier === tier).reduce((s, m) => s + t.probs.get(m.id), 0);
const TIERS = ['common', 'rare', 'epic', 'legendary', 'mythic', 'secret'];

test('tiers: Andy\'s six tiers, odds and MAINs — and MARK_TIERS says the same MAIN', () => {
  assert.deepEqual(TIER_ODDS, { common: 2, rare: 10, epic: 100, legendary: 250, mythic: 10000, secret: 100000 }); // LEGENDARY 1 IN 250 (Andy oct8; was 1,000)
  assert.deepEqual(TIER_MAIN, { common: 1.1, rare: 1.25, epic: 1.5, legendary: 3, mythic: 10, secret: 25 });
  for (const t of TIERS) assert.ok(Math.abs(1 + MARK_TIERS[t].bonus - TIER_MAIN[t]) < 1e-12, t);
  assert.equal(MARK_ROLLS_STORE_KEY, ROLL_STATE_KEY);
});

test('pool: every tier has a mark; commons are one mode; LEGENDARY+ carry a perk, nothing below does', () => {
  for (const t of TIERS) assert.ok(ROLL_MARKS.some((m) => m.tier === t), t);
  for (const m of ROLL_MARKS) {
    if (m.tier === 'common') assert.equal(m.modes.length, 1, `${m.id} common must be one mode`);
    const top = ['legendary', 'mythic', 'secret'].includes(m.tier);
    assert.equal(m.perks.length > 0, top, `${m.id} (${m.tier}) perk`);
  }
  for (const id of Object.keys(MARK_PERKS)) assert.ok(ROLL_MARKS.some((m) => m.id === id), id);
  for (const mode of ['wordBomb', 'blitz', 'satRush', 'chain', 'fuse', 'wordRace']) {
    assert.ok(ROLL_MARKS.filter((m) => m.tier === 'common' && m.modes[0] === mode).length >= 2, mode);
  }
  const ids = [...ROLL_MARKS, ...PERMANENT_MARKS].map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique across pool + permanents');
});

test('odds: the table sums to 1; each rarer TIER is exactly 1 IN X; commons take the rest', () => {
  const t = rollTable(freshState());
  assert.ok(Math.abs(sumProbs(t) - 1) < 1e-9);
  for (const m of ROLL_MARKS) assert.ok(Math.abs(t.probs.get(m.id) - 1 / m.x) < 1e-12, m.id);
  for (const tier of ['rare', 'epic', 'legendary', 'mythic', 'secret']) {
    assert.ok(Math.abs(tierMass(t, tier) - 1 / TIER_ODDS[tier]) < 1e-12, tier);
  }
  assert.ok(Math.abs(tierMass(t, 'common') - (1 - 0.11411)) < 1e-9); // 1/10 + 1/100 + 1/250 + 1/10,000 + 1/100,000
  assert.equal(oneInX('mk-origin'), 100000);
  assert.equal(oneInX('mk-leviathan'), 500, 'two legendaries split 1 IN 250');
});

test('luck: scales every non-common chance, commons absorb, sums stay 1', () => {
  const s = freshState();
  for (const permanentOwned of [0, 3, 10, 40, 1000]) {
    const t = rollTable(s, { permanentOwned });
    assert.ok(Math.abs(sumProbs(t) - 1) < 1e-9, `luck ${t.luck}`);
  }
  const t1 = rollTable(s, {});
  const t2 = rollTable(s, { permanentOwned: 10 }); // luck 2
  assert.ok(Math.abs(t2.probs.get('mk-leviathan') / t1.probs.get('mk-leviathan') - 2) < 1e-9);
  assert.ok(Math.abs(t2.probs.get('mk-origin') / t1.probs.get('mk-origin') - 2) < 1e-9);
  assert.equal(yourOneInX('mk-leviathan', 2), 250);
  const big = rollTable(s, { permanentOwned: 1e6 });
  assert.equal(tierMass(big, 'common'), 0);
  assert.ok(Math.abs(sumProbs(big) - 1) < 1e-9);
});

test('luck: every 10th roll is a ×2 bonus roll; BOOST adds +1', () => {
  const s = { ...freshState(), rolls: 9 };
  assert.equal(rollTable(s).luck, 2);
  assert.equal(rollTable({ ...s, rolls: 10 }).luck, 1);
  assert.equal(luck(freshState(), { boost: true }), 2);
});

test('pity: first EPIC+ by roll 10, then EPIC-or-better at least every 50 rolls', () => {
  assert.equal(PITY.epic.hard, 50);
  const rng = () => 0.999999; // the worst possible draw every time (always the last common)
  let s = freshState();
  let firstEpic = 0;
  const gaps = [];
  let last = 0;
  for (let i = 1; i <= 3000; i++) {
    const out = roll(rng, s);
    s = out.state;
    if (['epic', 'legendary', 'mythic', 'secret'].includes(out.result.tier)) {
      if (!firstEpic) firstEpic = i;
      gaps.push(i - last);
      last = i;
    }
  }
  assert.ok(firstEpic <= PITY.firstEpicBy, `first epic at ${firstEpic}`);
  assert.ok(gaps.length >= 59 && Math.max(...gaps) <= PITY.epic.hard, `epic gap ${Math.max(...gaps)}`);
});

test('pity: the shown counter counts down to 1 and a forced roll is flagged', () => {
  let s = { ...freshState(), everEpic: true, sinceEpic: 48, rolls: 100 };
  assert.equal(pityLeft(s).epic, 2);
  s = { ...s, sinceEpic: 49 };
  assert.equal(pityLeft(s).epic, 1);
  const out = roll(() => 0.999, s);
  assert.equal(out.result.pityHit, 'epic');
  assert.ok(['epic', 'legendary', 'mythic', 'secret'].includes(out.result.tier));
  assert.equal(out.state.sinceEpic, 0);
  assert.equal(pityLeft({ ...freshState(), rolls: 3 }).epic, 7, 'first-epic guarantee shows 10 − rolls');
});

test('dupes → ★ pips: COMMON 10 / RARE 5 / EPIC 3 / LEGENDARY 2 / MYTHIC+ 1 a pip, ★5 max, +20% of the stat a pip', () => {
  assert.deepEqual(DUPES_PER_PIP, { common: 10, rare: 5, epic: 3, legendary: 2, mythic: 1, secret: 1 });
  assert.equal(MAX_PIPS, 5);
  assert.equal(PIP_STEP, 0.2);
  const v2 = (id, n) => ({ v: 2, marks: { [id]: { n } } });
  for (const m of ROLL_MARKS) {
    const per = DUPES_PER_PIP[m.tier];
    assert.equal(markLevel(v2(m.id, per), m.id).pips, 0, `${m.id} one dupe short`);
    assert.equal(markLevel(v2(m.id, 1 + per), m.id).pips, 1, m.id);
    assert.equal(markLevel(v2(m.id, 1 + 5 * per), m.id).pips, 5, m.id);
    assert.equal(markLevel(v2(m.id, 1e9), m.id).pips, 5, `${m.id} ★5 max`);
  }
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  close(mainMultOf('mk-bomber', v2('mk-bomber', 1)), 1.1);
  close(mainMultOf('mk-bomber', v2('mk-bomber', 11)), 1.12); // ★1: +20% of +10%
  close(mainMultOf('mk-bomber', v2('mk-bomber', 51)), 1.2); // ★5: ×2
  close(mainMultOf('mk-origin', v2('mk-origin', 6)), 49); // SECRET ★5: +2,400% → +4,800%
  close(statOf('mk-sparky', v2('mk-sparky', 51)).value, 2); // +1 BASE WINS → +2 at ★5
});

test('the card line "7/10 → ★3": pipProgress(id) — dupes toward the next pip, and the result says pipUp', () => {
  const st = { v: 2, marks: { 'mk-bomber': { n: 1 + 20 + 7 } } };
  assert.deepEqual(pipProgress('mk-bomber', st), { pips: 2, have: 7, need: 10 });
  assert.deepEqual(pipProgress('mk-bomber', { v: 2, marks: {} }), { pips: 0, have: 0, need: 10 });
  assert.deepEqual(pipProgress('mk-bomber', { v: 2, marks: { 'mk-bomber': { n: 99 } } }), { pips: 5, have: 0, need: 0 });
  assert.equal(pipProgress('nope', st), null);
  const at10 = { ...freshState(), everEpic: true, marks: { 'mk-bomber': { n: 10 } } };
  const out = roll(() => 0, at10); // u=0 → the first mark in the table = BOMBER
  assert.equal(out.result.markId, 'mk-bomber');
  assert.equal(out.result.pipUp, true);
  assert.equal(out.result.pips, 1);
  assert.deepEqual(out.result.rewards.map((r) => r.kind), ['pip']);
  assert.equal(out.result.rewardWords, INDEX_PIP_WORDS.common);
});

test('migration (never hurt): a v1 GOLD / RAINBOW keeps its ×2 / ×5 as a floor; a v1 save is not re-paid', () => {
  const id = 'mk-bomber';
  const gold = normalize({ v: 1, marks: { [id]: { n: 1 + DUPES_PER_GOLD } } });
  const rainbow = normalize({ v: 1, marks: { [id]: { n: 1 + DUPES_PER_GOLD * GOLDS_PER_RAINBOW } } });
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(mainMultOf(id, gold), 1.2); // v1 GOLD was ×1.2; ★1 alone would be ×1.12
  near(mainMultOf(id, rainbow), 1.5); // v1 RAINBOW was ×1.5; ★5 alone would be ×1.2
  near(mainMultOf('mk-origin', normalize({ marks: { 'mk-origin': { n: 11 } } })), 49);
  near(mainMultOf('mk-origin', normalize({ marks: { 'mk-origin': { n: 101 } } })), 121);
  assert.equal(gold.marks[id].k, 2);
  assert.equal(rainbow.marks[id].k, 5);
  assert.equal(normalize(gold).marks[id].k, 2, 'the floor survives a v2 re-read');
  assert.equal(normalize({ v: 1, marks: { [id]: { n: 3 } } }).marks[id].k, undefined);
  // the old luck is a floor too
  assert.ok(luck(rainbow) >= 1.05 - 1e-9);
  // a tier already complete in v1 is marked paid; the legendary pity starts from the save's rolls (≤ 124)
  const allCommons = Object.fromEntries(ROLL_MARKS.filter((m) => m.tier === 'common').map((m) => [m.id, { n: 1 }]));
  const v1 = normalize({ v: 1, rolls: 900, marks: allCommons });
  assert.deepEqual(v1.done, ['common']);
  assert.equal(v1.sinceLegendary, 124);
  assert.equal(normalize({ v: 1, rolls: 120, marks: { 'mk-eclipse': { n: 1 } } }).sinceLegendary, 0);
  assert.equal(normalize({ v: 1, rolls: 120, marks: {} }).sinceLegendary, 120);
  // copies never go down; nothing is removed
  assert.equal(gold.marks[id].n, 1 + DUPES_PER_GOLD);
});

test('no caps: absurd counts stay finite', () => {
  const id = 'mk-leviathan';
  const a = { ...freshState(), rolls: 1e12, marks: { [id]: { n: 1e12 } } };
  for (const v of [mainMultOf(id, a), indexMult(a), luck(a), markLevel(a, id).pips]) assert.ok(Number.isFinite(v));
  const t = rollTable(a);
  assert.ok(Math.abs(sumProbs(t) - 1) < 1e-9);
  assert.equal(roll(() => 0.5, a).state.rolls, 1e12 + 1);
});

test('determinism: the same seed gives the same 500 rolls; the roll is pure', () => {
  const run = (seed) => {
    const rng = mulberry32(seed);
    let s = freshState();
    const ids = [];
    for (let i = 0; i < 500; i++) {
      const out = roll(rng, s, { permanentOwned: 2 });
      s = out.state;
      ids.push(out.result.markId);
    }
    return { ids, s };
  };
  assert.deepEqual(run(1648), run(1648));
  assert.notDeepEqual(run(1648).ids, run(7).ids);
  const s0 = freshState();
  const copy = JSON.stringify(s0);
  roll(() => 0.3, s0);
  assert.equal(JSON.stringify(s0), copy, 'roll() never mutates its input');
});

test('distribution: 60k seeded rolls land on the published tier odds (pity off)', () => {
  const rng = mulberry32(99);
  const counts = { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0, secret: 0 };
  const N = 60000;
  for (let i = 0; i < N; i++) counts[roll(rng, { ...freshState(), everEpic: true, rolls: 1 }).result.tier]++;
  assert.ok(Math.abs(counts.common / N - 0.8859) < 0.006);
  assert.ok(Math.abs(counts.rare / N - 0.1) < 0.006);
  assert.ok(Math.abs(counts.epic / N - 0.01) < 0.002);
  assert.ok(Math.abs(counts.legendary / N - 0.004) < 0.0012);
});

test('GEMS: the wins price is gone from the roll engine (a roll costs gems — markRollShop)', async () => {
  const M = await import('./markRolls.js');
  for (const k of ['ROLL_BASE_WORDS', 'rollPriceWords', 'rollPrice', 'rollPriceNow']) assert.equal(M[k], undefined, k);
});

test('tags: ONE short tag — the stat line, ×N WINS + XP for a PERMANENT, or the perk line for LEGENDARY+', () => {
  assert.equal(mainTag('mk-sparky', null), '+1 BASE WINS');
  assert.equal(mainTag('mk-detonator', null), '×1.25 WINS');
  assert.equal(mainTag('mk-cyclone', null), '+2.5 BASE WINS');
  assert.equal(mainTag('mk-leviathan', null), '×3 XP');
  assert.equal(mainTag('mk-kraken', null), '+90 BASE XP');
  assert.equal(mainTag('mk-origin', null), '×25 WINS');
  assert.equal(mainTag('mk-inkwell', null), '×1.1 ROLL LUCK');
  assert.equal(mainTag('mk-tinder', null), '+75s OVERDRIVE');
  assert.equal(mainTag('mk-eternal', null), '×3 WINS + XP', 'a PERMANENT pays the LEGENDARY MAIN');
  assert.equal(perkTag(freshState(), 'mk-sparky'), '+1 BASE WINS');
  assert.equal(perkTag(freshState(), 'mk-leviathan'), 'WEAR: LETTERS COUNT ×2', 'a perk runs only while worn');
  assert.equal(perkTag(freshState(), 'mk-origin'), 'WEAR: FRENZY IN EVERY MODE + REBIRTH KEEPS 3 POWER TIERS');
});

test('markTag (Andy oct5): the COMPACT line — named stat, PERK: … on LEGENDARY+, ★N once it has pips', () => {
  assert.equal(markTag('mk-sparky', null), '+1 BASE WINS');
  assert.equal(markTag('mk-detonator', null), '×1.25 WINS');
  assert.equal(markTag('mk-leviathan', null), '×3 XP · PERK: LETTERS COUNT ×2');
  assert.equal(markTag('mk-leviathan', null, { perk: false }), '×3 XP');
  assert.equal(markTag('mk-eternal', null), '×3 WINS + XP');
  let n = 1;
  while (markLevel({ marks: { 'mk-sparky': { n } } }, 'mk-sparky').pips < 2) n++;
  const st = { ...freshState(), marks: { 'mk-sparky': { n } } };
  assert.match(markTag('mk-sparky', st), /^\+[\d.,]+ BASE WINS · ★2$/);
  assert.ok(!/MAIN|%/.test(markTag('mk-origin', null)), 'never a bare MAIN, never a %');
});

test('THE MARK STATS: the worn stat pays only what it touches; the INDEX (+0.5% per %) rides on wins AND XP', () => {
  assert.equal(INDEX_BONUS_PER_PCT, 0.005);
  assert.equal(markMult({ markId: null, state: null }), 1, 'nothing worn, never rolled → ×1');
  assert.equal(markWinsMult({ markId: null, state: null }), 1);
  assert.equal(markXpMult({ markId: null, state: null }), 1);
  const all = { ...freshState(), marks: Object.fromEntries(ROLL_MARKS.map((m) => [m.id, { n: 1 }])) };
  assert.ok(Math.abs(indexMult(all) - 1.5) < 1e-9, '100% collected → +50%');
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  const one = (id) => ({ ...freshState(), marks: { [id]: { n: 1 } } });
  const ix = (s) => indexMult(s);
  // +200% WINS (ECLIPSE): ×3 wins, XP only the index
  let s = one('mk-eclipse');
  near(markWinsMult({ markId: 'mk-eclipse', state: s }), 3 * ix(s));
  near(markXpMult({ markId: 'mk-eclipse', state: s }), ix(s));
  assert.equal(markBaseWins({ markId: 'mk-eclipse', state: s }), 0);
  // +90 BASE WINS/WORD (SINGULARITY) — a BASE addend; markMult reads it as × (10 + 90) / 10
  s = one('mk-singularity');
  near(markBaseWins({ markId: 'mk-singularity', state: s }), 90);
  near(markWinsMult({ markId: 'mk-singularity', state: s }), ix(s));
  near(markMult({ markId: 'mk-singularity', state: s }), 10 * ix(s));
  // +90 BASE XP/LETTER (KRAKEN)
  s = one('mk-kraken');
  near(markBaseXp({ markId: 'mk-kraken', state: s }), 90);
  assert.equal(markBaseWins({ markId: 'mk-kraken', state: s }), 0);
  // ROLL LUCK / OVERDRIVE
  near(markLuck({ markId: 'mk-slipstream', state: one('mk-slipstream') }), 0.25);
  near(markOverdriveSec({ markId: 'mk-nitro', state: one('mk-nitro') }), 30);
  near(luck(one('mk-slipstream'), { markLuck: 0.25 }), 1.25);
  // a PERMANENT (no stat) pays its MAIN on wins AND XP, as before
  near(markWinsMult({ markId: 'mk-eternal', state: null }), 3);
  near(markXpMult({ markId: 'mk-eternal', state: null }), 3);
  // every rollable mark's stat is sized to its tier
  const TP = { common: 10, rare: 25, epic: 50, legendary: 200, mythic: 900, secret: 2400 };
  for (const m of ROLL_MARKS) {
    const per = { winsPct: 1, xpPct: 1, luckPct: 1, baseWins: 0.1, baseXp: 0.1, overdriveSec: 3 }[m.stat.kind];
    near(m.stat.value, TP[m.tier] * per);
  }
  const kinds = new Set(ROLL_MARKS.map((m) => m.stat.kind));
  assert.deepEqual([...kinds].sort(), [...STAT_KINDS].sort(), 'every stat kind is in the pool');
  for (const t of ['legendary', 'mythic', 'secret']) {
    assert.ok(ROLL_MARKS.filter((m) => m.tier === t).every((m) => m.perks.length > 0), `${t} keep their perks`);
  }
});

test('auto-equip: ANY higher MAIN equips, always when nothing is worn; never asks', () => {
  withStorage({}, () => {
    assert.equal(equipDecision('mk-detonator', 'mk-sparky'), 'auto');
    assert.equal(equipDecision('mk-kraken', 'mk-sparky'), 'auto');
    assert.equal(equipDecision('mk-origin', 'mk-kraken'), 'auto', '×10 → ×25');
    assert.equal(equipDecision('mk-singularity', 'mk-eclipse'), 'auto', '×3 → ×10');
    assert.equal(shouldAutoEquip('mk-leviathan', 'mk-sparky'), true);
    assert.equal(equipDecision('mk-sparky', null), 'auto');
    for (const m of ROLL_MARKS) for (const w of [null, 'mk-sparky', 'mk-kraken', 'mk-eternal']) {
      assert.ok(['auto', 'none'].includes(equipDecision(m.id, w)), `${m.id} over ${w}`);
    }
    assert.equal(equipDecision('mk-dasher', 'mk-sparky'), 'none', 'same tier, same ×1.1');
    assert.equal(equipDecision('mk-sparky', 'mk-kraken'), 'none');
    assert.equal(equipDecision('mk-leviathan', 'mk-eternal'), 'none', 'a permanent (×3) is not displaced by an equal ×3');
    assert.equal(equipDecision('mk-kraken', 'mk-eternal'), 'auto', 'a MYTHIC (×10) beats a permanent');
    assert.equal(equipDecision('mk-detonator', 'mk-bomber', 1.3), 'none', 'a ×1.25 never displaces a ×1.3');
    assert.equal(equipDecision('mk-nova', 'mk-student'), 'auto', 'a retired common (×1.1) → an epic (×1.5)');
    assert.equal(equipDecision('mk-nope', 'mk-sparky'), 'none');
    assert.equal(wornMainOf(null), 1);
    assert.equal(wornMainOf('mk-curator'), 3, 'permanent MAIN = LEGENDARY ×3');
  });
});

test('achievements: the keep/cut plan covers EVERY catalog achievement; each keep awards one permanent mark', () => {
  for (const a of ACHIEVEMENTS) assert.ok(ACHIEVEMENT_PLAN[a.id] === 'keep' || ACHIEVEMENT_PLAN[a.id] === 'cut', `${a.id} needs keep/cut`);
  assert.equal(Object.keys(ACHIEVEMENT_PLAN).length, ACHIEVEMENTS.length);
  // a RETIRED permanent (BLAZE, Andy oct8) keeps its owners but no achievement awards it any more
  assert.deepEqual([...KEPT_ACHIEVEMENTS].sort(), PERMANENT_MARKS.filter((m) => !m.retired).map((m) => m.from).sort());
});

test('carry-over: every existing mark is rollable, permanent or retired — none vanishes, none drops a tier', () => {
  const home = new Set([...ROLL_MARKS.map((m) => m.id), ...PERMANENT_MARKS.map((m) => m.id), ...RETIRED_MARK_IDS]);
  for (const m of MARKS) assert.ok(home.has(m.id), `${m.id} has no home`);
  for (const m of ROLL_MARKS.filter((x) => x.legacy)) assert.ok(MARKS.some((x) => x.id === m.id), m.id);
  const order = ['common', 'rare', 'epic', 'legendary', 'mythic', 'secret', 'permanent'];
  for (const m of MARKS) {
    const now = ROLL_MARKS.find((x) => x.id === m.id) || PERMANENT_MARKS.find((x) => x.id === m.id);
    if (now) assert.ok(order.indexOf(now.tier) >= order.indexOf(m.tier), `${m.id} ${m.tier} → ${now.tier}`);
    if (now && now.tier !== 'permanent') assert.equal(now.tier, m.tier, `${m.id}: marks.js and the pool agree`);
  }
});

test('migration: owned legacy marks become 1 copy, nothing is lost, idempotent', () => {
  const ownedIds = ['mk-bomber', 'mk-eternal', 'mk-student', 'mk-pyro'];
  const prior = { ...freshState(), marks: { 'mk-bomber': { n: 7 } }, rolls: 50 };
  const a = migrate(prior, { ownedIds });
  assert.equal(a.marks['mk-bomber'].n, 7, 'copies never go down');
  assert.equal(a.marks['mk-pyro'].n, 1);
  assert.equal(a.marks['mk-eternal'], undefined, 'permanents are not in the roll index');
  assert.equal(a.rolls, 50);
  assert.deepEqual(migrate(a, { ownedIds }), a);
  assert.deepEqual(migrate(migrate(null, { ownedIds }), { ownedIds }), migrate(null, { ownedIds }));
  // an old state (with the retired legendary pity counter) still loads
  assert.equal(normalize({ rolls: 5, sinceLegendary: 9, marks: {} }).rolls, 5);
  assert.deepEqual(normalize({ rolls: -3, marks: { nope: { n: 4 }, 'mk-wick': { n: 'x' } } }), freshState());
});

test('store: a save that never rolled with nothing worn pays ×1; the store migrates + keeps the worn MAIN', () => {
  withStorage({ [MARKS_OWNED_KEY]: JSON.stringify(['mk-bomber', 'mk-eternal']) }, (map) => {
    assert.equal(markMult(), 1);
    map.set(MARKS_EQUIPPED_KEY, 'mk-eternal');
    assert.equal(markMult(), 3, 'a worn legacy permanent pays ×3 before any roll');
    assert.equal(loadRollState(), null);
    const s = ensureRollState();
    assert.equal(s.marks['mk-bomber'].n, 1);
    assert.equal(map.get(MARKS_EQUIPPED_KEY), 'mk-eternal', 'the worn MAIN is untouched');
    const r = rollAndSave(() => 0.999999, {});
    assert.equal(loadRollState().rolls, 1);
    assert.ok(r.markId);
    const st = loadRollState();
    st.marks['mk-kraken'] = { n: 1 };
    map.set(ROLL_STATE_KEY, JSON.stringify(st));
    assert.equal(equipRolled('mk-kraken'), true);
    assert.ok(markBaseXp() === 90, 'the worn MYTHIC pays its +90 BASE XP/LETTER');
    assert.equal(equipRolled('mk-leviathan'), false, 'cannot wear an unowned mark');
  });
});

test('index: % collected over the rollable pool; milestones pay once and add luck', () => {
  const half = Object.fromEntries(ROLL_MARKS.slice(0, Math.ceil(ROLL_MARKS.length / 2)).map((m) => [m.id, { n: 1 }]));
  const s = migrate({ ...freshState(), marks: half }, {});
  const c = collection(s);
  assert.ok(c.pct >= 50 && c.pct < 55);
  assert.deepEqual([...s.milestones].sort(), ['base-25', 'base-50']);
  assert.ok(Math.abs(luck(s) - 1.15) < 1e-9);
  const out = roll(() => 0.5, { ...s, everEpic: true });
  assert.ok(!out.result.milestones.includes('base-25'), 'a milestone pays once');
});

// ---------------------------------------------------------------------------------------- SHINY
test('shiny: a flat 1.5% per roll over 200k seeded rolls — and the same with big LUCK and under pity', () => {
  assert.equal(SHINY_CHANCE, 0.015);
  for (const [seed, ctx, base] of [[7, {}, {}], [8, { boost: true, permanentOwned: 10 }, {}], [9, {}, { sinceEpic: 49 }]]) {
    const rng = mulberry32(seed);
    const N = 200000;
    let k = 0;
    for (let i = 0; i < N; i++) if (roll(rng, { ...freshState(), everEpic: true, rolls: 1, ...base }, ctx).result.shiny) k++;
    const p = k / N;
    assert.ok(Math.abs(p - 0.015) < 0.0012, `seed ${seed}: ${p}`); // ~4.4σ
  }
});

test('shiny: the result says so, the mark stays shiny forever (any copy), and a non-shiny roll never clears it', () => {
  const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
  // pick the last common (0.999999), then a shiny draw (0.001)
  const a = roll(seq(0.999999, 0.001), { ...freshState(), everEpic: true, rolls: 1 });
  assert.equal(a.result.shiny, true);
  assert.equal(a.result.shinyNew, true);
  assert.equal(isShiny(a.result.markId, a.state), true);
  const b = roll(seq(0.999999, 0.5), a.state);
  assert.equal(b.result.markId, a.result.markId);
  assert.equal(b.result.shiny, false);
  assert.equal(isShiny(b.result.markId, b.state), true, 'kept forever');
  assert.equal(b.state.marks[a.result.markId].n, 2);
  const c = roll(seq(0.999999, 0.0001), b.state);
  assert.equal(c.result.shiny, true);
  assert.equal(c.result.shinyNew, false, 'already shiny');
  // the draw is exactly the 1.5% line: 0.015 is NOT shiny
  assert.equal(roll(seq(0.999999, 0.015), { ...freshState(), everEpic: true, rolls: 1 }).result.shiny, false);
  assert.equal(roll(seq(0.999999, 0.0149999), { ...freshState(), everEpic: true, rolls: 1 }).result.shiny, true);
});

test('shiny ×2 the stat, stacking with the ★ pips (and a v1 GOLD / RAINBOW floor) — and the wins stat agrees', () => {
  assert.equal(SHINY_MULT, 2);
  const common = ROLL_MARKS.find((m) => m.tier === 'common').id;
  const leg = ROLL_MARKS.find((m) => m.tier === 'legendary').id;
  const secret = ROLL_MARKS.find((m) => m.tier === 'secret').id;
  const st = (id, n, shiny) => normalize({ marks: { [id]: shiny ? { n, shiny: true } : { n } } }); // v1 → GOLD floor kept
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(mainMultOf(common, st(common, 1, false)), 1.1);
  near(mainMultOf(common, st(common, 1, true)), 1.2); // COMMON ×1.1 → ×1.2
  near(mainMultOf(leg, st(leg, 1, true)), 5); // LEGENDARY ×3 → ×5
  near(mainMultOf(common, st(common, 1 + DUPES_PER_GOLD, true)), 1.4); // GOLD common ×1.2 → ×1.4
  near(mainMultOf(leg, st(leg, 1 + DUPES_PER_GOLD, true)), 9); // GOLD legendary ×5 → ×9
  near(mainMultOf(secret, st(secret, 1 + DUPES_PER_GOLD * GOLDS_PER_RAINBOW, true)), 241); // RAINBOW secret ×121 → ×241
  void ROLL_MARKS.find((m) => m.tier === 'common');
  // v2 pips + shiny: LEGENDARY ★1 (+20%) shiny → +200% × 1.2 × 2 = +480%
  near(mainMultOf(leg, { v: 2, marks: { [leg]: { n: 3, shiny: true } } }), 1 + 2 * 1.2 * 2);
  // the wins stat: shiny doubles it, the INDEX is unchanged
  const s1 = st('mk-eclipse', 1, true);
  near(markWinsMult({ markId: 'mk-eclipse', state: s1 }), 5 * indexMult(s1));
  near(markWinsMult({ markId: 'mk-eclipse', state: st('mk-eclipse', 1, false) }), 3 * indexMult(s1));
  assert.equal(mainTag('mk-eclipse', s1), '×5 WINS');
});

test('shiny: persistence + migration — old states read not-shiny; the flag survives normalize, migrate and the store', () => {
  const id = ROLL_MARKS[0].id;
  const old = normalize({ v: 1, rolls: 3, marks: { [id]: { n: 2 } } });
  assert.equal(isShiny(id, old), false);
  assert.deepEqual(old.marks[id], { n: 2 });
  const junk = normalize({ marks: { [id]: { n: 1, shiny: 'yes' } } });
  assert.equal(isShiny(id, junk), false, 'only a literal true counts');
  const sh = normalize({ marks: { [id]: { n: 1, shiny: true } } });
  assert.equal(isShiny(id, sh), true);
  const m = migrate(sh, { ownedIds: [id] });
  assert.equal(isShiny(id, m), true, 'migrate keeps it');
  assert.deepEqual(migrate(m, { ownedIds: [id] }), m, 'idempotent');
  assert.equal(isShiny(id, null), false);
  assert.equal(isShiny('nope', sh), false);
  withStorage({}, (map) => {
    const seq = [0.999999, 0.001];
    let i = 0;
    const res = rollAndSave(() => seq[i++ % 2]);
    assert.equal(res.shiny, true);
    assert.equal(JSON.parse(map.get(ROLL_STATE_KEY)).marks[res.markId].shiny, true);
    assert.equal(isShiny(res.markId, loadRollState()), true);
  });
});
