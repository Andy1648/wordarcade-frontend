// node --test — the pure XP model: level curve, level-from-xp derivation, the anti-mash
// rate cap, the creditable-key filter, and the storage-failure fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  need,
  baseNeed,
  NEED_REBIRTH_BASE,
  CURVE_BASE,
  CURVE_BREAK,
  EARLY_CURVE_EXP,
  TOP_CURVE_EXP,
  REBIRTH_MULT_BASE,
  round10,
  levelFromXp,
  creditXp,
  createRateLimiter,
  isCreditableKey,
  loadProgress,
  saveProgress,
  XP_MULTIPLIERS,
  xpPerInput,
  xpPerWord,
  awardWordXp,
  cappedWordMult,
  PER_WORD_MULT_CAP,
  rebirthThreshold,
  rebirthMult,
  rebirthScaledWins,
  canRebirth,
  doRebirth,
  getRebirths,
  KEY_TIERS,
  keyTierCost,
  keyTierCostAt,
  keyTierXp,
  getKeyTier,
  progressOf,
  XP_KEY,
} from './xp.js';

// A fresh in-memory localStorage installed as the global for a test body.
function withStorage(seed, fn) {
  const saved = globalThis.localStorage;
  const map = new Map(Object.entries(seed || {}));
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
// cumulative XP to REACH a level (sum need(1..L-1)).
function cumCost(level) {
  let acc = 0;
  for (let k = 1; k < level; k++) acc += need(k);
  return acc;
}

// ---- Unified economy (Job 1): per-word XP for in-game play ----
test('cappedWordMult multiplies rarity×combo×lucky and clips at the ×40 cap', () => {
  assert.equal(cappedWordMult(1, 1, 1), 1); // common word, no combo/lucky
  assert.equal(cappedWordMult(2.5, 1, 1), 2.5); // rarity alone
  assert.equal(cappedWordMult(2, 3, 5), 30); // rarity×combo×lucky, under the cap
  assert.equal(cappedWordMult(4.5, 3, 5), PER_WORD_MULT_CAP); // 67.5 → clipped to 40
  assert.equal(cappedWordMult(0, -1, NaN), 1); // garbage factors default to ×1 each
});

test('xpPerWord: menu-value of the letters × mode mult × weight (playing is ≥2× the menu)', () => {
  // R0/T0: keyTierXp(0)=10. A 5-letter COMMON word.
  const menuWord = 5 * xpPerInput({ mode: 'menu', keyTier: 0, rebirthCount: 0, streakMult: 1 }); // 5×10 = 50
  for (const [mode, mult] of Object.entries(XP_MULTIPLIERS)) {
    if (mode === 'menu') continue;
    const xp = xpPerWord({ mode, keyTier: 0, rebirthCount: 0, streakMult: 1, wordLength: 5, weight: 1 });
    assert.equal(xp, round10(10 * 5 * mult)); // 100/100/150/200/250 for the five modes
    assert.ok(xp >= 2 * menuWord, `${mode} should be ≥2× the menu value of the word`);
  }
  // The reward weight scales it linearly (a ×2.5 rare word is worth 2.5× the common grant).
  const common = xpPerWord({ mode: 'chain', keyTier: 0, rebirthCount: 0, streakMult: 1, wordLength: 5, weight: 1 });
  const rare = xpPerWord({ mode: 'chain', keyTier: 0, rebirthCount: 0, streakMult: 1, wordLength: 5, weight: 2.5 });
  assert.equal(rare, round10(common * 2.5));
});

test('awardWordXp persists the grant to the level state', () => {
  withStorage({}, () => {
    const before = loadProgress();
    assert.equal(before.level, 1);
    const res = awardWordXp({ mode: 'fuse', keyTier: 0, rebirthCount: 0, streakMult: 1, wordLength: 5, weight: 1 });
    assert.equal(res.gain, 250); // fuse ×5, 5 letters
    const after = loadProgress();
    // UPDATED (Economy v7): need(1) is 2230, not 120 — the v6 base of 100 made the first levels
    // a formality. One 5-letter FUSE word no longer clears a whole level, which is the point.
    assert.equal(need(1), 2230);
    assert.equal(after.level, 1);
    assert.equal(after.intoLevel, 250);
  });
});

// ---- round10: half-to-even snap (reproduces the published tables) ----
test('round10 snaps to the nearest 10, half-to-even', () => {
  assert.equal(round10(125), 120); // 12.5 → even neighbour 12 (NOT 130 like Math.round)
  assert.equal(round10(135), 140); // 13.5 → even neighbour 14
  assert.equal(round10(124), 120);
  assert.equal(round10(126), 130);
  assert.equal(round10(0), 0);
  for (const v of [0, 25, 125, 156.25, 305.17, 999.99]) assert.equal(round10(v) % 10, 0);
});

// ---- level cost curve (Economy v7 — one shape that only ever STEEPENS) ----
// UPDATED FROM v6. These tests used to pin need(1..7) = 120/160/200/240/310/380/480 (base 100,
// 1.25^n) and a tail that EASED to 1.08 above LV60. Both were the defect, not the spec:
//   - the 1.08 tail made per-level growth FALL while income compounded, so the late game got
//     cheaper per level and the ladder stopped mattering around LV60-80;
//   - base 100 made the first ~40 levels a formality (one accepted word is worth hundreds of XP
//     from minute one).
// v7: base 2000, 1.115^n to LV100, then a STEEPER 1.135 tail. Numbers from claude/econ-curve-sim.mjs.
test('need() matches the published Economy v7 early levels', () => {
  assert.equal(need(1), round10(2000 * Math.pow(1.115, 1)));
  assert.equal(need(1), 2230);
  assert.equal(need(2), 2490);
  assert.equal(need(3), 2770);
  assert.equal(need(7), 4290);
  // Every early level costs MORE than the one before it by a visible step.
  for (let n = 1; n < 60; n++) assert.ok(need(n + 1) > need(n), `need(${n + 1}) must exceed need(${n})`);
});

test('THE TAIL IS STEEPER THAN THE HEAD — the v6 defect, pinned so it cannot come back', () => {
  // This is the whole point of the refit. v6 eased 1.25 -> 1.08 at LV60, so each level past the
  // break was cheaper IN REAL TERMS than the one before while Key Power / rebirth / momentum kept
  // compounding income. A curve may harden; it may never soften.
  assert.ok(TOP_CURVE_EXP > EARLY_CURVE_EXP, 'the tail exponent must EXCEED the early one');
  const early = need(30) / need(29);
  assert.ok(early > 1.11 && early < 1.12, `early ratio ${early}`);
  assert.equal(need(CURVE_BREAK), round10(CURVE_BASE * Math.pow(EARLY_CURVE_EXP, CURVE_BREAK)));
  const tail = need(150) / need(149);
  assert.ok(tail > 1.13 && tail < 1.14, `tail ratio ${tail}`);
  // Sampled across the whole published range: per-level growth NEVER falls.
  let prev = 0;
  for (const n of [10, 25, 50, 99, 101, 150, 200, 300, 500]) {
    const g = need(n) / need(n - 1);
    // 1e-6, not 1e-9: above ~LV150 need(n) is a float well past 2^53 and round10's snap is
    // below the representable step, so consecutive ratios wobble in the 8th decimal. The claim
    // is "the curve never softens", not "float division is exact".
    assert.ok(g >= prev - 1e-6, `growth fell at LV${n}: ${g} < ${prev}`);
    prev = g;
  }
  assert.ok(Number.isFinite(need(600)) && need(600) > need(300));
});

test('every level requirement is divisible by 10 (through the exact-integer range)', () => {
  // round10 forces %10===0 by construction; verified where need(n) stays below 2^53. The v7
  // curve reaches 2^53 around LV190 (v6 did so around LV250), so the exact range is checked to
  // 180 — past that the value is a float and "%10" is a statement about binary rounding, not
  // about the economy.
  for (let n = 1; n <= 180; n++) assert.equal(need(n) % 10, 0, `need(${n})=${need(n)}`);
});

test('XP_MULTIPLIERS are the sanctioned per-mode values', () => {
  assert.equal(XP_MULTIPLIERS.menu, 1);
  assert.equal(XP_MULTIPLIERS['word-bomb'], 2);
  assert.equal(XP_MULTIPLIERS['category-blitz'], 2);
  assert.equal(XP_MULTIPLIERS['sat-rush'], 3);
  assert.equal(XP_MULTIPLIERS.chain, 4);
  assert.equal(XP_MULTIPLIERS.fuse, 5);
});

// ---- Key Power — discrete tiers (Economy v6) ----
test('keyTierXp: the hardcoded XP-per-letter table, ×2.5 past T8', () => {
  const table = [10, 25, 60, 150, 375, 940, 2350, 5875, 14690];
  table.forEach((xp, t) => assert.equal(keyTierXp(t), xp, `T${t}`));
  // Past T8 the effect keeps going ×2.5, round10 (half-to-even): 14690×2.5=36725 → 36720.
  assert.equal(keyTierXp(9), round10(14690 * 2.5));
  assert.equal(keyTierXp(10), round10(round10(14690 * 2.5) * 2.5));
});

test('keyTierCostAt: the published cost-to-reach table (T0 free), ×6 past T8', () => {
  // Post-rebalance (sim/rebalance-2): every cost ×0.18 of the old table, still exactly ×6 per tier.
  const costs = [0, 90, 540, 3240, 19440, 116640, 699840, 4199040, 25194240];
  costs.forEach((c, t) => assert.equal(keyTierCostAt(t), c, `T${t} cost`));
  // Past T8 the cost keeps going ×6, round10: 25194240×6 = 151,165,440.
  assert.equal(keyTierCostAt(9), round10(25194240 * 6));
});

test('keyTierCost is the price to buy the NEXT tier (cost to reach tier+1)', () => {
  assert.equal(keyTierCost(0), 90); // standing at T0, buying T1 costs 90
  assert.equal(keyTierCost(3), 19440); // at T3, T4 costs 19,440
  assert.equal(keyTierCost(7), 25194240); // at T7, T8 costs 25,194,240
});

test('every Key Power tier cost is divisible by 10 (through the exact-integer range)', () => {
  // Costs stay below 2^53 through ~T15; verify %10===0 across that range.
  for (let t = 0; t <= 15; t++) assert.equal(keyTierCostAt(t) % 10, 0, `keyTierCostAt(${t})`);
  assert.equal(KEY_TIERS.length, 9); // T0..T8 hardcoded
});

// ---- level derived from cumulative xp, swept 0..100000 ----
test('level derived from cumulative xp is correct across a 0..100000 sweep', () => {
  // Independent oracle: precompute cumulative thresholds cum[L] = XP needed to REACH L.
  const cum = [0, 0]; // cum[1] = 0 (level 1 starts at 0 xp)
  let acc = 0;
  let L = 1;
  while (acc <= 100000) {
    acc += need(L);
    L += 1;
    cum[L] = acc;
  }
  for (let xp = 0; xp <= 100000; xp++) {
    const r = levelFromXp(xp);
    // cum[level] <= xp < cum[level+1]
    assert.ok(cum[r.level] <= xp, `xp=${xp}: cum[${r.level}]=${cum[r.level]} !<= ${xp}`);
    assert.ok(xp < cum[r.level + 1], `xp=${xp}: ${xp} !< cum[${r.level + 1}]=${cum[r.level + 1]}`);
    // progress fields stay internally consistent
    assert.equal(r.intoLevel, xp - cum[r.level]);
    assert.equal(r.cost, need(r.level));
    assert.equal(r.toNext, r.cost - r.intoLevel);
    assert.ok(r.intoLevel >= 0 && r.intoLevel < r.cost);
    assert.ok(r.frac >= 0 && r.frac < 1);
  }
});

test('levelFromXp: worked example at level 7 (curve-independent)', () => {
  const r = levelFromXp(cumCost(7) + 100); // 100 xp into level 7
  assert.equal(r.level, 7);
  assert.equal(r.cost, need(7));
  assert.equal(r.intoLevel, 100);
  assert.equal(r.toNext, need(7) - 100);
});

test('the XP stack (single source): key tier × mode × rebirth', () => {
  // tier 0 (10 XP/letter) + menu (×1) + R0 (×1) = 10.
  assert.equal(xpPerInput({ mode: 'menu', keyTier: 0, rebirthCount: 0 }), 10);
  // tier 2 (60 XP/letter) + sat-rush (×3) + R1. R1 is ×3 in v7 (it was a ×1.5 table entry) →
  // 60·3·3 = 540. The stack is unchanged; only the rebirth term's VALUE moved.
  assert.equal(xpPerInput({ mode: 'sat-rush', keyTier: 2, rebirthCount: 1 }), 540);
  // tier 4 (375 XP/letter) at menu R0, snapped ×10 → 380.
  assert.equal(xpPerInput({ mode: 'menu', keyTier: 4, rebirthCount: 0 }), round10(375));
});

test('xpPerInput applies pop/sound/streak multipliers (Stats MENU XP / LETTER must match the pop)', () => {
  // The Stats readout now calls xpPerInput with the equipped cosmetic mults, so cosmetics and
  // streak MUST feed the number — the old base×rebirth omitted them and under-reported.
  const base = xpPerInput({ mode: 'menu', keyTier: 2, rebirthCount: 0, streakMult: 1 }); // 60
  assert.equal(base, 60);
  // A PRISM pop (×1.25) must lift it above base, snapped ×10.
  assert.equal(
    xpPerInput({ mode: 'menu', keyTier: 2, rebirthCount: 0, popMult: 1.25, streakMult: 1 }),
    round10(60 * 1.25),
  );
  // pop × sound × streak all stack.
  assert.equal(
    xpPerInput({ mode: 'menu', keyTier: 2, rebirthCount: 0, popMult: 1.1, soundMult: 1.1, streakMult: 1.2 }),
    round10(60 * 1.1 * 1.1 * 1.2),
  );
});

test('rebirth gate table: R1 LV15 … R20 LV600, then +50 levels per rebirth', () => {
  assert.equal(rebirthThreshold(0), 15); // gate for R1
  assert.equal(rebirthThreshold(1), 25); // R2
  assert.equal(rebirthThreshold(3), 60); // R4
  assert.equal(rebirthThreshold(9), 200); // R10
  assert.equal(rebirthThreshold(10), 225); // R11
  assert.equal(rebirthThreshold(19), 600); // R20
  assert.equal(rebirthThreshold(20), 650); // R21 = +50
  assert.equal(rebirthThreshold(21), 700); // R22
});

// UPDATED FROM v6, which tabled the multiplier: R1 ×1.5, R2 ×2 … R10 ×10, then a cliff to ×100
// at R11. The first rebirth was worth HALF a level's income in exchange for wiping the level bar,
// and the steps that were worth having sat behind LV225+. v7 is one exponential, 3^rc, so every
// step is the same meaningful factor and the first one triples your income.
test('rebirth multiplier: a clean 3^rebirths exponential, no table and no cliff', () => {
  assert.equal(rebirthMult(0), 1); // no rebirths yet
  assert.equal(rebirthMult(1), 3); // R1  — v6 paid ×1.5
  assert.equal(rebirthMult(2), 9);
  assert.equal(rebirthMult(3), 27);
  assert.equal(rebirthMult(5), 243);
  assert.equal(rebirthMult(10), 59049); // v6 paid ×10 here
  assert.equal(rebirthMult(20), Math.pow(3, 20));
  // Every step is the SAME factor — the property v6's table did not have.
  for (let rc = 1; rc < 25; rc++) {
    assert.ok(Math.abs(rebirthMult(rc + 1) / rebirthMult(rc) - REBIRTH_MULT_BASE) < 1e-9, `step at R${rc}`);
  }
  // Negative / garbage counts read as R0, never NaN.
  assert.equal(rebirthMult(-3), 1);
  assert.equal(rebirthMult(undefined), 1);
});

test('rebirth is refused at LV14 and allowed at LV15', () => {
  const xp14 = cumCost(14); // exactly at the start of level 14
  const xp15 = cumCost(15); // exactly at the start of level 15
  assert.equal(levelFromXp(xp14).level, 14);
  assert.equal(levelFromXp(xp15).level, 15);
  assert.equal(canRebirth(xp14, 0), false);
  assert.equal(canRebirth(xp15, 0), true);
});

test('doRebirth zeroes xp and preserves wins/owned/equipped/rebirths+1', () => {
  withStorage(
    {
      'taw.xp': String(cumCost(20)),
      'taw.wins': '500',
      'taw.winsLifetime': '900',
      'taw.owned': JSON.stringify(['classic', 'thock', 'prism']),
      'taw.equipped': JSON.stringify({ popStyle: 'prism', soundPack: 'thock' }),
      'taw.rebirths': '1',
      'taw.keytier': '3',
    },
    (map) => {
      const rc = doRebirth();
      assert.equal(rc, 2); // rebirth count bumped
      assert.equal(getRebirths(), 2);
      assert.equal(loadProgress().level, 1); // level reset to 1
      assert.equal(loadProgress().intoLevel, 0); // xp-into-level zeroed
      // everything else untouched (their own keys)
      assert.equal(map.get('taw.wins'), '500');
      assert.equal(map.get('taw.winsLifetime'), '900');
      assert.equal(map.get('taw.owned'), JSON.stringify(['classic', 'thock', 'prism']));
      assert.equal(map.get('taw.equipped'), JSON.stringify({ popStyle: 'prism', soundPack: 'thock' }));
      assert.equal(map.get('taw.keytier'), '3'); // Key Power tier SURVIVES rebirth
      assert.equal(getKeyTier(), 3);
    }
  );
  // a from-scratch rebirth (empty storage) still works and doesn't throw.
  withStorage({}, () => {
    assert.doesNotThrow(() => saveProgress({ level: 1, intoLevel: 0 }));
  });
});

test('creditXp reports a level-up exactly when the boundary is crossed', () => {
  // Written against need() rather than the literal cost, so the curve can be retuned without
  // this test having to be edited again (it is about the CARRY, not about the v7 numbers).
  const a = creditXp({ level: 1, intoLevel: need(1) - 20 }, 20);
  assert.equal(a.state.level, 2);
  assert.equal(a.state.intoLevel, 0);
  assert.equal(a.leveledUp, true);
  // Well short of need(2) → no level-up.
  const b = creditXp({ level: 2, intoLevel: 10 }, 10);
  assert.equal(b.leveledUp, false);
  assert.equal(b.state.level, 2);
  assert.equal(b.state.intoLevel, 20);
});

// ---- Economy v5 storage refactor: {level, intoLevel} + migration ----
test('storage round-trips the {level, intoLevel} shape', () => {
  withStorage({}, (map) => {
    saveProgress({ level: 7, intoLevel: 100 });
    // Persisted as the compact bounded shape, never a cumulative total.
    assert.equal(map.get(XP_KEY), JSON.stringify({ lv: 7, into: 100 }));
    const p = loadProgress();
    assert.equal(p.level, 7);
    assert.equal(p.intoLevel, 100);
  });
});

test('a legacy cumulative taw.xp is migrated to {level, intoLevel} on first read', () => {
  const cumulative = cumCost(7) + 100; // 100 xp into level 7, old cumulative shape (bare number)
  withStorage({ 'taw.xp': String(cumulative) }, (map) => {
    const p = loadProgress();
    assert.equal(p.level, 7);
    assert.equal(p.intoLevel, 100); // already a round 10 here, so floor-to-10 is a no-op
    // The migration rewrote storage in the new compact shape (no longer the huge number).
    assert.equal(map.get('taw.xp'), JSON.stringify({ lv: 7, into: 100 }));
  });
});

test('stored xp-into-level never exceeds one level cost, even after a huge legacy total', () => {
  // A cumulative total that would sit deep in the curve. After migration the STORED `into`
  // is bounded by need(level) — the whole point of the refactor (no MAX_SAFE cliff).
  withStorage({ 'taw.xp': String(cumCost(120) + 500) }, (map) => {
    const p = loadProgress();
    assert.equal(p.level, 120);
    assert.ok(p.intoLevel < need(120));
    const stored = JSON.parse(map.get('taw.xp'));
    assert.equal(stored.lv, 120);
    assert.ok(stored.into < need(120));
  });
});

test('progressOf mirrors the levelFromXp fields from the {level, intoLevel} shape', () => {
  const r = progressOf({ level: 7, intoLevel: 100 });
  assert.equal(r.level, 7);
  assert.equal(r.intoLevel, 100);
  assert.equal(r.cost, need(7));
  assert.equal(r.toNext, need(7) - 100);
  assert.ok(r.frac > 0 && r.frac < 1);
});

// ---- rate cap ----
test('60 keystrokes in one 1000ms window credit exactly 30 (the shipped cap)', () => {
  const rl = createRateLimiter({ capacity: 30, windowMs: 1000 });
  let credited = 0;
  for (let i = 0; i < 60; i++) if (rl.tryConsume(0)) credited++;
  assert.equal(credited, 30);
});

test('createRateLimiter defaults to the shipped cap of 30', () => {
  const rl = createRateLimiter();
  let credited = 0;
  for (let i = 0; i < 60; i++) if (rl.tryConsume(0)) credited++;
  assert.equal(credited, 30);
});

test('rate cap is rolling: the window slides forward', () => {
  const rl = createRateLimiter({ capacity: 8, windowMs: 1000 });
  for (let i = 0; i < 8; i++) assert.ok(rl.tryConsume(0)); // fill the window at t=0
  assert.equal(rl.tryConsume(500), false); // still full mid-window
  assert.equal(rl.tryConsume(1000), true); // t=0 stamp has aged out (1000-0 !< 1000)
});

// ---- creditable-key filter ----
test('e.repeat keystrokes credit 0 (are not creditable)', () => {
  assert.equal(isCreditableKey({ key: 'a', repeat: true }), false);
});

test('a keystroke while an input is focused credits 0', () => {
  assert.equal(isCreditableKey({ key: 'a', target: { tagName: 'INPUT' } }), false);
  assert.equal(isCreditableKey({ key: 'a', target: { tagName: 'TEXTAREA' } }), false);
  assert.equal(isCreditableKey({ key: 'a', target: { isContentEditable: true } }), false);
});

test('modifier chords and non-single-char keys are not creditable; plain a-z/0-9 are', () => {
  assert.equal(isCreditableKey({ key: 'a', ctrlKey: true }), false);
  assert.equal(isCreditableKey({ key: 'a', metaKey: true }), false);
  assert.equal(isCreditableKey({ key: 'a', altKey: true }), false);
  assert.equal(isCreditableKey({ key: 'Enter' }), false);
  assert.equal(isCreditableKey({ key: ' ' }), false);
  assert.equal(isCreditableKey({ key: '-' }), false);
  assert.equal(isCreditableKey({ key: 'a' }), true);
  assert.equal(isCreditableKey({ key: 'Z' }), true);
  assert.equal(isCreditableKey({ key: '7' }), true);
});

// ---- storage failure ----
test('localStorage failure does not throw and defaults to 0', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() {
      throw new Error('storage blocked');
    },
    setItem() {
      throw new Error('storage blocked');
    },
  };
  try {
    const p = loadProgress();
    assert.deepEqual(p, { level: 1, intoLevel: 0 });
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
});

