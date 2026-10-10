// gearPoolV2.test.js — GEAR POOL v2 (Andy oct9: "remove the common ones entirely … add more gears … make epic a 1 in 10
// pity and legendary a 1 in 50"). Every gear unique; every gear's PRINTED stat is exactly what it pays (at ★0, at ★
// pips, shiny); the new abilities are wired (one-mode WINS, crit MAIN stats, EVERY Nth KEY, FREE OVERDRIVE, AFTERBURN,
// DRUMROLL); the COMMON retirement migration refunds 15 gems a copy, once (idempotent); the Genshin pity holds.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLL_MARKS, statOf, statText, mainTag, markWinsMult, markXpMult, markBaseWins, markBaseXp, markLuck, markOverdriveSec,
  indexMult, critTotals, critStatsOf, CRIT_BASE_RATE, CRIT_BASE_POWER, CRIT_RATE_CAP, MODE_WINS_KINDS, modeOfKind,
  freshState, normalize, roll, rollTable, PITY, ROLL_STATE_KEY, ROLL_STATE_VERSION, commonRefund, migrateRollSave,
  REMOVED_COMMON_IDS, RETIRED_COMMON_IDS, COMMON_REFUND_GEMS, loadRollState, clearRollNote, tierRank, scaleStat,
  DUPES_PER_PIP, MAX_PIPS,
} from './markRolls.js';
import { MARKS_EQUIPPED_KEY, MARKS_OWNED_KEY } from './marks.js';
import { PERKS, MARK_PERKS, CRIT_PERK_EVERY, FREE_OD_SEC, FREE_OD_EVERY_MIN } from './markPerks.js';
import { critKeyAt } from './crit.js';
import { critSummary } from './critText.js';
import { getGems, GEMS_KEY } from './gemsCore.js';
import { notePlay, overdriveRemaining, overdriveLengthMs, OVERDRIVE_KEY } from './overdrive.js';
import { flavourOf, FLAVOUR_MAX } from './markFlavour.js';
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
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);
const own = (id, n = 1, shiny = false) => ({ ...freshState(), marks: { [id]: shiny ? { n, shiny: true } : { n } } });
/** The number a printed stat line carries: "×1.5 WINS IN WORD BOMB" → 1.5, "+25% CRIT RATE" → 25, "EVERY 4TH KEY" → 4. */
function printed(text) {
  if (/^EVERY KEY/.test(text)) return 1;
  const m = /^(?:EVERY )?[+×]?([\d,]*\.?\d+)/.exec(text);
  assert.ok(m, `no number in "${text}"`);
  return Number(m[1].replace(/,/g, ''));
}

test('the pool: 27 gears, no COMMON; no two share a MAIN stat (kind AND value), nor a printed line', () => {
  assert.equal(ROLL_MARKS.length, 27);
  assert.ok(!ROLL_MARKS.some((m) => m.tier === 'common'));
  for (const id of [...REMOVED_COMMON_IDS, ...RETIRED_COMMON_IDS]) assert.ok(!ROLL_MARKS.some((m) => m.id === id), id);
  const keys = ROLL_MARKS.map((m) => `${m.stat.kind}:${m.stat.value}`);
  assert.equal(new Set(keys).size, keys.length, `twins: ${keys.filter((k, i) => keys.indexOf(k) !== i)}`);
  const lines = ROLL_MARKS.map((m) => mainTag(m.id, null));
  assert.equal(new Set(lines).size, lines.length);
  // every gear: a name, a flavour line (≤ 32), a stat line that names a real kind
  for (const m of ROLL_MARKS) {
    assert.ok(m.name && m.name === m.name.toUpperCase(), m.id);
    assert.ok(flavourOf(m.id) && flavourOf(m.id).length <= FLAVOUR_MAX, `${m.id} flavour`);
    assert.ok(statText(m.stat), `${m.id} stat line`);
    // a one-mode WINS gear's stat IS its mode
    if (modeOfKind(m.stat.kind)) assert.deepEqual(m.modes, [modeOfKind(m.stat.kind)], m.id);
  }
  // every perk a gear carries is a real perk with a line
  for (const ps of Object.values(MARK_PERKS)) for (const p of ps) assert.ok(PERKS[p] && PERKS[p].line, p);
});

