// markRolls.test.js — MARK ROLLS engine: odds, pity, dupes, variants, no caps, determinism,
// migration. Spec: claude/econ-oct2/marks-spec.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLL_MARKS, PERMANENT_MARKS, RETIRED_MARK_IDS, ACHIEVEMENT_PLAN, KEPT_ACHIEVEMENTS, TIER_BANDS,
  PITY, DUPES_PER_GOLD, GOLDS_PER_RAINBOW, GOLD_MULT, RAINBOW_MULT, ROLL_STATE_KEY,
  freshState, normalize, rollTable, roll, oneInX, yourOneInX, tierForX, markLevel, perkOf, perkMult,
  mainMultOf, mainTag, perkTag, luck, pityLeft, collection, migrate, rollPriceWords, rollPrice,
  shouldAutoEquip, rollBonusMult, rollAndSave, ensureRollState, equipRolled, loadRollState,
  ROLL_BASE_WORDS, AUTO_EQUIP_MAX_STEP, equipDecision, wornMainOf,
} from './markRolls.js';
import { MARKS, MARKS_OWNED_KEY, MARKS_EQUIPPED_KEY } from './marks.js';
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

test('pool: every tier is read off its X band; mode marks are common, legendaries are all-mode', () => {
  for (const m of ROLL_MARKS) {
    assert.equal(m.tier, tierForX(m.x), m.id);
    if (m.tier === 'legendary') assert.equal(m.modes, null, `${m.id} legendary must be all-mode`);
    if (m.tier === 'common') assert.equal(m.modes.length, 1, `${m.id} common must be one mode`);
  }
  assert.ok(TIER_BANDS.rare < TIER_BANDS.epic && TIER_BANDS.epic < TIER_BANDS.legendary);
  // every mode has at least two commons
  for (const mode of ['wordBomb', 'blitz', 'satRush', 'chain', 'fuse', 'wordRace']) {
    assert.ok(ROLL_MARKS.filter((m) => m.tier === 'common' && m.modes[0] === mode).length >= 2, mode);
  }
  const ids = [...ROLL_MARKS, ...PERMANENT_MARKS].map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique across pool + permanents');
});

test('odds: the table sums to 1 at luck 1, and "1 IN X" is the true base chance', () => {
  const t = rollTable(freshState());
  assert.ok(Math.abs(sumProbs(t) - 1) < 1e-9);
  for (const m of ROLL_MARKS) assert.ok(Math.abs(t.probs.get(m.id) - 1 / m.x) < 1e-12, m.id);
  // the shipped headline numbers
  assert.ok(Math.abs(tierMass(t, 'epic') + tierMass(t, 'legendary') - 0.0403) < 0.001);
  assert.ok(Math.abs(1 / tierMass(t, 'legendary') - 278) < 1);
  assert.equal(oneInX('mk-origin'), 10000);
});

