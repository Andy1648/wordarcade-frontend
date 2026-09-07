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

// NOTE: fix/run-balance re-tuned nearly every card to flatten the power curve (see
// claude/run-balance.md). Each pinned number below tracks the card's CURRENT text.

// 1. DOUBLE VOWELS — "3+ vowels ×1.8, but ≤2 vowels ×0.72"
test('DOUBLE VOWELS: 3+ vowels ×1.8, ≤2 vowels ×0.72', () => {
  assert.ok(near(wordRatio(id('double-vowels'), W({ len: 6, vowels: 3 })), 1.8));
  assert.ok(near(wordRatio(id('double-vowels'), W({ vowels: 2 })), 0.72));
});

// 2. SHORT FUSE — "All wins ×1.7, but the round is 20% shorter"
// round ×1.7 (applyRoundMods) + wprMul 0.8 (read live in useRunMode as 20% less time).
test('SHORT FUSE: wins ×1.7 and a 20%-shorter round (wprMul 0.8 read live)', () => {
  assert.equal(applyRoundMods(1000, [id('short-fuse')]), 1700);
  assert.equal(roundKnobs([id('short-fuse')]).wprMul, 0.8);
});

// 3. LEXICOGRAPHER — "RARE+ ×4.5, but COMMON/UNCOMMON ×0.72"
// fix/run-balance: no longer ZEROES common/uncommon (was a trap card at 18% pick rate); the
// ×0.72 floor makes it a viable high-variance pick instead of dead weight.
test('LEXICOGRAPHER: RARE/OBSCURE ×4.5, COMMON/UNCOMMON ×0.72', () => {
  assert.ok(near(wordRatio(id('lexicographer'), W({ rarity: 'RARE' })), 4.5));
  assert.ok(near(wordRatio(id('lexicographer'), W({ rarity: 'OBSCURE' })), 4.5));
  assert.ok(near(wordRatio(id('lexicographer'), W({ rarity: 'COMMON' })), 0.72));
  assert.ok(near(wordRatio(id('lexicographer'), W({ rarity: 'UNCOMMON' })), 0.72));
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

// 5. LUCKY CHARM — "Lucky odds 1/40→1/13 & lucky pays ×7, but non-lucky ×0.97"
test('LUCKY CHARM: lucky odds 1/40→1/13, lucky ×7, non-lucky words ×0.97', () => {
  assert.equal(roundKnobs([id('lucky-charm')]).luckyOdds, LUCKY_ODDS / 3); // 40/3 ≈ 13.3
  assert.equal(roundKnobs([id('lucky-charm')]).luckyMult, 7);
  assert.ok(near(wordRatio(id('lucky-charm'), W({ lucky: false })), 0.97));
  assert.ok(near(wordRatio(id('lucky-charm'), W({ lucky: true })), 7 / 5)); // lucky pays ×7 (base 5)
  assert.ok(luckyRate(LUCKY_ODDS / 3) > luckyRate(LUCKY_ODDS)); // oracle honours the boosted odds
});

// 6. JACKPOT — "Lucky payout ×16, but lucky odds 1/40→1/48"
test('JACKPOT: lucky payout ×16 and odds 1/40→1/48', () => {
  assert.equal(roundKnobs([id('jackpot')]).luckyMult, 16);
  assert.equal(roundKnobs([id('jackpot')]).luckyOdds, 48); // 40 × 1.2
  assert.ok(near(wordRatio(id('jackpot'), W({ lucky: true })), 16 / 5));
  assert.ok(luckyRate(48) < luckyRate(LUCKY_ODDS)); // rarer than baseline
});

// 7. BOOKWORM — "Every word +0.55× (combo-scaled), but lucky never procs"
test('BOOKWORM: +0.55×·combo per word, lucky disabled (noLucky)', () => {
  assert.equal(roundKnobs([id('bookworm')]).noLucky, true);
  const combo = 2;
  const diff = scoreWord(W({ combo }), [id('bookworm')]) - scoreWord(W({ combo }), []);
  assert.ok(near(diff, 0.55 * combo * BASE_WIN_PER_WORD)); // +0.55×combo on the multiplier
});

// 8. LONG HAUL — "+0.28× per letter over 5 (max +1.75×), but words ≤5 letters ×0.9"
test('LONG HAUL: +0.28× per letter over 5 (cap +1.75×), words ≤5 ×0.9', () => {
  const diff8 = scoreWord(W({ len: 8 }), [id('long-haul')]) - scoreWord(W({ len: 8 }), []);
  assert.ok(near(diff8, (8 - 5) * 0.28 * BASE_WIN_PER_WORD)); // +0.84× at len 8
  const diff20 = scoreWord(W({ len: 20 }), [id('long-haul')]) - scoreWord(W({ len: 20 }), []);
  assert.ok(near(diff20, 1.75 * BASE_WIN_PER_WORD)); // capped at +1.75×
  assert.ok(near(wordRatio(id('long-haul'), W({ len: 4 })), 0.9)); // short penalty
});

// 9. COMMON FOLK — "COMMON ×1.5, but RARE/OBSCURE ×0.5"
test('COMMON FOLK: COMMON ×1.5, RARE/OBSCURE ×0.5, UNCOMMON unchanged', () => {
  assert.ok(near(wordRatio(id('common-folk'), W({ rarity: 'COMMON' })), 1.5));
  assert.ok(near(wordRatio(id('common-folk'), W({ rarity: 'RARE' })), 0.5));
  assert.ok(near(wordRatio(id('common-folk'), W({ rarity: 'OBSCURE' })), 0.5));
  assert.ok(near(wordRatio(id('common-folk'), W({ rarity: 'UNCOMMON' })), 1));
});

// 10. GLASS CANNON — "All payouts ×1.55 — but 8%/round the run just ends"
test('GLASS CANNON: payouts ×1.55 and 8% sudden-death', () => {
  assert.equal(applyRoundMods(1000, [id('glass-cannon')]), 1550);
  assert.ok(near(suddenDeathChance([id('glass-cannon')]), 0.08));
});

// 11. SNOWBALL — "×0.65 payout, but +0.16× per round survived (cap ×1.25)"
// Drives off `clean` (the live-tracked survived-rounds count); capped so it can't run away.
test('SNOWBALL: ×0.65 base, +0.16× per clean round, cap ×1.25', () => {
  const sb = [id('snowball')];
  assert.equal(applyRoundMods(1000, sb, { clean: 0 }), 650);  // ×0.65 with nothing survived
  assert.equal(applyRoundMods(1000, sb, { clean: 2 }), 970);  // ×(0.65+0.32)
  assert.equal(applyRoundMods(1000, sb, { clean: 9 }), 1250); // capped at ×1.25
});

// 12. UNCAPPED — "No ×40 word cap & lucky pays ×18, but lucky 1.3× rarer"
// The cap removal must be LOAD-BEARING (a lucky word blows past the old 40 cap).
test('UNCAPPED: cap removed (load-bearing), lucky ×18, odds 1/40→1/52', () => {
  const k = roundKnobs([id('uncapped')]);
  assert.equal(k.cap, Infinity);
  assert.equal(k.luckyMult, 18);
  assert.equal(k.luckyOdds, 52); // 40 × 1.3
  const bigWord = W({ rarity: 'OBSCURE', len: 9, combo: 2.5, lucky: true });
  // Removing the cap lets this word exceed what the ×40 per-word cap would ever allow.
  assert.ok(scoreWord(bigWord, [id('uncapped')]) > PER_WORD_CAP * BASE_WIN_PER_WORD);
  assert.ok(luckyRate(52) < luckyRate(LUCKY_ODDS)); // thinner than baseline
});

// 13. VOWEL MOVEMENT — "+0.4× per vowel, but J/Q/X/Z words ×0.5"
test('VOWEL MOVEMENT: +0.4×·vowels, J/Q/X/Z words ×0.5', () => {
  const w = W({ len: 6, vowels: 3 });
  const diff = scoreWord(w, [id('vowel-movement')]) - scoreWord(w, []);
  assert.ok(near(diff, 0.4 * 3 * BASE_WIN_PER_WORD)); // +0.4× per vowel
  // Rare-letter word: base multiplier halved, then +0.4×vowels added.
  const rw = W({ rare: true, len: 4, vowels: 2 });
  const baseMult = scoreWord(rw, []) / BASE_WIN_PER_WORD;
  const expected = (baseMult * 0.5 + 0.4 * 2) * BASE_WIN_PER_WORD;
  assert.ok(near(scoreWord(rw, [id('vowel-movement')]), expected));
});

// 14. RARE BREED — "RARE ×3 & OBSCURE ×8, but COMMON ×0.85"
// fix/run-balance: now also boosts RARE (not just the 2%-rare OBSCURE) and eases the COMMON
// penalty, so it climbs out of dead-weight (was 19% pick rate) into the viable band.
test('RARE BREED: RARE ×3, OBSCURE ×8, COMMON ×0.85', () => {
  assert.ok(near(wordRatio(id('rare-breed'), W({ rarity: 'RARE' })), 3));
  assert.ok(near(wordRatio(id('rare-breed'), W({ rarity: 'OBSCURE' })), 8));
  assert.ok(near(wordRatio(id('rare-breed'), W({ rarity: 'COMMON' })), 0.85));
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

// 16. DEEP POCKETS — "+60 flat wins per round"
test('DEEP POCKETS: +60 flat per round', () => {
  assert.equal(applyRoundMods(1000, [id('deep-pockets')]), 1060);
});

// 17. SCRABBLE BAG — "Words with J/Q/X/Z pay ×2.6"
test('SCRABBLE BAG: J/Q/X/Z words ×2.6, others unchanged', () => {
  assert.ok(near(wordRatio(id('scrabble-bag'), W({ rare: true })), 2.6));
  assert.ok(near(wordRatio(id('scrabble-bag'), W({ rare: false })), 1));
});

// 18. MOMENTUM — "Each clean round +0.18× running mult (cap ×1.35), but every word ×0.9"
// fix/run-balance: was a NO-DOWNSIDE ×(1+0.5·clean) auto-include in ~100% of winners. Now
// two-sided (×0.9 every word) and capped ×1.35, so it sits in the flat viable band.
test('MOMENTUM: ×0.9 per word, round ×min(1.35, 1 + 0.18·clean)', () => {
  const mo = [id('momentum')];
  assert.ok(near(wordRatio(mo[0], W()), 0.9)); // guaranteed per-word cost
  assert.equal(applyRoundMods(1000, mo, { clean: 0 }), 1000); // ×1
  assert.equal(applyRoundMods(1000, mo, { clean: 1 }), 1180); // ×1.18
  assert.equal(applyRoundMods(1000, mo, { clean: 9 }), 1350); // capped at ×1.35
});