test('every gear PRINTS what it PAYS — at ★0, ★ pips and SHINY, read through the payout readers', () => {
  const states = (id) => {
    const per = DUPES_PER_PIP[ROLL_MARKS.find((m) => m.id === id).tier];
    return [own(id, 1), own(id, 1 + per * 2), own(id, 1 + per * MAX_PIPS, true)];
  };
  for (const m of ROLL_MARKS) {
    for (const s of states(m.id)) {
      const st = statOf(m.id, s);
      const text = mainTag(m.id, s);
      const shown = printed(text);
      const opts = { markId: m.id, state: s };
      const ix = indexMult(s);
      const crit = critTotals({ markId: m.id, mark2Id: null, state: s });
      const sub = critStatsOf(m.id, s);
      const tag = `${m.id} "${text}"`;
      switch (st.kind) {
        case 'winsPct': near(markWinsMult(opts) / ix, shown, tag); break;
        case 'xpPct': near(markXpMult(opts) / ix, shown, tag); break;
        case 'baseWins': near(markBaseWins(opts), shown, tag); break;
        case 'baseXp': near(markBaseXp(opts), shown, tag); break; // season 1 prints the raw +N (season 2: N/10, v3 test)
        case 'luckPct': near(1 + markLuck(opts), shown, tag); break;
        case 'overdriveSec': near(markOverdriveSec(opts), shown, tag); break;
        case 'critRatePct': near(crit.rawRate, CRIT_BASE_RATE + sub.rate + shown / 100, tag); break;
        case 'critPower': near(crit.power, CRIT_BASE_POWER + sub.power + shown, tag); break;
        case 'critEvery': assert.equal(crit.every, shown, tag); break;
        default: {
          const mode = modeOfKind(st.kind);
          assert.ok(mode, `${tag}: unknown kind`);
          near(markWinsMult({ ...opts, mode }) / ix, shown, `${tag} in its mode`);
          for (const other of Object.keys(MODE_WINS_KINDS)) if (other !== mode) near(markWinsMult({ ...opts, mode: other }) / ix, 1, `${tag} never in ${other}`);
          near(markXpMult({ ...opts, mode }) / ix, 1, `${tag} never on XP`);
        }
      }
      // a stat that is not WINS / XP pays neither
      if (st.kind !== 'winsPct' && !modeOfKind(st.kind)) near(markWinsMult(opts) / ix, 1, `${tag} not on WINS`);
      if (st.kind !== 'xpPct') near(markXpMult(opts) / ix, 1, `${tag} not on XP`);
    }
  }
});

test('the crit MAIN stats: PHOENIX rate (capped), SPARKPLUG / VOLTAGE / THUNDERCLAP power, METRONOME every 4th → 2nd at ★5', () => {
  assert.equal(scaleStat('critRatePct', 25, 4), CRIT_RATE_CAP * 100, 'a rate stat never prints past the cap');
  const ph = critTotals({ markId: 'mk-phoenix', mark2Id: null, state: own('mk-phoenix') });
  near(ph.rate, 0.01 + 0.03 + 0.25, 'PHOENIX: base 1% + RARE 3% + 25%');
  const v = critTotals({ markId: 'mk-voltage', mark2Id: null, state: own('mk-voltage') });
  near(v.power, 2 + 0.5 + 2, 'VOLTAGE: ×2 + EPIC 0.5 + 2');
  assert.equal(critTotals({ markId: 'mk-metronome', mark2Id: null, state: own('mk-metronome') }).every, 4);
  assert.equal(critTotals({ markId: 'mk-metronome', mark2Id: null, state: own('mk-metronome', 26) }).every, 2);
  // the 2nd slot never lends its MAIN stat to crit (minimal model: WINS / XP only)
  near(critTotals({ markId: null, mark2Id: 'mk-phoenix', state: own('mk-phoenix') }).rate, 0.01 + 0.03, '2nd slot: subs only');
  // DRUMROLL (THUNDERCLAP's perk): every 10th key, only while worn and owned
  assert.equal(critTotals({ markId: 'mk-thunderclap', mark2Id: null, state: own('mk-thunderclap') }).every, CRIT_PERK_EVERY);
  assert.equal(critTotals({ markId: 'mk-thunderclap', mark2Id: null, state: freshState() }).every, 0, 'not owned → no perk');
  // the STATS line counts the guaranteed crits
  const s = critSummary({ rate: 0.03, power: 2, every: 4 });
  assert.equal(s.oneIn, 4);
  near(s.avg, 0.25 + 0.75 * 0.03, 'avg = (1/4 + 3/4 × 3%) × (2 − 1)');
});