// JOB A.3 — levels stay EXACT to 600 via the incremental {lv, into} path (never a cumulative
// total, which is what overflows 2^53). Crediting exactly need(level) must land on level+1 with
// intoLevel back to 0, every level up to 600, and need() must stay finite the whole way.
test('creditXp is exact to level 600 (no cumulative overflow)', () => {
  let s = { level: 1, intoLevel: 0 };
  for (let lv = 1; lv <= 600; lv += 1) {
    const cost = need(lv);
    assert.ok(Number.isFinite(cost) && cost > 0, `need(${lv}) finite & positive`);
    const r = creditXp(s, cost); // credit exactly this level's cost
    assert.equal(r.level, lv + 1, `crediting need(${lv}) reaches level ${lv + 1}`);
    assert.equal(r.state.intoLevel, 0, `intoLevel resets to 0 at level ${lv + 1}`);
    assert.ok(r.leveledUp, `leveledUp true at ${lv}`);
    s = r.state;
  }
  assert.equal(s.level, 601);
  // And a partial credit stays strictly inside the level (never a NaN/negative from float drift).
  const partial = creditXp({ level: 600, intoLevel: 0 }, need(600) / 2);
  assert.equal(partial.level, 600);
  assert.ok(partial.state.intoLevel > 0 && partial.state.intoLevel < need(600));
});

