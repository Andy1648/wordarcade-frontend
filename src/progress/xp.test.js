// node --test — the pure XP model: level curve, level-from-xp derivation, the anti-mash
// rate cap, the creditable-key filter, and the storage-failure fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  need,
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
    // 250 XP > need(1)=120 → carried to LV2 with 130 into it (250-120).
    assert.equal(after.level, 2);
    assert.equal(after.intoLevel, 130);
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

// ---- level cost curve (Economy v6 — properly exponential where people play) ----
test('need() matches the published early levels 120/160/200/240/310/380/480', () => {
  // n<=60: round10(100·1.25^n). These are the spec's illustrative first-level costs.
  assert.equal(need(1), 120);
  assert.equal(need(2), 160);
  assert.equal(need(3), 200);
  assert.equal(need(4), 240);
  assert.equal(need(5), 310);
  assert.equal(need(6), 380);
  assert.equal(need(7), 480);
});

test('need() eases from 1.25 (early) to a 1.08 tail above LV60, keeping LV600 in range', () => {
  // Below the break each level grows ~1.25×.
  const early = need(30) / need(29);
  assert.ok(early > 1.24 && early < 1.26, `early ratio ${early}`);
  // need(60) is the break value; the tail is need(60)·1.08^(n-60).
  assert.equal(need(60), round10(100 * Math.pow(1.25, 60)));
  const tail = need(100) / need(99);
  assert.ok(tail > 1.07 && tail < 1.09, `tail ratio ${tail}`);
  assert.ok(need(61) > need(60));
  // The gentle tail keeps LV600's cost finite and representable (not the runaway 1.11 top).
  assert.ok(Number.isFinite(need(600)) && need(600) > need(300));
});

test('every level requirement is divisible by 10 (through the exact-integer range)', () => {
  // round10 forces %10===0 by construction; verified where need(n) stays below 2^53 (~LV250).
  for (let n = 1; n <= 250; n++) assert.equal(need(n) % 10, 0, `need(${n})=${need(n)}`);
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

test('keyTierCostAt: the published cost-to-reach table (T0 free), ×5 past T8', () => {
  const costs = [0, 500, 3000, 18000, 108000, 648000, 3888000, 23328000, 139968000];
  costs.forEach((c, t) => assert.equal(keyTierCostAt(t), c, `T${t} cost`));
  // Past T8 the cost keeps going ×5 (JOB B lowered it 6→5), round10: 139968000×5 = 699,840,000.
  assert.equal(keyTierCostAt(9), round10(139968000 * 5));
});

test('keyTierCost is the price to buy the NEXT tier (cost to reach tier+1)', () => {
  assert.equal(keyTierCost(0), 500); // standing at T0, buying T1 costs 500
  assert.equal(keyTierCost(3), 108000); // at T3, T4 costs 108,000
  assert.equal(keyTierCost(7), 139968000); // at T7, T8 costs 139,968,000
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
  // tier 2 (60 XP/letter) + sat-rush (×3) + R1 (×1.5) = 60·3·1.5 = 270.
  assert.equal(xpPerInput({ mode: 'sat-rush', keyTier: 2, rebirthCount: 1 }), 270);
  // tier 4 (375 XP/letter) at menu R0, snapped ×10 → 380.
  assert.equal(xpPerInput({ mode: 'menu', keyTier: 4, rebirthCount: 0 }), round10(375));
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

test('rebirth multiplier table: R1 ×1.5 … R20 ×1e11, then ×10 per rebirth', () => {
  assert.equal(rebirthMult(0), 1); // no rebirths yet
  assert.equal(rebirthMult(1), 1.5); // R1
  assert.equal(rebirthMult(2), 2); // R2
  assert.equal(rebirthMult(9), 8); // R9
  assert.equal(rebirthMult(10), 10); // R10
  assert.equal(rebirthMult(11), 100); // R11
  assert.equal(rebirthMult(19), 1e10); // R19
  assert.equal(rebirthMult(20), 1e11); // R20
  assert.equal(rebirthMult(21), 1e12); // R21 = ×10 past R20
  assert.equal(rebirthMult(22), 1e13); // R22
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
  // 100 into L1 + 20 = 120 = need(1)=120 → carries to L2 with 0 into it (Economy v6 curve).
  const a = creditXp({ level: 1, intoLevel: 100 }, 20);
  assert.equal(a.state.level, 2);
  assert.equal(a.state.intoLevel, 0);
  assert.equal(a.leveledUp, true);
  // 10 into L2 + 10 = 20, still below need(2)=160 → no level-up.
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