test('critKeyAt: EVERY Nth key is a sure crit paying × POWER; the rest roll the rate; every 0 = none', () => {
  const crit = { rate: 0, power: 2.5, every: 4 };
  const hits = [];
  for (let i = 1; i <= 12; i += 1) hits.push(critKeyAt(i, 10, crit, () => 0.99));
  assert.deepEqual(hits.map((h) => h.crit), [false, false, false, true, false, false, false, true, false, false, false, true]);
  assert.equal(hits[3].gain, 25);
  assert.equal(hits[3].forced, true);
  assert.equal(hits[0].gain, 10);
  assert.equal(critKeyAt(4, 10, { rate: 0, power: 2, every: 0 }, () => 0.99).crit, false);
  assert.equal(critKeyAt(1, 10, { rate: 1, power: 2, every: 4 }, () => 0.5).crit, true, 'a rolled crit still happens off the beat');
});

test('one-mode WINS: every mode has its gear; HEADMASTER ×5 in SAT RUSH (season 1 = 2 × LEGENDARY +200%)', () => {
  const s = own('mk-headmaster');
  near(markWinsMult({ markId: 'mk-headmaster', state: s, mode: 'satRush' }) / indexMult(s), 5, 'SAT');
  assert.equal(mainTag('mk-headmaster', null), '×5 WINS IN SAT RUSH');
  assert.equal(mainTag('mk-hydra', null), '×19 WINS IN WORD BOMB');
  for (const mode of Object.keys(MODE_WINS_KINDS)) assert.ok(ROLL_MARKS.some((m) => m.stat.kind === MODE_WINS_KINDS[mode]), mode);
});

test('FREE OVERDRIVE (every MYTHIC+): 60 s of ×10 after 15 min of play while worn; never while a mythic is not worn', () => {
  assert.equal(FREE_OD_SEC, 60);
  assert.equal(FREE_OD_EVERY_MIN, 15);
  for (const m of ROLL_MARKS) assert.equal(m.perks.includes('freeOd'), tierRank(m.tier) >= tierRank('mythic'), m.id);
  const seedWorn = (id) => ({ [ROLL_STATE_KEY]: JSON.stringify(own(id)), [MARKS_EQUIPPED_KEY]: id });
  withStorage(seedWorn('mk-hydra'), (map) => {
    // the random OVERDRIVE is 30–60 min away (rng → 60 min); feed 15 min of play in 5 s gaps
    let now = 1e12;
    let started = 0;
    for (let i = 0; i < (15 * 60) / 5; i += 1) {
      now += 5000;
      if (notePlay(5000, now, () => 1)) started += 1;
    }
    assert.equal(started, 1, 'exactly one FREE OVERDRIVE in the first 15 min');
    assert.equal(overdriveRemaining(now), 60000);
    assert.equal(JSON.parse(map.get(OVERDRIVE_KEY)).freeMs, 0, 'its clock restarts');
  });
  withStorage(seedWorn('mk-eclipse'), () => {
    let now = 1e12;
    let started = 0;
    for (let i = 0; i < (15 * 60) / 5; i += 1) {
      now += 5000;
      if (notePlay(5000, now, () => 1)) started += 1;
    }
    assert.equal(started, 0, 'a LEGENDARY has no FREE OVERDRIVE');
  });
});