// The migration walker (levelFromXp) must not overflow/spin on an absurd legacy cumulative.
test('levelFromXp caps instead of overflowing on a huge legacy value', () => {
  const r = levelFromXp(1e300);
  assert.ok(Number.isFinite(r.level) && r.level >= 1, 'level finite');
  assert.ok(Number.isFinite(r.frac) && r.frac >= 0 && r.frac <= 1, 'frac in [0,1]');
});

test('rebirthScaledWins = the amount actually PAID (Collection/Achievement quotes must match)', () => {
  // R0 pays the base; a rebirthed player is paid (and now shown) base × the rebirth multiplier.
  assert.equal(rebirthScaledWins(5000, 0), 5000);
  assert.equal(rebirthScaledWins(5000, 1), Math.round(5000 * rebirthMult(1)));
  // UPDATED (Economy v7): R1 is ×3, not the old table's ×1.5 — so the same flat reward pays 15000.
  assert.equal(rebirthScaledWins(5000, 1), 15000);
  // Guarded input.
  assert.equal(rebirthScaledWins(undefined, 0), 0);
});

// ---------------------------------------------------------------------------------------
// THE REBIRTH TERM. Until this test there was none, and that is exactly how the defect
// survived: every case here called need(n) with no rebirths in storage, so the curve was
// only ever exercised at rc=0, where the missing term is invisible.
// ---------------------------------------------------------------------------------------

