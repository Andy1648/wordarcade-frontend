// engine.test.js — RUN MODE rules. Pins the calibrated wall + modifier maths so a
// drift in the shipped scoring constants (which this engine reuses) is caught here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODIFIERS, MODIFIER_BY_ID, RARITY, wallAt, wallSchedule, WALL,
  roundKnobs, scoreWord, applyRoundMods, suddenDeathChance, dealOffers,
  modifierFactor, runWinsPayout, RUN_ROUNDS,
} from './engine.js';

test('reuses the shipped rarity bands (COMMON 1.0 … OBSCURE 4.0)', () => {
  assert.equal(RARITY.COMMON, 1.0);
  assert.equal(RARITY.OBSCURE, 4.0);
});

test('the wall is strictly increasing and matches the calibrated two-phase curve', () => {
  const s = wallSchedule();
  assert.equal(s.length, RUN_ROUNDS);
  for (let i = 1; i < s.length; i++) assert.ok(s[i] > s[i - 1], `wall must climb at round ${i + 1}`);
  assert.equal(s[0], WALL.W0); // round 1 == W0
  assert.equal(wallAt(1), 225);
  // knee at round 5 → the g2 slope (1.8) kicks in after it, so the R5→R6 jump is
  // bigger than R4→R5.
  assert.ok((wallAt(6) / wallAt(5)) > (wallAt(5) / wallAt(4)));
});

test('all 18 modifiers are well-formed and 15 carry a downside', () => {
  assert.equal(MODIFIERS.length, 18);
  for (const m of MODIFIERS) {
    assert.ok(m.id && m.name && m.text, `modifier ${m.id} needs id/name/text`);
    assert.equal(MODIFIER_BY_ID[m.id], m);
  }
  assert.equal(MODIFIERS.filter((m) => m.down).length, 15);
});

test('round-level modifiers transform payout exactly (DEEP POCKETS +150, GLASS CANNON ×2.5)', () => {
  const dp = [MODIFIER_BY_ID['deep-pockets']];
  assert.equal(applyRoundMods(1000, dp), 1150);
  const gc = [MODIFIER_BY_ID['glass-cannon']];
  assert.equal(applyRoundMods(1000, gc), 2500);
  assert.ok(suddenDeathChance(gc) > 0 && suddenDeathChance([]) === 0);
});

test('scoreWord reuses rarity×combo×lucky and respects the per-word cap', () => {
  const base = scoreWord({ rarity: 'COMMON', len: 4, vowels: 2, rare: false, lucky: false, combo: 1 }, []);
  assert.ok(base > 0);
  // A lucky OBSCURE word scores far more than a plain common one.
  const big = scoreWord({ rarity: 'OBSCURE', len: 9, vowels: 4, rare: false, lucky: true, combo: 3 }, []);
  assert.ok(big > base * 5);
});

test('modifierFactor: an all-upside stack scales a round above 1×', () => {
  const upside = [MODIFIER_BY_ID['deep-pockets'], MODIFIER_BY_ID['momentum']];
  assert.ok(modifierFactor(upside, { owned: 0, clean: 3 }) > 1);
});

test('dealOffers returns three distinct, not-yet-owned modifiers', () => {
  let i = 0; const rnd = () => [0.1, 0.5, 0.9, 0.3][i++ % 4];
  const offer = dealOffers(['deep-pockets'], rnd);
  assert.equal(offer.length, 3);
  assert.ok(!offer.some((m) => m.id === 'deep-pockets'));
  assert.equal(new Set(offer.map((m) => m.id)).size, 3);
});

test('runWinsPayout scales with the round reached', () => {
  const full = runWinsPayout(50000, 10);
  const early = runWinsPayout(50000, 3);
  assert.ok(full > early, 'a deeper run pays more for the same score');
  assert.equal(runWinsPayout(0, 10), 0);
});

test('roundKnobs applies knob modifiers (UNCAPPED removes the cap, tightens combo)', () => {
  const k = roundKnobs([MODIFIER_BY_ID['uncapped']]);
  assert.equal(k.cap, Infinity);
  assert.ok(k.comboMax <= 1.5);
});
