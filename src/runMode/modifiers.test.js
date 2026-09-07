// modifiers.test.js — RUN MODE (fix/run-deck). ONE test per modifier (18) asserting the
// STATED player-facing text matches the effect that is actually APPLIED by the live scoring
// path (engine.js `scoreWord`/`roundKnobs`/`applyRoundMods`/`suddenDeathChance`, wired by
// useRunMode.js). Each test pins the number the card's text promises.
//
// Background: a prior audit + 200-run sim found several cards whose text did not match effect,
// dead knobs (`owned`, `wprMul`, `luckyOdds`), and strictly-dominated cards (raised combo caps
// no 16-word round could reach). These tests lock the fixes so they cannot silently regress.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODIFIER_BY_ID, roundKnobs, scoreWord, applyRoundMods, suddenDeathChance,
  PER_WORD_CAP, BASE_WIN_PER_WORD, WORDS_PER_ROUND,
} from './engine.js';
import { makeLuckyOracle, LUCKY_ODDS } from '../progress/luck.js';

const id = (x) => MODIFIER_BY_ID[x];
const W = (o = {}) => ({ rarity: 'COMMON', len: 4, vowels: 2, rare: false, lucky: false, combo: 1, ...o });
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
// The word-mult multiplier a stack applies to a fixed word (score ratio vs. empty stack).
const wordRatio = (mod, w) => scoreWord(w, [mod]) / scoreWord(w, []);
// Count lucky procs over a long fixed stream so an odds knob's effect is observable.
const luckyRate = (odds) => {
  const o = makeLuckyOracle(0xBEEF, odds);
  let c = 0; for (let i = 0; i < 40000; i++) if (o.next()) c++; return c;
};

// 1. DOUBLE VOWELS — "3+ vowels ×2, but ≤2 vowels ×0.7"
test('DOUBLE VOWELS: 3+ vowels ×2, ≤2 vowels ×0.7', () => {
  assert.ok(near(wordRatio(id('double-vowels'), W({ len: 6, vowels: 3 })), 2));
  assert.ok(near(wordRatio(id('double-vowels'), W({ vowels: 2 })), 0.7));
});

// 2. SHORT FUSE — "All wins ×1.5, but the round is 20% shorter"
// round ×1.5 (applyRoundMods) + wprMul 0.8 (read live in useRunMode as 20% less time).
test('SHORT FUSE: wins ×1.5 and a 20%-shorter round (wprMul 0.8 read live)', () => {
  assert.equal(applyRoundMods(1000, [id('short-fuse')]), 1500);
  assert.equal(roundKnobs([id('short-fuse')]).wprMul, 0.8);
});

// 3. LEXICOGRAPHER — "RARE+ ×3, but COMMON/UNCOMMON score 0"
test('LEXICOGRAPHER: RARE/OBSCURE ×3, COMMON/UNCOMMON score 0', () => {
  assert.ok(near(wordRatio(id('lexicographer'), W({ rarity: 'RARE' })), 3));
  assert.ok(near(wordRatio(id('lexicographer'), W({ rarity: 'OBSCURE' })), 3));
  assert.equal(scoreWord(W({ rarity: 'COMMON' }), [id('lexicographer')]), 0);
  assert.equal(scoreWord(W({ rarity: 'UNCOMMON' }), [id('lexicographer')]), 0);
});

// 4. HOT STREAK — "Combo builds +0.25×/word to a ×4 cap, but starts cold at ×0.6"
// The ×4 cap must be REACHABLE inside a 16-word round (the old ×5 cap never was).
test('HOT STREAK: comboStart 0.6, comboStep 0.25, comboMax 4.0 — and the cap is reachable', () => {
  const k = roundKnobs([id('hot-streak')]);
  assert.equal(k.comboStart, 0.6);
  assert.equal(k.comboStep, 0.25);
  assert.equal(k.comboMax, 4.0);
  // combo after (WORDS_PER_ROUND-1) accepts must reach the cap — otherwise the upside is dead.
  assert.ok(k.comboStart + k.comboStep * (WORDS_PER_ROUND - 1) >= k.comboMax);
});