test('AFTERBURN (HEADMASTER): an OVERDRIVE runs ×2 as long, only while worn', () => {
  withStorage({}, () => assert.equal(overdriveLengthMs(), 300000));
  withStorage({ [ROLL_STATE_KEY]: JSON.stringify(own('mk-headmaster')), [MARKS_EQUIPPED_KEY]: 'mk-headmaster' }, () => assert.equal(overdriveLengthMs(), 600000));
});

test('PITY (Genshin): EPIC+ every ≤ 10, LEGENDARY+ every ≤ 50, over 100k seeded rolls; the 10th roll never inflates LEGENDARY+', () => {
  assert.equal(PITY.epic.hard, 10);
  assert.equal(PITY.legendary.hard, 50);
  const rng = mulberry32(2026);
  let s = freshState();
  let lastE = 0;
  let lastL = 0;
  let gapE = 0;
  let gapL = 0;
  for (let i = 1; i <= 100000; i += 1) {
    const o = roll(rng, s);
    s = o.state;
    const r = tierRank(o.result.tier);
    if (r >= tierRank('epic')) { gapE = Math.max(gapE, i - lastE); lastE = i; }
    if (r >= tierRank('legendary')) { gapL = Math.max(gapL, i - lastL); lastL = i; }
  }
  assert.ok(gapE <= 10, `EPIC+ gap ${gapE}`);
  assert.ok(gapL <= 50, `LEGENDARY+ gap ${gapL}`);
  // the 10th-roll table: LEGENDARY+ keep their normal chance, EPIC takes the rest, nothing below EPIC
  const base = rollTable({ ...freshState(), rolls: 1 });
  const forced = rollTable({ ...freshState(), rolls: 1, sinceEpic: 9 });
  assert.equal(forced.forced, 'epic');
  for (const m of ROLL_MARKS) {
    if (tierRank(m.tier) >= tierRank('legendary')) near(forced.probs.get(m.id), base.probs.get(m.id), m.id);
    if (m.tier === 'rare') assert.equal(forced.probs.get(m.id), 0, m.id);
  }
  near([...forced.probs.values()].reduce((a, b) => a + b, 0), 1, 'sums to 1');
});

test('PITY IS A PROMISE: an old drought carries over, capped one short of the new guarantee', () => {
  const s = normalize({ v: 2, rolls: 300, everEpic: true, sinceEpic: 37, sinceLegendary: 110, marks: {} });
  assert.equal(s.sinceEpic, 9);
  assert.equal(s.sinceLegendary, 49);
  assert.equal(rollTable(s).forced, 'legendary', 'past the new 50 → the next roll is the guarantee');
  const t = normalize({ v: 2, rolls: 30, everEpic: true, sinceEpic: 4, sinceLegendary: 20, marks: {} });
  assert.deepEqual([t.sinceEpic, t.sinceLegendary], [4, 20], 'inside the new window → unchanged');
});

test('commonRefund (pure): 15 gems a copy — rolled copies, plus a marks.js-owned COMMON the roll state never counted', () => {
  const raw = { v: 2, marks: { 'mk-bomber': { n: 7 }, 'mk-wick': { n: 2 }, 'mk-smith': { n: 3 } } };
  const r = commonRefund(raw, { ownedIds: ['mk-bomber', 'mk-student', 'mk-scholar'], wornId: 'mk-wick' });
  assert.equal(r.copies, 7 + 2 + 1, 'BOMBER 7 (not +1 for the owned list), WICK 2, STUDENT 1');
  assert.equal(r.gems, 10 * COMMON_REFUND_GEMS);
  assert.equal(r.unequip, true);
  assert.deepEqual(commonRefund({ v: 3, marks: {} }, { ownedIds: [], wornId: 'mk-smith' }), { copies: 0, gems: 0, ids: [], unequip: false });
  assert.equal(commonRefund(null).copies, 0);
  assert.equal(commonRefund({ marks: { 'mk-bomber': { n: 'x' } } }).copies, 0, 'junk counts nothing');
});