test('need() scales with rebirth, and rc=0 is byte-identical to the base curve', () => {
  for (const n of [1, 7, 50, 100, 101, 250]) {
    assert.equal(need(n, 0), baseNeed(n), `rc=0 must not move need(${n})`);
    for (const rc of [1, 3, 10]) {
      assert.equal(
        need(n, rc),
        round10(baseNeed(n) * Math.pow(NEED_REBIRTH_BASE, rc)),
        `need(${n}, R${rc})`,
      );
    }
  }
});

test('THE LADDER SURVIVES A REBIRTH — income may not outrun cost without bound', () => {
  // The defect: income scales rebirthMult = 3^rc and the curve scaled by nothing, so a
  // rebirth bought levels outright. log(3^10)/log(1.115) is about 101 levels — R10 paid for
  // the whole first hundred. What must hold is that the cost term grows too, and by a
  // factor strictly between 1 (no scaling, the defect) and the income multiplier itself
  // (which would cancel rebirth entirely and leave no reason to press it).
  assert.ok(NEED_REBIRTH_BASE > 1, 'a curve that ignores rebirth is the defect');
  assert.ok(
    NEED_REBIRTH_BASE < REBIRTH_MULT_BASE,
    'a curve that matches rebirth exactly makes rebirth worthless',
  );
  for (const rc of [1, 3, 10]) {
    const costFactor = Math.pow(NEED_REBIRTH_BASE, rc);
    const incomeFactor = rebirthMult(rc);
    assert.ok(costFactor > 1, `R${rc} must cost more per level than R0`);
    assert.ok(incomeFactor > costFactor, `R${rc} must still be net faster than R0`);
  }
});

test('creditXp is pure in the rebirth count — the same state and gain, two ladders', () => {
  // creditXp reads rebirths from storage by DEFAULT but takes them as an argument, so the
  // level-carry loop never touches localStorage per level and the function stays testable.
  const gain = baseNeed(1) * 4;
  const at0 = creditXp({ level: 1, intoLevel: 0 }, gain, 0);
  const at3 = creditXp({ level: 1, intoLevel: 0 }, gain, 3);
  assert.ok(at0.level > at3.level, 'the same XP must buy fewer levels after three rebirths');
  assert.equal(creditXp({ level: 1, intoLevel: 0 }, gain, 0).level, at0.level, 'not deterministic');
});

test('levelFromXp walks the SCALED curve, so a rebirthed save reads the right level', () => {
  const total = baseNeed(1) + baseNeed(2) + baseNeed(3) + 10;
  assert.equal(levelFromXp(total, 0).level, 4);
  // the same cumulative buys strictly less after rebirths
  assert.ok(levelFromXp(total, 3).level < 4);
});