// 5. LUCKY CHARM — "Lucky odds 1/40→1/20, but non-lucky words ×0.9"
test('LUCKY CHARM: lucky odds 1/40→1/20 (read live) and non-lucky words ×0.9', () => {
  assert.equal(roundKnobs([id('lucky-charm')]).luckyOdds, 20);
  assert.ok(near(wordRatio(id('lucky-charm'), W({ lucky: false })), 0.9));
  assert.ok(near(wordRatio(id('lucky-charm'), W({ lucky: true })), 1)); // lucky words untouched
  assert.ok(luckyRate(20) > luckyRate(LUCKY_ODDS)); // the oracle honours the halved odds
});

// 6. JACKPOT — "Lucky payout ×8, but lucky odds 1/40→1/60"
test('JACKPOT: lucky payout ×8 (5→8 = ×1.6 on a lucky word) and odds 1/40→1/60', () => {
  assert.equal(roundKnobs([id('jackpot')]).luckyMult, 8);
  assert.equal(roundKnobs([id('jackpot')]).luckyOdds, 60);
  assert.ok(near(wordRatio(id('jackpot'), W({ lucky: true })), 8 / 5));
  assert.ok(luckyRate(60) < luckyRate(LUCKY_ODDS)); // rarer than baseline
});

// 7. BOOKWORM — "Every word +0.4× (combo-scaled), but lucky never procs"
test('BOOKWORM: +0.4×·combo per word, lucky disabled (noLucky)', () => {
  assert.equal(roundKnobs([id('bookworm')]).noLucky, true);
  const combo = 2;
  const diff = scoreWord(W({ combo }), [id('bookworm')]) - scoreWord(W({ combo }), []);
  assert.ok(near(diff, 0.4 * combo * BASE_WIN_PER_WORD)); // +0.4×combo on the multiplier
});

// 8. LONG HAUL — "+0.1× per letter over 5 (max +1×), but words ≤5 letters ×0.7"
test('LONG HAUL: +0.1× per letter over 5 (cap +1×), words ≤5 ×0.7', () => {
  const diff8 = scoreWord(W({ len: 8 }), [id('long-haul')]) - scoreWord(W({ len: 8 }), []);
  assert.ok(near(diff8, (8 - 5) * 0.1 * BASE_WIN_PER_WORD)); // +0.3× at len 8
  const diff20 = scoreWord(W({ len: 20 }), [id('long-haul')]) - scoreWord(W({ len: 20 }), []);
  assert.ok(near(diff20, 1.0 * BASE_WIN_PER_WORD)); // capped at +1×
  assert.ok(near(wordRatio(id('long-haul'), W({ len: 4 })), 0.7)); // short penalty
});

// 9. COMMON FOLK — "COMMON ×1.8, but RARE/OBSCURE ×0.6"
test('COMMON FOLK: COMMON ×1.8, RARE/OBSCURE ×0.6, UNCOMMON unchanged', () => {
  assert.ok(near(wordRatio(id('common-folk'), W({ rarity: 'COMMON' })), 1.8));
  assert.ok(near(wordRatio(id('common-folk'), W({ rarity: 'RARE' })), 0.6));
  assert.ok(near(wordRatio(id('common-folk'), W({ rarity: 'OBSCURE' })), 0.6));
  assert.ok(near(wordRatio(id('common-folk'), W({ rarity: 'UNCOMMON' })), 1));
});

// 10. GLASS CANNON — "All payouts ×2.5 — but 8%/round the run just ends"
test('GLASS CANNON: payouts ×2.5 and 8% sudden-death', () => {
  assert.equal(applyRoundMods(1000, [id('glass-cannon')]), 2500);
  assert.ok(near(suddenDeathChance([id('glass-cannon')]), 0.08));
});

// 11. SNOWBALL — "×0.7 payout, but +0.3× for every round already survived"
// (Fixed: drives off `clean` — the live-tracked survived-rounds count — not the dead `owned`.)
test('SNOWBALL: ×0.7 base, +0.3× per clean round (no longer a permanent ×0.7)', () => {
  const sb = [id('snowball')];
  assert.equal(applyRoundMods(1000, sb, { clean: 0 }), 700);  // ×0.7 with nothing survived
  assert.equal(applyRoundMods(1000, sb, { clean: 1 }), 1000); // +0.3× → neutral
  assert.equal(applyRoundMods(1000, sb, { clean: 5 }), 2200); // ×(0.7+1.5)
});

