// markRolls.test.js — MARK ROLLS engine (MARKS via ROLLS, PROGRESSION FINAL): six tiers + odds, the one MARK
// number, pity, dupes → GOLD → RAINBOW, the INDEX bonus, no caps, determinism, migration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLL_MARKS, PERMANENT_MARKS, RETIRED_MARK_IDS, ACHIEVEMENT_PLAN, KEPT_ACHIEVEMENTS, TIER_ODDS, TIER_MAIN,
  PITY, DUPES_PER_GOLD, GOLDS_PER_RAINBOW, GOLD_MULT, RAINBOW_MULT, ROLL_STATE_KEY, INDEX_BONUS_PER_PCT,
  freshState, normalize, rollTable, roll, oneInX, yourOneInX, markLevel, indexMult, markMult,
  mainMultOf, mainTag, perkTag, luck, pityLeft, collection, migrate, rollPriceWords, rollPrice,
  shouldAutoEquip, rollAndSave, ensureRollState, equipRolled, loadRollState,
  ROLL_BASE_WORDS, equipDecision, wornMainOf, SHINY_CHANCE, SHINY_MULT, isShiny,
} from './markRolls.js';
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
  assert.deepEqual(TIER_ODDS, { common: 2, rare: 10, epic: 100, legendary: 1000, mythic: 10000, secret: 100000 });
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
  assert.ok(Math.abs(tierMass(t, 'common') - (1 - 0.11111)) < 1e-9);
  assert.equal(oneInX('mk-origin'), 100000);
  assert.equal(oneInX('mk-leviathan'), 2000, 'two legendaries split 1 IN 1,000');
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
  assert.equal(yourOneInX('mk-leviathan', 2), 1000);
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

test('dupes: 10 dupes → GOLD (MAIN bonus ×2), 10 golds → RAINBOW (×5)', () => {
  const id = 'mk-bomber';
  let firstGoldAt = 0;
  let firstRainbowAt = 0;
  for (let n = 1; n <= 101; n++) {
    const lv = markLevel({ marks: { [id]: { n } } }, id);
    if (lv.gold && !firstGoldAt) firstGoldAt = n;
    if (lv.rainbow && !firstRainbowAt) firstRainbowAt = n;
  }
  assert.equal(firstGoldAt, 1 + DUPES_PER_GOLD);
  assert.equal(firstRainbowAt, 1 + DUPES_PER_GOLD * GOLDS_PER_RAINBOW);
  const at10 = { ...freshState(), marks: { [id]: { n: 10 } } };
  const out = roll(() => 0, { ...at10, everEpic: true }); // u=0 → the first mark in the table = BOMBER
  assert.equal(out.result.markId, id);
  assert.equal(out.result.goldUp, true);
  // GOLD doubles the bonus part, RAINBOW ×5 it
  assert.equal(GOLD_MULT, 2);
  assert.equal(RAINBOW_MULT, 5);
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(close(mainMultOf(id, { marks: { [id]: { n: 1 } } }), 1.1));
  assert.ok(close(mainMultOf(id, { marks: { [id]: { n: 11 } } }), 1.2));
  assert.ok(close(mainMultOf(id, { marks: { [id]: { n: 101 } } }), 1.5));
  assert.ok(close(mainMultOf('mk-origin', { marks: { 'mk-origin': { n: 11 } } }), 49));
  assert.ok(close(mainMultOf('mk-origin', { marks: { 'mk-origin': { n: 101 } } }), 121));
});

test('no caps: absurd counts stay finite', () => {
  const id = 'mk-leviathan';
  const a = { ...freshState(), rolls: 1e12, marks: { [id]: { n: 1e12 } } };
  for (const v of [mainMultOf(id, a), indexMult(a), luck(a), markLevel(a, id).rainbow]) assert.ok(Number.isFinite(v));
  const t = rollTable(a);
  assert.ok(Math.abs(sumProbs(t) - 1) < 1e-9);
  assert.equal(roll(() => 0.5, a).state.rolls, 1e12 + 1);
  assert.ok(Number.isFinite(rollPrice({ level: 1e9, rate: 1e290 })));
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
  assert.ok(Math.abs(counts.common / N - 0.8889) < 0.006);
  assert.ok(Math.abs(counts.rare / N - 0.1) < 0.006);
  assert.ok(Math.abs(counts.epic / N - 0.01) < 0.002);
  assert.ok(Math.abs(counts.legendary / N - 0.001) < 0.0006);
});