test('luck: scales every non-common chance, commons absorb, sums stay 1, immune mark unmoved', () => {
  const s = freshState();
  for (const permanentOwned of [0, 3, 10, 40, 1000]) {
    const t = rollTable(s, { permanentOwned });
    assert.ok(Math.abs(sumProbs(t) - 1) < 1e-9, `luck ${t.luck}`);
  }
  const t1 = rollTable(s, {});
  const t5 = rollTable(s, { permanentOwned: 10 }); // luck 2
  assert.ok(Math.abs(t5.probs.get('mk-leviathan') / t1.probs.get('mk-leviathan') - 2) < 1e-9);
  assert.equal(t5.probs.get('mk-origin'), t1.probs.get('mk-origin'));
  assert.equal(yourOneInX('mk-leviathan', 2), 200);
  assert.equal(yourOneInX('mk-origin', 2), 10000);
  // absurd luck: commons removed, still a valid table
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

test('pity: first EPIC+ by roll 10, then EPIC+ at least every 40, LEGENDARY at least every 300', () => {
  const rng = () => 0.999999; // the worst possible draw every time (always the last common)
  let s = freshState();
  let firstEpic = 0;
  const epicGaps = [];
  const legGaps = [];
  let lastE = 0;
  let lastL = 0;
  for (let i = 1; i <= 3000; i++) {
    const out = roll(rng, s);
    s = out.state;
    if (out.result.tier === 'epic' || out.result.tier === 'legendary') {
      if (!firstEpic) firstEpic = i;
      epicGaps.push(i - lastE);
      lastE = i;
    }
    if (out.result.tier === 'legendary') {
      legGaps.push(i - lastL);
      lastL = i;
    }
  }
  assert.ok(firstEpic <= PITY.firstEpicBy, `first epic at ${firstEpic}`);
  assert.ok(Math.max(...epicGaps) <= PITY.epic.hard, `epic gap ${Math.max(...epicGaps)}`);
  assert.ok(legGaps.length >= 9 && Math.max(...legGaps) <= PITY.legendary.hard, `leg gap ${Math.max(...legGaps)}`);
});

test('pity: the shown counter counts down to 1 and a forced roll is flagged', () => {
  let s = { ...freshState(), everEpic: true, sinceEpic: 38, rolls: 100 };
  assert.equal(pityLeft(s).epic, 2);
  s = { ...s, sinceEpic: 39 };
  assert.equal(pityLeft(s).epic, 1);
  const out = roll(() => 0.999, s);
  assert.equal(out.result.pityHit, 'epic');
  assert.ok(['epic', 'legendary'].includes(out.result.tier));
  assert.equal(out.state.sinceEpic, 0);
  assert.equal(pityLeft({ ...freshState(), rolls: 3 }).epic, 7, 'first-epic guarantee shows 10 − rolls');
  const leg = roll(() => 0, { ...freshState(), everEpic: true, sinceLegendary: 299 });
  assert.equal(leg.result.pityHit, 'legendary');
  assert.equal(leg.result.tier, 'legendary');
});

test('dupes are never dead: every copy raises the perk; 10 dupes → GOLD, 10 golds → RAINBOW', () => {
  let s = freshState();
  const id = 'mk-bomber';
  let prev = 0;
  let firstGoldAt = 0;
  let firstRainbowAt = 0;
  for (let n = 1; n <= 101; n++) {
    s = { ...s, marks: { ...s.marks, [id]: { n } } };
    const p = perkOf(s, id);
    assert.ok(p > prev, `copy ${n} must raise the perk`);
    prev = p;
    const lv = markLevel(s, id);
    if (lv.gold && !firstGoldAt) firstGoldAt = n;
    if (lv.rainbow && !firstRainbowAt) firstRainbowAt = n;
  }
  assert.equal(firstGoldAt, 1 + DUPES_PER_GOLD); // the 10th dupe
  assert.equal(firstRainbowAt, 1 + DUPES_PER_GOLD * GOLDS_PER_RAINBOW); // the 100th dupe
  // the roll result reports the step-ups
  const at10 = { ...freshState(), marks: { [id]: { n: 10 } } };
  const out = roll(() => 0, { ...at10, everEpic: true }); // u=0 → the first mark in the table = BOMBER
  assert.equal(out.result.markId, id);
  assert.equal(out.result.dupe, true);
  assert.equal(out.result.goldUp, true);
  assert.equal(out.result.rainbowUp, false);
  // variants multiply the perk
  const base = { marks: { [id]: { n: 10 } } };
  const gold = { marks: { [id]: { n: 11 } } };
  assert.ok(Math.abs(perkOf(gold, id) / perkOf(base, id) - (GOLD_MULT * 2.0) / 1.9) < 1e-9);
  const rb = { marks: { [id]: { n: 101 } } };
  assert.ok(Math.abs(perkOf(rb, id) - 0.02 * 11 * RAINBOW_MULT) < 1e-12);
});

test('no caps: absurd counts stay finite and keep growing', () => {
  const id = 'mk-leviathan';
  const a = { ...freshState(), rolls: 1e12, marks: { [id]: { n: 1e12 } } };
  const b = { ...freshState(), rolls: 1e12, marks: { [id]: { n: 2e12 } } };
  for (const v of [perkOf(a, id), perkMult(a, 'fuse'), luck(a), markLevel(a, id).rainbow]) assert.ok(Number.isFinite(v));
  assert.ok(perkOf(b, id) > perkOf(a, id));
  assert.ok(luck(b) > luck(a));
  const t = rollTable(a);
  assert.ok(Math.abs(sumProbs(t) - 1) < 1e-9);
  const out = roll(() => 0.5, a);
  assert.equal(out.state.rolls, 1e12 + 1);
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

test('distribution: 60k seeded rolls land on the published tier odds (pity off by everEpic + reset)', () => {
  const rng = mulberry32(99);
  const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
  const N = 60000;
  for (let i = 0; i < N; i++) {
    // a state far from every pity trigger and not a bonus roll
    const out = roll(rng, { ...freshState(), everEpic: true, rolls: 1 });
    counts[out.result.tier]++;
  }
  assert.ok(Math.abs(counts.common / N - 0.7664) < 0.006);
  assert.ok(Math.abs(counts.rare / N - 0.1933) < 0.006);
  assert.ok(Math.abs(counts.epic / N - 0.0367) < 0.002);
  assert.ok(Math.abs(counts.legendary / N - 0.0036) < 0.0008);
});

test('price: 60 words at your rate (Andy oct3), growing with level, never 0', () => {
  assert.equal(ROLL_BASE_WORDS, 60);
  assert.ok(rollPriceWords(500) > rollPriceWords(1));
  assert.equal(rollPriceWords(1000), 120);
  assert.equal(rollPriceWords(500), 90);
  assert.ok(Math.abs(rollPriceWords(1) - 60.06) < 1e-9);
  assert.equal(rollPrice({ level: 1, rate: 10 }), 601);
  assert.equal(rollPrice({ level: 1000, rate: 10 }), 1200);
  assert.equal(rollPrice({ level: 1, rate: 0 }), 1);
});

test('tags: ONE short tag — MAIN ×N or PERK +X%', () => {
  assert.equal(mainTag('mk-sparky'), 'MAIN ×2');
  assert.equal(mainTag('mk-leviathan'), 'MAIN ×4');
  assert.equal(mainTag('mk-eternal'), 'MAIN ×4');
  assert.equal(perkTag(freshState(), 'mk-sparky'), 'PERK +2%');
  assert.equal(mainMultOf('mk-kraken'), 3);
});

test('auto-equip (Andy oct3): only a HIGHER MAIN, and only up to ×1.5 of the worn one; bigger jumps ASK', () => {
  assert.equal(AUTO_EQUIP_MAX_STEP, 1.5);
  // ×2 → ×2.5 (1.25×) and ×2 → ×3 (exactly 1.5×) are automatic
  assert.equal(equipDecision('mk-detonator', 'mk-sparky'), 'auto');
  assert.equal(equipDecision('mk-kraken', 'mk-sparky'), 'auto', '×3 is exactly ×1.5 of ×2 — inclusive');
  assert.equal(shouldAutoEquip('mk-kraken', 'mk-sparky'), true);
  // ×2 → ×4 (2×) and ×2.5 → ×4 (1.6×) are never automatic — the UI asks EQUIP? ×N → ×M
  assert.equal(equipDecision('mk-leviathan', 'mk-sparky'), 'ask');
  assert.equal(equipDecision('mk-origin', 'mk-phoenix'), 'ask');
  assert.equal(shouldAutoEquip('mk-leviathan', 'mk-sparky'), false);
  // ×3 → ×4 (1.33×) is automatic
  assert.equal(equipDecision('mk-singularity', 'mk-eclipse'), 'auto');
  // nothing worn = ×1, so even the first common (×2) is asked, never forced on
  assert.equal(equipDecision('mk-sparky', null), 'ask');
  assert.equal(shouldAutoEquip('mk-sparky', null), false);
  // HIGHER, not merely rarer: an equal or lower MAIN never replaces the worn one
  assert.equal(equipDecision('mk-dasher', 'mk-sparky'), 'none', 'same tier, same ×2');
  assert.equal(equipDecision('mk-sparky', 'mk-kraken'), 'none');
  assert.equal(equipDecision('mk-leviathan', 'mk-eternal'), 'none', 'a permanent (×4) is never displaced');
  assert.equal(equipDecision('mk-sparky', 'mk-sparky'), 'none');
  // a legacy mark at rank V pays ×2.6: a rare (×2.5) is rarer but LOWER → none
  assert.equal(equipDecision('mk-detonator', 'mk-bomber', 2.6), 'none');
  assert.equal(equipDecision('mk-kraken', 'mk-bomber', 2.6), 'auto', '×3 ≤ 2.6 × 1.5');
  assert.equal(equipDecision('mk-nova', 'mk-student'), 'auto', 'a retired common (×2) → an epic (×3)');
  assert.equal(equipDecision('mk-nope', 'mk-sparky'), 'none');
  assert.equal(wornMainOf(null), 1);
  assert.equal(wornMainOf('mk-curator'), 4, 'permanent MAIN ×4 (Andy oct3)');
});

test('achievements: the keep/cut plan covers EVERY catalog achievement; each keep awards one permanent mark', () => {
  for (const a of ACHIEVEMENTS) assert.ok(ACHIEVEMENT_PLAN[a.id] === 'keep' || ACHIEVEMENT_PLAN[a.id] === 'cut', `${a.id} needs keep/cut`);
  assert.equal(Object.keys(ACHIEVEMENT_PLAN).length, ACHIEVEMENTS.length);
  assert.deepEqual([...KEPT_ACHIEVEMENTS].sort(), PERMANENT_MARKS.map((m) => m.from).sort());
});

test('carry-over: every existing mark is rollable, permanent or retired — none vanishes', () => {
  const home = new Set([...ROLL_MARKS.map((m) => m.id), ...PERMANENT_MARKS.map((m) => m.id), ...RETIRED_MARK_IDS]);
  for (const m of MARKS) assert.ok(home.has(m.id), `${m.id} has no home`);
  for (const m of ROLL_MARKS.filter((x) => x.legacy)) assert.ok(MARKS.some((x) => x.id === m.id), m.id);
  // a legacy mark keeps (at least) its old tier: the overhaul never lowers an owner's MAIN
  const order = ['common', 'rare', 'epic', 'legendary', 'permanent'];
  for (const m of MARKS) {
    const now = ROLL_MARKS.find((x) => x.id === m.id) || PERMANENT_MARKS.find((x) => x.id === m.id);
    if (now) assert.ok(order.indexOf(now.tier) >= order.indexOf(m.tier), `${m.id} ${m.tier} → ${now.tier}`);
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
  // junk in, valid out
  assert.deepEqual(normalize({ rolls: -3, marks: { nope: { n: 4 }, 'mk-wick': { n: 'x' } } }), freshState());
});

test('store: a save that never rolled pays exactly ×1; the store migrates + keeps the worn MAIN', () => {
  withStorage({ [MARKS_OWNED_KEY]: JSON.stringify(['mk-bomber', 'mk-eternal']), [MARKS_EQUIPPED_KEY]: 'mk-eternal' }, (map) => {
    assert.equal(rollBonusMult({ mode: 'wordBomb' }), 1);
    assert.equal(loadRollState(), null);
    const s = ensureRollState();
    assert.equal(s.marks['mk-bomber'].n, 1);
    assert.equal(map.get(MARKS_EQUIPPED_KEY), 'mk-eternal', 'the worn MAIN is untouched');
    assert.ok(JSON.parse(map.get(ROLL_STATE_KEY)).v >= 1);
    // owning BOMBER now pays its PERK in WORD BOMB only
    assert.ok(Math.abs(rollBonusMult({ mode: 'wordBomb' }) - 1.02) < 1e-12);
    assert.equal(rollBonusMult({ mode: 'fuse' }), 1);
    // a roll persists, and a first-time legacy roll joins marks.js's owned set
    const r = rollAndSave(() => 0.999999, {});
    assert.equal(loadRollState().rolls, 1);
    assert.ok(r.markId);
    // wearing a NEW rolled mark pays its MAIN through the hook
    const st = loadRollState();
    st.marks['mk-kraken'] = { n: 1 };
    map.set(ROLL_STATE_KEY, JSON.stringify(st));
    assert.equal(equipRolled('mk-kraken'), true);
    assert.ok(rollBonusMult({ mode: 'chain' }) >= 3);
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