// 12. UNCAPPED — "No ×40 word cap & lucky pays ×10, but lucky half as common"
// The cap removal must be LOAD-BEARING (a lucky word blows past the old 40 cap).
test('UNCAPPED: cap removed (load-bearing), lucky ×10, odds halved to 1/80', () => {
  const k = roundKnobs([id('uncapped')]);
  assert.equal(k.cap, Infinity);
  assert.equal(k.luckyMult, 10);
  assert.equal(k.luckyOdds, 80);
  const bigWord = W({ rarity: 'OBSCURE', len: 9, combo: 2.5, lucky: true });
  // Removing the cap lets this word exceed what the ×40 per-word cap would ever allow.
  assert.ok(scoreWord(bigWord, [id('uncapped')]) > PER_WORD_CAP * BASE_WIN_PER_WORD);
  assert.ok(luckyRate(80) < luckyRate(LUCKY_ODDS)); // half as common
});

// 13. VOWEL MOVEMENT — "+0.3× per vowel, but J/Q/X/Z words ×0.5"
test('VOWEL MOVEMENT: +0.3×·vowels, J/Q/X/Z words ×0.5', () => {
  const w = W({ len: 6, vowels: 3 });
  const diff = scoreWord(w, [id('vowel-movement')]) - scoreWord(w, []);
  assert.ok(near(diff, 0.3 * 3 * BASE_WIN_PER_WORD)); // +0.3× per vowel
  // Rare-letter word: base multiplier halved, then +0.3×vowels added.
  const rw = W({ rare: true, len: 4, vowels: 2 });
  const baseMult = scoreWord(rw, []) / BASE_WIN_PER_WORD;
  const expected = (baseMult * 0.5 + 0.3 * 2) * BASE_WIN_PER_WORD;
  assert.ok(near(scoreWord(rw, [id('vowel-movement')]), expected));
});

// 14. RARE BREED — "OBSCURE ×6, but COMMON ×0.7" (was ×1.5 in code — a text lie; now ×6)
test('RARE BREED: OBSCURE ×6 (matches text), COMMON ×0.7', () => {
  assert.ok(near(wordRatio(id('rare-breed'), W({ rarity: 'OBSCURE' })), 6));
  assert.ok(near(wordRatio(id('rare-breed'), W({ rarity: 'COMMON' })), 0.7));
  // Per-word this beats an empty pick on an OBSCURE word → not strictly dominated.
  assert.ok(scoreWord(W({ rarity: 'OBSCURE' }), [id('rare-breed')]) > scoreWord(W({ rarity: 'OBSCURE' }), []));
});

// 15. COMBO KING — "Combo builds +0.2×/accept, but combo cap ×3→×2.4"
test('COMBO KING: comboStep 0.2, comboMax 2.4 (and the cap is reachable)', () => {
  const k = roundKnobs([id('combo-king')]);
  assert.equal(k.comboStep, 0.2);
  assert.equal(k.comboMax, 2.4);
  assert.ok(k.comboStart + k.comboStep * (WORDS_PER_ROUND - 1) >= k.comboMax);
});

// 16. DEEP POCKETS — "+150 flat wins per round"
test('DEEP POCKETS: +150 flat per round', () => {
  assert.equal(applyRoundMods(1000, [id('deep-pockets')]), 1150);
});

// 17. SCRABBLE BAG — "Words with J/Q/X/Z pay ×3"
test('SCRABBLE BAG: J/Q/X/Z words ×3, others unchanged', () => {
  assert.ok(near(wordRatio(id('scrabble-bag'), W({ rare: true })), 3));
  assert.ok(near(wordRatio(id('scrabble-bag'), W({ rare: false })), 1));
});

// 18. MOMENTUM — "Each clean round: +0.5× running mult"
test('MOMENTUM: ×(1 + 0.5·clean)', () => {
  const mo = [id('momentum')];
  assert.equal(applyRoundMods(1000, mo, { clean: 0 }), 1000);
  assert.equal(applyRoundMods(1000, mo, { clean: 3 }), 2500);
});
