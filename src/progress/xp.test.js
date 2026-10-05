// node --test — the pure XP model: level curve, level-from-xp derivation, the anti-mash
// rate cap, the creditable-key filter, and the storage-failure fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  need,
  needV9,
  MENU_LETTER_SHARE,
  levelXpPerLetter,
  CURVE_BASE,
  CURVE_BREAK,
  EARLY_CURVE_EXP,
  CURVE_POW,
  CURVE_TAIL,
  CURVE_TAIL_EXP,
  keyXpMult,
  rebirthXpMult,
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
// awardWordXp MOVED to wins.js in Economy v8: one accepted word is one award event with one
// multiplier stack, so the function that performs it sits where momentum and the mark's wins
// effect are visible. It is still tested here, next to the curve it credits into.
import { awardWordXp } from './wins.js';

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
// cumulative XP to REACH a level (sum needV9(1..L-1)) — a LEGACY cumulative total (levelFromXp walks v9).
function cumCost(level) {
  let acc = 0;
  for (let k = 1; k < level; k++) acc += needV9(k);
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

test('xpPerWord (Rebirth Rush): BONUS (mark × boost) passes through; DIFFICULTY is ignored', () => {
  const o = { mode: 'word-bomb', keyTier: 0, rebirthCount: 0, streakMult: 1, wordLength: 5, weight: 1 };
  assert.equal(xpPerWord(o), 100); // 10 wins
  assert.equal(xpPerWord({ ...o, difficultyMult: 1, bonusMult: 1 }), 100);
  assert.equal(xpPerWord({ ...o, difficultyMult: 2 }), 100, 'difficulty is not in the frozen formula');
  assert.equal(xpPerWord({ ...o, bonusMult: 1.5 }), 150);
  assert.equal(xpPerWord({ ...o, difficultyMult: 2, bonusMult: 1.5 }), 150);
  // Garbage is guarded to ×1, never NaN.
  assert.equal(xpPerWord({ ...o, difficultyMult: 0, bonusMult: -1 }), 100);
  assert.equal(xpPerWord({ ...o, difficultyMult: undefined, bonusMult: NaN }), 100);
});

test('THE FROZEN WINS FORMULA: 10 × len/5 × MODE POWER × 5^R × BONUS (in ×10 units: wins = this ÷ 10)', () => {
  const w = (mode, extra = {}) => xpPerWord({ mode, keyTier: 0, rebirthCount: 0, streakMult: 1, wordLength: 5, weight: 1, ...extra }) / 10;
  // A 5-letter word at R0: WB 10 wins, SAT ×5, CHAIN ×2, RACE ×1.5, BLITZ / FUSE = WB.
  assert.equal(w('word-bomb'), 10);
  assert.equal(w('category-blitz'), 10);
  assert.equal(w('fuse'), 10);
  assert.equal(w('sat-rush'), 50);
  assert.equal(w('chain'), 20);
  assert.equal(w('word-race'), 15);
  // Length scales linearly: 10 letters = ×2, 3 letters = 6 wins.
  assert.equal(w('word-bomb', { wordLength: 10 }), 20);
  assert.equal(w('word-bomb', { wordLength: 3 }), 6);
  // REBIRTH ×5 a rebirth: R1 ×5, R2 ×25.
  assert.equal(w('word-bomb', { rebirthCount: 1 }), 50);
  assert.equal(w('word-bomb', { rebirthCount: 2 }), 250);
  assert.equal(w('sat-rush', { rebirthCount: 2 }), 1250);
  // KEY tier, weight (rarity × combo × lucky), streak and difficulty do NOT touch wins.
  assert.equal(w('word-bomb', { keyTier: 9 }), 10);
  assert.equal(w('word-bomb', { weight: 4.5 }), 10);
  assert.equal(w('word-bomb', { streakMult: 1.5 }), 10);
  assert.equal(w('word-bomb', { difficultyMult: 2 }), 10);
  // A huge rebirth count stays finite.
  assert.ok(Number.isFinite(xpPerWord({ mode: 'sat-rush', rebirthCount: 2000, wordLength: 12, bonusMult: 50 })));
});

test('awardWordXp credits NO per-word XP — only the accepted letters top-up (v11 amended, RR anti-gibberish)', () => {
  withStorage({}, () => {
    const before = loadProgress();
    assert.equal(before.level, 1);
    const res = awardWordXp({ mode: 'fuse', keyTier: 0, rebirthCount: 0, streakMult: 1, masteryMult: 1, wordLength: 5, weight: 1 });
    assert.equal(res.gain, 100); // the WINS product (fuse ×2, 5 letters) — wins = 10
    assert.equal(res.leveledUp, false);
    const after = loadProgress();
    assert.equal(after.level, 1);
    assert.equal(after.intoLevel, 40, 'the bar moved only by 5 letters × 10 × 0.8 (the typed 0.2 came from the input)');
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

// ---- level cost curve (Economy v8 head, v9 polynomial + geometric tail — never gets cheaper) ----
// The v6 defect is still pinned below (a tail that got CHEAPER per level). What changed in v8 is
// the scale: base 2,000 -> 600, exponents 1.085/1.135 -> 1.16/1.22, break LV100 -> LV30, and the
// exponent indexes off n-1 so CURVE_BASE is need(1) exactly instead of a number nobody pays.
test('need() matches the PROGRESSION FINAL curve: round10(100 · 1.15^(n−1)) (one curve for everyone)', () => {
  // Literals, not derived from the constants under test — a test that restates the
  // implementation passes whatever the implementation says.
  assert.equal(need(1), 100); // ten game letters at a fresh profile
  assert.equal(need(2), 110);
  assert.equal(need(7), 230);
  assert.equal(need(10), 350);
  assert.equal(need(15), 710);
  assert.equal(need(30), 5760);
  assert.equal(need(33), 8760);
  assert.equal(need(50), 94230);
  assert.equal(need(100), 102114210);
  // Every level costs MORE than the one before it, by the same ~15% (no sudden jumps).
  for (let n = 1; n < 2000; n++) assert.ok(need(n + 1) > need(n), `need(${n + 1}) must exceed need(${n})`);
  for (let n = 30; n < 2000; n++) assert.ok(need(n + 1) / need(n) > 1.145 && need(n + 1) / need(n) < 1.155, `step at LV${n}`);
});

test('THE CURVE NEVER GETS CHEAPER PER LEVEL — the v6 defect, pinned against the FROZEN v9 shape (needV9)', () => {
  // v6 eased 1.25 -> 1.08 at LV60, so a level could cost LESS than the one before it while Key Tier /
  // rebirth / momentum kept compounding income. v9 (STEP 19) deliberately trades v8's geometric ×1.22
  // tail for a polynomial (level^CURVE_POW) above CURVE_BREAK and a gentle geometric tail past
  // CURVE_TAIL — the RELATIVE growth per level now falls on purpose. What must still hold: every
  // level costs more than the last (needV9(n+1)/needV9(n) > 1), and the per-level STEP never shrinks
  // (needV9(n+1) - needV9(n) >= needV9(n) - needV9(n-1)) — the curve may flatten in ratio, never in cost.
  assert.equal(CURVE_POW, 4);
  assert.equal(CURVE_TAIL, 300);
  const early = needV9(30) / needV9(29);
  assert.ok(early > 1.155 && early < 1.165, `early ratio ${early}`); // 1.16
  assert.equal(needV9(CURVE_BREAK), round10(CURVE_BASE * Math.pow(EARLY_CURVE_EXP, CURVE_BREAK - 1)));
  // Polynomial section: needV9(n) = needV9(30) × (n/30)^4.
  const base = needV9(CURVE_BREAK);
  for (const n of [31, 60, 100, 200, 300]) {
    assert.equal(needV9(n), round10(base * Math.pow(n / CURVE_BREAK, CURVE_POW)), `poly needV9(${n})`);
  }
  assert.equal(needV9(60), 710560); // 16 × needV9(30), round10
  assert.equal(needV9(300), 444100000); // 10^4 × needV9(30)
  // Geometric tail past CURVE_TAIL: exactly ×CURVE_TAIL_EXP a level, and it HARDENS the curve again
  // (the tail ratio is steeper than the last polynomial step).
  const tail = needV9(400) / needV9(399);
  assert.ok(Math.abs(tail - CURVE_TAIL_EXP) < 1e-6, `tail ratio ${tail}`);
  assert.ok(CURVE_TAIL_EXP > needV9(CURVE_TAIL) / needV9(CURVE_TAIL - 1), 'the tail must not be gentler than the polynomial it follows');
  // Every level costs strictly more than the one before, across the whole playable range.
  for (let n = 2; n <= 1500; n++) assert.ok(needV9(n) / needV9(n - 1) > 1, `needV9(${n}) must exceed needV9(${n - 1})`);
  // ...and the step between levels never shrinks, through the exact-integer range (beyond it the
  // values are floats and "difference" is a statement about binary rounding).
  for (let n = 3; n < 870; n++) {
    assert.ok(needV9(n) - needV9(n - 1) >= needV9(n - 1) - needV9(n - 2), `the step to LV${n} shrank`);
  }
  assert.ok(Number.isFinite(needV9(600)) && needV9(600) > needV9(300));
});

test('every level requirement is divisible by 10 (through the exact-integer range)', () => {
  // round10 forces %10===0 by construction; verified where needV9(n) stays below 2^53. The v9 curve
  // is polynomial to LV300 and ×1.03 after, so it reaches 2^53 at LV870 (v8's ×1.22 tail did at
  // LV161) — past that the value is a float and "%10" is about binary rounding, not the economy.
  for (let n = 1; n < 870; n++) assert.equal(needV9(n) % 10, 0, `needV9(${n})=${needV9(n)}`);
  assert.ok(needV9(869) <= Number.MAX_SAFE_INTEGER, 'LV869 is still an exact integer');
  assert.ok(needV9(870) > Number.MAX_SAFE_INTEGER, 'the exact-integer range is checked to its edge');
});

// THE HEADLINE NUMBER, pinned on its own so a retune has to come here first.
test('need(1) is 100 — ten game letters at a fresh profile (BASE 10 XP / LETTER; 50 menu keys at 2)', () => {
  assert.equal(need(1), 100);
  assert.equal(Math.ceil(need(1) / levelXpPerLetter(0, 0)), 10);
  assert.equal(Math.ceil(need(1) / xpPerInput({ keyTier: 0, rebirthCount: 0 })), 50);
});

test('XP_MULTIPLIERS are the sanctioned per-mode values', () => {
  assert.equal(XP_MULTIPLIERS.menu, 1);
  assert.equal(XP_MULTIPLIERS['word-bomb'], 2);
  assert.equal(XP_MULTIPLIERS['category-blitz'], 2);
  assert.equal(XP_MULTIPLIERS['sat-rush'], 10); // oct2 POWER ×5
  assert.equal(XP_MULTIPLIERS.chain, 4);
  assert.equal(XP_MULTIPLIERS.fuse, 2); // oct2: = Word Bomb; FRENZY is its edge
});

// ---- Key Tier — RESTORED v8 (Andy oct2 KP2): XP ×2.5 a tier, price ×6 a tier in wins ----
test('keyTierXp (Rebirth Rush): KEY no longer touches wins — the constant wins basis 20 at every tier', () => {
  for (const t of [0, 1, 5, 9, 10, 30, 1000, -3, undefined, NaN]) assert.equal(keyTierXp(t), 20, `T${t}`);
});

test('KEY ladder: ×1, ×2, ×5, ×10, ×25, ×50, ×100, ×250, ×500, ×1000 (T0–T9), then ×2.15 a tier', () => {
  const ladder = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
  ladder.forEach((m, t) => assert.equal(keyXpMult(t), m, `T${t}`));
  assert.equal(keyXpMult(10), 2150);
  assert.equal(keyXpMult(11), 4622.5);
  assert.ok(Math.abs(keyXpMult(12) - 9938.375) < 1e-6);
  for (let t = 10; t <= 200; t++) assert.ok(Math.abs(keyXpMult(t) / keyXpMult(t - 1) - 2.15) < 1e-9, `T${t} is ×2.15`);
  // Guarded: garbage reads as T0, absurd tiers stay finite.
  assert.equal(keyXpMult(-3), 1);
  assert.equal(keyXpMult(undefined), 1);
  assert.equal(keyXpMult(2.9), 5, 'floors the tier');
  assert.ok(Number.isFinite(keyXpMult(5000)));
});

test('keyTierCostAt (Rebirth Rush, tuned): round10(48 · 6^(t−1)) wins to REACH tier t, flat (no rebirth scaling)', () => {
  const costs = [0, 50, 290, 1730, 10370, 62210, 373250, 2239490, 13436930, 80621570, 483729410];
  costs.forEach((c, t) => assert.equal(keyTierCostAt(t, 0), c, `T${t} cost`));
  for (let t = 4; t <= 300; t++) assert.ok(Math.abs(keyTierCostAt(t, 0) / keyTierCostAt(t - 1, 0) - 6) < 0.01, `T${t} ×6`);
  assert.equal(keyTierCostAt(5, 7), 62210, 'flat across rebirths');
  assert.equal(keyTierCostAt(-1, 0), 0);
  assert.ok(Number.isFinite(keyTierCostAt(5000, 0)));
});

test('NO CAPS: T60+ prices and effects are finite and display through the named-suffix ladder', async () => {
  const { formatNum } = await import('../format.js');
  for (const t of [60, 100, 200, 300]) {
    const x = keyXpMult(t);
    const c = keyTierCostAt(t, 0);
    assert.ok(Number.isFinite(x) && Number.isFinite(c), `T${t} finite`);
    for (const v of [x, c]) {
      const s = formatNum(v);
      assert.ok(/^[\d.]+[A-Za-z]+$/.test(s) && !/e\+|NaN|Infinity/.test(s), `T${t}: ${v} -> ${s}`);
    }
  }
});


test('keyTierCost is the price to buy the NEXT tier (cost to reach tier+1)', () => {
  assert.equal(keyTierCost(0, 0), 50); // standing at T0, buying T1 costs 50
  assert.equal(keyTierCost(3, 0), 10370); // at T3, T4 costs 10,370
  for (let t = 0; t < 40; t++) {
    assert.equal(keyTierCost(t, 0), keyTierCostAt(t + 1, 0));
    assert.equal(keyTierCost(t, 2), keyTierCostAt(t + 1, 2));
  }
});

test('every Key Tier cost is divisible by 10 (through the exact-integer range)', () => {
  // ×6 a tier, snapped to tens while exact: through T18 (48·6^17 ≈ 8e14 < 2^53).
  for (let t = 0; t <= 18; t += 1) assert.equal(keyTierCostAt(t, 0) % 10, 0, `keyTierCostAt(${t})`);
  assert.equal(KEY_TIERS.length, 9); // T0..T8 tabled for the shop
});

// ---- level derived from cumulative xp, swept 0..100000 ----
test('level derived from cumulative xp is correct across a 0..100000 sweep', () => {
  // Independent oracle: precompute cumulative thresholds cum[L] = XP needed to REACH L.
  const cum = [0, 0]; // cum[1] = 0 (level 1 starts at 0 xp)
  let acc = 0;
  let L = 1;
  while (acc <= 100000) {
    acc += needV9(L);
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
    assert.equal(r.cost, needV9(r.level));
    assert.equal(r.toNext, r.cost - r.intoLevel);
    assert.ok(r.intoLevel >= 0 && r.intoLevel < r.cost);
    assert.ok(r.frac >= 0 && r.frac < 1);
  }
});

test('levelFromXp: worked example at level 7 (curve-independent)', () => {
  const r = levelFromXp(cumCost(7) + 100); // 100 xp into level 7
  assert.equal(r.level, 7);
  assert.equal(r.cost, needV9(7));
  assert.equal(r.intoLevel, 100);
  assert.equal(r.toNext, needV9(7) - 100);
});

test('the MENU letter: a FIFTH of a game letter — 2 × KEY ladder × 5^R × mark, no mode term', () => {
  assert.equal(MENU_LETTER_SHARE, 0.2);
  assert.equal(xpPerInput({ keyTier: 0, rebirthCount: 0 }), 2);
  assert.equal(xpPerInput({ keyTier: 5, rebirthCount: 0 }), 100); // 2 × 50
  assert.equal(xpPerInput({ keyTier: 2, rebirthCount: 1 }), 50); // 2 × 5 × 5
  assert.equal(xpPerInput({ keyTier: 0, rebirthCount: 0, markMult: 1.5 }), 3); // a LEGENDARY worn mark
  assert.equal(levelXpPerLetter(0, 0), 10, 'a GAME letter is BASE 10');
  // a game mode does not multiply a letter (words pay WINS; a letter is a letter)
  assert.equal(xpPerInput({ mode: 'sat-rush', keyTier: 2, rebirthCount: 1 }), xpPerInput({ keyTier: 2, rebirthCount: 1 }));
});

test('cosmetics are LOOKS ONLY: pop / sound multipliers and the streak never touch XP (v11 round 2)', () => {
  const base = xpPerInput({ mode: 'menu', keyTier: 2, rebirthCount: 0 });
  assert.equal(xpPerInput({ mode: 'menu', keyTier: 2, rebirthCount: 0, popMult: 3, soundMult: 2.3 }), base);
  assert.equal(xpPerInput({ keyTier: 2, rebirthCount: 0, streakMult: 1.25 }), base);
});

test('rebirth gate (Rebirth Rush): LV 15 + 18R', () => {
  assert.equal(rebirthThreshold(0), 15); // gate for R1
  assert.equal(rebirthThreshold(1), 33); // R2
  assert.equal(rebirthThreshold(3), 69); // R4
  assert.equal(rebirthThreshold(9), 177); // R10
  assert.equal(rebirthThreshold(10), 195); // R11
  assert.equal(rebirthThreshold(19), 357); // R20
  assert.equal(rebirthThreshold(20), 375); // R21
  assert.equal(rebirthThreshold(30), 555); // R31
  assert.equal(rebirthThreshold(-2), 15);
  assert.equal(rebirthThreshold(NaN), 15);
  for (let rc = 0; rc < 200; rc++) assert.equal(rebirthThreshold(rc + 1) - rebirthThreshold(rc), 18, `gate R${rc}`);
});

// REBIRTH RUSH: ×5 XP AND wins per rebirth, forever — 5^R, the same number on the bar and on wins.
test('rebirth multiplier: 5^R on wins and on XP (R1 ×5, R2 ×25, R10 ×9,765,625)', () => {
  assert.equal(rebirthMult(0), 1); // no rebirths yet
  assert.equal(rebirthMult(1), 5);
  assert.equal(rebirthMult(2), 25);
  assert.equal(rebirthMult(5), 3125);
  assert.equal(rebirthMult(10), 9765625);
  assert.equal(rebirthMult(2.9), 25); // floors the count
  for (let rc = 0; rc < 100; rc++) assert.equal(rebirthXpMult(rc), rebirthMult(rc), `XP = wins at R${rc}`);
  // Negative / garbage counts read as R0, never NaN; absurd counts stay finite.
  assert.equal(rebirthMult(-3), 1);
  assert.equal(rebirthMult(undefined), 1);
  assert.equal(rebirthMult(NaN), 1);
  assert.ok(Number.isFinite(rebirthMult(5000)));
});

test('XP per letter = 10 × KEY × 5^R × mark — finite at any R / tier', () => {
  assert.equal(levelXpPerLetter(0, 0), 10);
  assert.equal(levelXpPerLetter(1, 0), 20);
  assert.equal(levelXpPerLetter(9, 0), 10000);
  assert.equal(levelXpPerLetter(0, 1), 50);
  assert.equal(levelXpPerLetter(3, 2), 2500); // 10 × 10 × 25
  assert.equal(levelXpPerLetter(2, 1, 1.5), 375); // 10 × 5 × 5 × 1.5
  for (const [t, r] of [[30, 430], [300, 1000], [5000, 5000]]) {
    const v = levelXpPerLetter(t, r, 1.5);
    assert.ok(Number.isFinite(v) && v > 0, `T${t} R${r}: ${v}`);
  }
});

test('rebirth is refused at LV14 and allowed at LV15', () => {
  const xp14 = cumCost(14); // exactly at the start of level 14
  const xp15 = cumCost(15); // exactly at the start of level 15
  assert.equal(levelFromXp(xp14).level, 14);
  assert.equal(levelFromXp(xp15).level, 15);
  assert.equal(canRebirth(xp14, 0), false);
  assert.equal(canRebirth(xp15, 0), true);
});

test('doRebirth zeroes xp, RESETS the KEY tier to T0, and preserves wins/owned/equipped/rebirths+1', () => {
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
      assert.equal(map.get('taw.keytier'), '0'); // Rebirth Rush: KEY resets every rebirth (wins kept)
      assert.equal(getKeyTier(), 0);
      assert.equal(keyTierCost(getKeyTier(), rc), 50, 'the rebuy starts at the T1 price');
    }
  );
  // A second rebirth from a re-bought tier resets it again.
  withStorage({ 'taw.rebirths': '4', 'taw.keytier': '9', 'taw.wins': '123' }, (map) => {
    assert.equal(doRebirth(), 5);
    assert.equal(getKeyTier(), 0);
    assert.equal(map.get('taw.wins'), '123');
  });
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
    // PV10: persisted as {lv, f, rc, v:10} — the FRACTION into the level, never the XP number.
    assert.equal(map.get(XP_KEY), JSON.stringify({ lv: 7, f: 100 / need(7), rc: 0, v: 10 }));
    assert.equal(map.get('taw.xpv10'), map.get(XP_KEY), 'the shadow mirrors every write');
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
    // The FRACTION is what converts (100 of the frozen v9 need(7)); v11 shows it against its own need(7).
    assert.ok(Math.abs(p.frac - 100 / needV9(7)) < 1e-12);
    assert.ok(Math.abs(p.intoLevel - (100 / needV9(7)) * need(7)) < 1e-6);
    // The migration rewrote storage in the v10 shape (no longer the huge number).
    assert.equal(map.get('taw.xp'), JSON.stringify({ lv: 7, f: 100 / needV9(7), rc: 0, v: 10 }));
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
    assert.ok(stored.f >= 0 && stored.f < 1);
    assert.equal(stored.into, undefined, 'the XP number is never stored');
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
    assert.deepEqual(p, { level: 1, intoLevel: 0, frac: 0 });
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
  // Below the walk cap: an absurd-but-reachable total resolves to a sane level and fill.
  const r = levelFromXp(1e100);
  assert.ok(Number.isFinite(r.level) && r.level >= 1, 'level finite');
  assert.ok(Number.isFinite(r.frac) && r.frac >= 0 && r.frac <= 1, 'frac in [0,1]');
  // Past the cap (v9's ×1.03 tail means 1e300 is beyond LV10,000): the loop stops at the cap and
  // every field stays finite — it must never spin or produce NaN/Infinity.
  const huge = levelFromXp(1e300);
  assert.equal(huge.level, 10000);
  for (const k of ['level', 'intoLevel', 'cost', 'toNext', 'frac']) assert.ok(Number.isFinite(huge[k]), `${k} finite`);
});

test('rebirthScaledWins = the amount actually PAID (Collection/Achievement quotes must match)', () => {
  // R0 pays the base; a rebirthed player is paid (and shown) base × the rebirth multiplier.
  assert.equal(rebirthScaledWins(5000, 0), 5000);
  for (const rc of [1, 2, 5, 10]) {
    assert.equal(rebirthScaledWins(5000, rc), Math.round(5000 * rebirthMult(rc)), `R${rc}`);
  }
  // Rebirth Rush (5^R): R1 ×5 → 25,000; R2 ×25 → 125,000; R10 → 48,828,125,000.
  assert.equal(rebirthScaledWins(5000, 1), 25000);
  assert.equal(rebirthScaledWins(5000, 2), 125000);
  assert.equal(rebirthScaledWins(5000, 10), 48828125000);
  // Guarded input.
  assert.equal(rebirthScaledWins(undefined, 0), 0);
});