test('migrateRollSave: commons deleted + refunded once, a worn COMMON unequipped, the note shown once; idempotent', () => {
  const raw = { v: 2, rolls: 80, everEpic: true, sinceEpic: 30, sinceLegendary: 70, skipBelow: 'common',
    marks: { 'mk-bomber': { n: 5, first: 1 }, 'mk-nitro': { n: 1 }, 'mk-smith': { n: 2 }, 'mk-nova': { n: 1, shiny: true } } };
  withStorage({
    [ROLL_STATE_KEY]: JSON.stringify(raw), [MARKS_OWNED_KEY]: JSON.stringify(['mk-bomber', 'mk-magpie', 'mk-pyro']),
    [MARKS_EQUIPPED_KEY]: 'mk-bomber', [GEMS_KEY]: JSON.stringify({ v: 1, bal: 100, peak: 1, streak: 0, mig: 1 }),
  }, (map) => {
    const r = migrateRollSave();
    assert.equal(r.copies, 5 + 1 + 1, 'BOMBER ×5, NITRO ×1, MAGPIE (owned) ×1');
    assert.equal(getGems(), 100 + 7 * 15);
    const s = JSON.parse(map.get(ROLL_STATE_KEY));
    assert.equal(s.v, ROLL_STATE_VERSION);
    assert.deepEqual(Object.keys(s.marks).sort(), ['mk-nova', 'mk-smith'], 'only the commons left');
    assert.equal(s.marks['mk-nova'].shiny, true, 'the rest untouched');
    assert.equal(s.rolls, 80);
    assert.deepEqual([s.sinceEpic, s.sinceLegendary], [9, 49], 'droughts carried, capped');
    assert.equal(s.skipBelow, 'epic', 'a "< COMMON" skip reads as the default');
    assert.deepEqual(s.note, { commons: 7, gems: 105 });
    assert.deepEqual(JSON.parse(map.get(MARKS_OWNED_KEY)), ['mk-pyro']);
    assert.equal(map.get(MARKS_EQUIPPED_KEY), undefined, 'the worn COMMON is taken off');
    // IDEMPOTENT: a second boot refunds nothing and changes nothing
    const snap = JSON.stringify([...map.entries()]);
    assert.equal(migrateRollSave(), null);
    assert.equal(getGems(), 205);
    assert.equal(JSON.stringify([...map.entries()]), snap);
    // the INDEX shows the note once
    assert.deepEqual(loadRollState().note, { commons: 7, gems: 105 });
    clearRollNote();
    assert.equal(loadRollState().note, undefined);
    assert.equal(migrateRollSave(), null);
  });
  // a never-rolled save that only owns a marks.js COMMON: refunded, and the roll state is born v3 with the note
  withStorage({ [MARKS_OWNED_KEY]: JSON.stringify(['mk-veteran']) }, (map) => {
    assert.equal(migrateRollSave().gems, 15);
    assert.equal(getGems(), 15);
    assert.equal(JSON.parse(map.get(ROLL_STATE_KEY)).v, ROLL_STATE_VERSION);
    assert.equal(migrateRollSave(), null);
    assert.equal(getGems(), 15);
  });
  // a clean save: nothing happens, nothing is written
  withStorage({}, (map) => {
    assert.equal(migrateRollSave(), null);
    assert.equal(map.size, 0);
  });
});

test('ACHIEVEMENTS: FILL INDEX no longer counts a retired COMMON (its top tier, 27, is now every gear)', async () => {
  const { achRows, ACHIEVEMENTS_V3 } = await import('./v3/achievements.js');
  const counters = { marks: ['mk-bomber', 'mk-wick', 'mk-student', 'mk-smith', 'mk-nova'] };
  const row = achRows(counters, {}).find((r) => r.id === 'index');
  assert.equal(row.have, 2, 'only SMITH and NOVA count');
  assert.equal(ACHIEVEMENTS_V3.find((a) => a.id === 'index').T.at(-1), ROLL_MARKS.length);
});