test('price: 60 words at your live rate, never 0', () => {
  assert.equal(ROLL_BASE_WORDS, 60);
  assert.equal(rollPriceWords(1), 60);
  assert.equal(rollPriceWords(1000), 60, 'no level scaling — the rate already grows');
  assert.equal(rollPrice({ level: 1, rate: 10 }), 600);
  assert.equal(rollPrice({ level: 1, rate: 12.5 }), 750);
  assert.equal(rollPrice({ level: 1, rate: 0 }), 1);
});

test('tags: ONE short tag — MAIN ×N, or the perk line for LEGENDARY+', () => {
  assert.equal(mainTag('mk-sparky', null), 'MAIN ×1.1');
  assert.equal(mainTag('mk-detonator', null), 'MAIN ×1.25');
  assert.equal(mainTag('mk-leviathan', null), 'MAIN ×3');
  assert.equal(mainTag('mk-kraken', null), 'MAIN ×10');
  assert.equal(mainTag('mk-origin', null), 'MAIN ×25');
  assert.equal(mainTag('mk-eternal', null), 'MAIN ×3', 'a PERMANENT pays the LEGENDARY MAIN');
  assert.equal(perkTag(freshState(), 'mk-sparky'), 'MAIN ×1.1');
  assert.equal(perkTag(freshState(), 'mk-leviathan'), 'WEAR: LETTERS COUNT ×2', 'a perk runs only while worn');
  assert.equal(perkTag(freshState(), 'mk-origin'), 'WEAR: FRENZY IN EVERY MODE + REBIRTH KEEPS 3 KEY TIERS');
});

test('THE MARK: one number — worn MAIN × finish × the INDEX bonus (+0.5% per % collected)', () => {
  assert.equal(INDEX_BONUS_PER_PCT, 0.005);
  assert.equal(markMult({ markId: null, state: null }), 1, 'nothing worn, never rolled → ×1');
  const all = { ...freshState(), marks: Object.fromEntries(ROLL_MARKS.map((m) => [m.id, { n: 1 }])) };
  assert.ok(Math.abs(indexMult(all) - 1.5) < 1e-9, '100% collected → +50%');
  const one = { ...freshState(), marks: { 'mk-kraken': { n: 1 } } };
  const pct = collection(one).pct;
  assert.ok(Math.abs(markMult({ markId: 'mk-kraken', state: one }) - 10 * (1 + 0.005 * pct)) < 1e-9);
  // a legacy mark worn: its marks.js tier's MAIN (BOMBER common ×1.1)
  assert.ok(Math.abs(markMult({ markId: 'mk-bomber', state: null }) - 1.1) < 1e-9);
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
  assert.deepEqual([...KEPT_ACHIEVEMENTS].sort(), PERMANENT_MARKS.map((m) => m.from).sort());
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
    assert.ok(markMult() >= 10, 'the worn MYTHIC pays ×10 (× the index)');
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

test('shiny ×2 the MAIN bonus part, stacking with GOLD / RAINBOW — and markMult (wins + XP) agrees', () => {
  assert.equal(SHINY_MULT, 2);
  const common = ROLL_MARKS.find((m) => m.tier === 'common').id;
  const leg = ROLL_MARKS.find((m) => m.tier === 'legendary').id;
  const secret = ROLL_MARKS.find((m) => m.tier === 'secret').id;
  const st = (id, n, shiny) => normalize({ marks: { [id]: shiny ? { n, shiny: true } : { n } } });
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(mainMultOf(common, st(common, 1, false)), 1.1);
  near(mainMultOf(common, st(common, 1, true)), 1.2); // COMMON ×1.1 → ×1.2
  near(mainMultOf(leg, st(leg, 1, true)), 5); // LEGENDARY ×3 → ×5
  near(mainMultOf(common, st(common, 1 + DUPES_PER_GOLD, true)), 1.4); // GOLD common ×1.2 → ×1.4
  near(mainMultOf(leg, st(leg, 1 + DUPES_PER_GOLD, true)), 9); // GOLD legendary ×5 → ×9
  near(mainMultOf(secret, st(secret, 1 + DUPES_PER_GOLD * GOLDS_PER_RAINBOW, true)), 241); // RAINBOW secret ×121 → ×241
  // markMult = MAIN × INDEX: shiny doubles the MAIN's bonus, the INDEX is unchanged
  const s1 = st(leg, 1, true);
  near(markMult({ markId: leg, state: s1 }), 5 * indexMult(s1));
  near(markMult({ markId: leg, state: st(leg, 1, false) }), 3 * indexMult(s1));
  assert.equal(mainTag(leg, s1), 'MAIN ×5');
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
