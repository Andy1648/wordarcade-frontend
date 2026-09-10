// engine.js — RUN MODE (feat/run-mode). Pure, timer-free rules ported from the
// calibrated proto/run-mode-2 sim (Job A): a two-phase ANTE WALL, a LOSS condition,
// and 18 stacking modifiers (all two-sided). The scoring REUSES the shipped
// progression constants (src/progress/{rarity,combo,luck}) — it does NOT fork them.
//
// The React layer (useRunMode) owns state/timers; this file is data + math only, so
// the wall/modifier maths can be unit-tested exactly like the sim was.
import {
  RARITY_BANDS,
  OBSCURE_BAND,
  RARITY_MAX_MULT,
  LENGTH_BONUS_PER_LETTER,
  LENGTH_BONUS_MAX,
  LENGTH_BONUS_FLOOR,
} from '../progress/rarity.js';
import { COMBO_STEP, COMBO_MAX } from '../progress/combo.js';
import { LUCKY_ODDS, LUCKY_WINS_MULT, mulberry32 } from '../progress/luck.js';

// Rarity multipliers, keyed by band name, straight from the shipped bands (+ the
// separate OBSCURE band, the "not in the ranked corpus" tier).
export const RARITY = [...RARITY_BANDS, OBSCURE_BAND].reduce((m, b) => ((m[b.name] = b.mult), m), {});
// Wins paid per word before multipliers (mirrors the solo per-word wins base).
export const BASE_WIN_PER_WORD = 10;
export const WORDS_PER_ROUND = 16;
export const RUN_ROUNDS = 10;
export const PER_WORD_CAP = 40; // xp.js cappedWordMult

// Rarity mix used for the engine's own EV maths + the sim (matches the sim's mix).
const RARITY_MIX = [['COMMON', 0.68], ['UNCOMMON', 0.22], ['RARE', 0.08], ['OBSCURE', 0.02]];

// ---- THE 18 MODIFIERS — all two-sided (`down:true`), each carries a real cost. ----
// fix/run-deck-2: DEEP POCKETS (was flat +60, no cost) and SCRABBLE BAG (was free ×2.6 on
// J/Q/X/Z) — the last two boring pure-upside cards flagged by the audit — were given genuine
// trade-offs: DEEP POCKETS is now a floor-raiser that caps the ceiling (free wins worth 60% of
// the current wall, but ×0.85 every word), SCRABBLE BAG a rare-letter build-around (×4 on
// J/Q/X/Z but ×0.9 on the other ~92%, anti-synergy with VOWEL MOVEMENT). MOMENTUM was already
// two-sided on fix/run-balance. All 18 cards now down:true.
// fix/run-deep-pockets: DEEP POCKETS's flat "+120" was tuned for the old 225 wall — on the
// fix/run-wall-2 curve (80, 120, 180 …) it cleared round 2 BY ITSELF. It now scales with the
// wall, CAPPED: +min(60, round(0.3 · wallAt(clean+1))) — 24 / 36 / 54 through the draft-1
// rounds, then 60 flat. The cap is load-bearing: an UNCAPPED fraction of the wall is a permanent
// discount on every wall, and the draft-1 audit + skill sweep (claude/run-skill.mjs) showed no
// fraction satisfies both acceptance sets — ≥0.25 puts DEEP POCKETS in the casual [+8,+25]
// reach-R4 band but erodes GREEDY−RANDOM at 20 attempts below 5 pts (0.6 → Δ+65, in 82-100% of
// winners, RANDOM 35%); ≤0.20 keeps the draft gap but the card stops mattering (Δ+3.5). Capped,
// it's a real early floor (Δ+14) that fades to noise against the 890-1504 endgame walls.
// word(w,m): per-word mult transform.  knob(k): mutate round knobs.
// round(p,ctx): per-round payout transform (ctx = { clean }).  roundIdx(p,ctx): indexed round transform.
// suddenDeath: per-round probability the run ends regardless of score.
export const MODIFIERS = [
  { id: 'double-vowels', kind: 'tax', name: 'DOUBLE VOWELS', text: '3+ vowels ×1.8, but ≤2 vowels ×0.72', down: true,
    word: (w, m) => (w.vowels >= 3 ? m * 1.8 : m * 0.72) },
  { id: 'short-fuse', kind: 'steady', name: 'SHORT FUSE', text: 'All wins ×1.7, but the round is 20% shorter', down: true,
    knob: (k) => { k.wprMul *= 0.8; }, round: (p) => p * 1.7 },
  { id: 'lexicographer', kind: 'tax', name: 'LEXICOGRAPHER', text: 'RARE+ ×4.5, but COMMON/UNCOMMON ×0.72', down: true,
    word: (w, m) => (w.rarity === 'RARE' || w.rarity === 'OBSCURE' ? m * 4.5 : m * 0.72) },
  { id: 'hot-streak', kind: 'slow', name: 'HOT STREAK', text: 'Combo builds +0.25×/word to a ×4 cap, but starts cold at ×0.6', down: true,
    knob: (k) => { k.comboStart = 0.6; k.comboStep = 0.25; k.comboMax = 4.0; } },
  { id: 'lucky-charm', kind: 'gamble', name: 'LUCKY CHARM', text: 'Lucky odds 1/40→1/13 & lucky pays ×7, but non-lucky ×0.97', down: true,
    knob: (k) => { k.luckyOdds /= 3; k.luckyMult = 7; }, word: (w, m) => (w.lucky ? m : m * 0.97) },
  { id: 'jackpot', kind: 'gamble', name: 'JACKPOT', text: 'Lucky payout ×16, but lucky odds 1/40→1/48', down: true,
    knob: (k) => { k.luckyMult = 16; k.luckyOdds *= 1.2; } },
  { id: 'bookworm', kind: 'steady', name: 'BOOKWORM', text: 'Every word +0.55× (combo-scaled), but lucky never procs', down: true,
    knob: (k) => { k.noLucky = true; }, word: (w, m) => m + 0.55 * w.combo },
  { id: 'long-haul', kind: 'tax', name: 'LONG HAUL', text: '+0.28× per letter over 5 (max +1.75×), but words ≤5 letters ×0.9', down: true,
    word: (w, m) => (w.len > 5 ? m + Math.min(1.75, (w.len - 5) * 0.28) : m * 0.9) },
  { id: 'common-folk', kind: 'tax', name: 'COMMON FOLK', text: 'COMMON ×1.5, but RARE/OBSCURE ×0.5', down: true,
    word: (w, m) => (w.rarity === 'COMMON' ? m * 1.5 : (w.rarity === 'RARE' || w.rarity === 'OBSCURE' ? m * 0.5 : m)) },
  { id: 'glass-cannon', kind: 'gamble', name: 'GLASS CANNON', text: 'All payouts ×1.55 — but 8%/round the run just ends', down: true,
    round: (p) => p * 1.55, suddenDeath: 0.08 },
  { id: 'snowball', kind: 'slow', name: 'SNOWBALL', text: '×0.62 payout, but +0.14× per round survived (cap ×1.15)', down: true,
    roundIdx: (p, c) => p * Math.min(1.15, 0.62 + 0.14 * c.clean) },
  { id: 'uncapped', kind: 'gamble', name: 'UNCAPPED', text: 'No ×40 word cap & lucky pays ×18, but lucky 1.3× rarer', down: true,
    knob: (k) => { k.cap = Infinity; k.luckyMult = 18; k.luckyOdds *= 1.3; } },
  { id: 'vowel-movement', kind: 'tax', name: 'VOWEL MOVEMENT', text: '+0.4× per vowel, but J/Q/X/Z words ×0.5', down: true,
    word: (w, m) => (w.rare ? m * 0.5 : m) + 0.4 * w.vowels },
  { id: 'rare-breed', kind: 'tax', name: 'RARE BREED', text: 'RARE ×3 & OBSCURE ×8, but COMMON ×0.85', down: true,
    word: (w, m) => (w.rarity === 'OBSCURE' ? m * 8 : (w.rarity === 'RARE' ? m * 3 : (w.rarity === 'COMMON' ? m * 0.85 : m))) },
  { id: 'combo-king', kind: 'slow', name: 'COMBO KING', text: 'Combo builds +0.2×/accept, but combo cap ×3→×2.4', down: true,
    knob: (k) => { k.comboStep = 0.2; k.comboMax = Math.min(k.comboMax, 2.4); } },
  { id: 'deep-pockets', kind: 'steady', name: 'DEEP POCKETS', text: 'Free wins worth 30% of the wall (max 60) every round, but every word ×0.85', down: true,
    // wallAt is a hoisted function declaration below; round() only runs at play time.
    word: (w, m) => m * 0.85, round: (p, c) => p + deepPocketsBonus((c?.clean || 0) + 1) },
  { id: 'scrabble-bag', kind: 'tax', name: 'SCRABBLE BAG', text: 'J/Q/X/Z words ×4, but every other word ×0.9', down: true,
    word: (w, m) => (w.rare ? m * 4 : m * 0.9) },
  { id: 'momentum', kind: 'slow', name: 'MOMENTUM', text: 'Each clean round +0.18× running mult (cap ×1.35), but every word ×0.9', down: true,
    word: (w, m) => m * 0.9, roundIdx: (p, c) => p * Math.min(1.35, 1 + 0.18 * c.clean) },
];

export const MODIFIER_BY_ID = MODIFIERS.reduce((m, x) => ((m[x.id] = x), m), {});

// feat/draft-badges: every modifier carries a KIND — the shape of its trade-off, not its numbers —
// so the draft's corner tag says what a card IS (GAMBLE / SLOW BURN / WORD TAX / STEADY) instead of
// the meaningless TRADE-OFF (all 18 are two-sided). Pure labels: nothing in scoring reads `kind`.
//   gamble — variance: lucky odds / payout, the fumble (LUCKY CHARM, JACKPOT, UNCAPPED, GLASS CANNON)
//   slow   — pays later than it costs (SNOWBALL, MOMENTUM, HOT STREAK, COMBO KING)
//   tax    — reprices word classes: pay on some words, earn on others (DOUBLE VOWELS, LEXICOGRAPHER,
//            LONG HAUL, COMMON FOLK, VOWEL MOVEMENT, RARE BREED, SCRABBLE BAG)
//   steady — a flat, predictable edge for a flat cost (DEEP POCKETS, SHORT FUSE, BOOKWORM)
export const MODIFIER_KINDS = Object.freeze({
  gamble: { label: 'GAMBLE' },
  slow: { label: 'SLOW BURN' },
  tax: { label: 'WORD TAX' },
  steady: { label: 'STEADY' },
});
export const KIND_IDS = Object.freeze(Object.keys(MODIFIER_KINDS));

// DEEP POCKETS's free wins for a given round: 30% of that round's wall, capped at 60 (see the
// deck comment above for why the cap exists). Exported so the tests pin the same numbers.
export const DEEP_POCKETS_FRAC = 0.3;
export const DEEP_POCKETS_CAP = 60;
export function deepPocketsBonus(round) {
  return Math.min(DEEP_POCKETS_CAP, Math.round(DEEP_POCKETS_FRAC * wallAt(round)));
}

// ---- the ANTE WALL — RETUNED FOR REAL SKILL on fix/run-wall-2 (claude/run-skill.mjs) ----
// wall(r)=W0·g1^min(r-1,KNEE-1)·g2^max(0,r-KNEE).
// History: the original (g1=1.3, g2=1.8) was a ~1.8×/round exponential only compounding
// multipliers could clear (the draft was solved). fix/run-balance flattened the late game
// (225 → 686) and met the three balance targets — but calibrated W0=225 to 16 PERFECT words a
// round. A real 30s human lands ~8-9 words, so casual players died on the EMPTY-stack round 1
// before ever seeing a draft. This curve starts LOW (W0=80: a casual round clears it), ramps
// STEEPLY through the draft rounds (g1=1.5: rounds 1-5 = 80→405, so the cards you pick have to
// carry you by mid-run), and keeps climbing in the endgame (g2=1.3: 1504 by round 10, so a strong
// player still needs a real stack — no free clears). Calibrated by the skill sweep in
// claude/run-skill.mjs (attempts 5.4 / 8.6 / 14 / 20 at 93% accuracy) and pinned by
// src/runMode/wallSkill.test.js: at 8.6 attempts round-1 death ≤25% + mean round ≥2.5; at 20
// attempts RANDOM wins 10-30% and GREEDY beats RANDOM by ≥5 pts (choice matters). Schedule:
// 80, 120, 180, 270, 405, 527, 684, 890, 1157, 1504.
export const WALL = { W0: 80, g1: 1.5, g2: 1.3, KNEE: 5 };
export function wallAt(round, cfg = WALL) {
  const a = Math.min(round - 1, cfg.KNEE - 1);
  const b = Math.max(0, round - cfg.KNEE);
  return Math.round(cfg.W0 * Math.pow(cfg.g1, a) * Math.pow(cfg.g2, b));
}
// The full 10-round wall schedule (what the pre-round screen shows).
export function wallSchedule(cfg = WALL) {
  return Array.from({ length: RUN_ROUNDS }, (_, i) => wallAt(i + 1, cfg));
}

// Round KNOBS after a stack's knob() mods apply (combo growth, lucky odds, caps…).
export function roundKnobs(stack) {
  const k = {
    comboStep: COMBO_STEP, comboMax: COMBO_MAX, comboStart: 1.0,
    luckyOdds: LUCKY_ODDS, luckyMult: LUCKY_WINS_MULT, cap: PER_WORD_CAP,
    wprMul: 1.0, noLucky: false,
  };
  for (const mod of stack) if (mod.knob) mod.knob(k);
  return k;
}

// The per-word wins for one word under a stack (reuses rarity/combo/lucky maths).
// `word` = { rarity, len, vowels, rare (J/Q/X/Z), lucky, combo }.
export function scoreWord(word, stack, knobs = roundKnobs(stack)) {
  const rarityMult = Math.min(
    RARITY_MAX_MULT,
    (RARITY[word.rarity] ?? 1) + Math.min(LENGTH_BONUS_MAX, Math.max(0, word.len - LENGTH_BONUS_FLOOR) * LENGTH_BONUS_PER_LETTER)
  );
  const luckyMult = word.lucky ? knobs.luckyMult : 1;
  let m = Math.min(knobs.cap, rarityMult * word.combo * luckyMult);
  for (const mod of stack) if (mod.word) m = mod.word(word, m);
  return Math.max(0, m) * BASE_WIN_PER_WORD;
}

// Apply the stack's ROUND-level mods to a round's raw payout. ctx carries
// { clean: clean (survived) rounds so far } — drives SNOWBALL and MOMENTUM, and (fix/run-deep-
// pockets) DEEP POCKETS's wall-relative floor: round() receives ctx too, so a round mod can read
// which round it's standing in (clean+1). Every caller — the hook's endRound + live meter, the
// sims, expectedRoundPayout/modifierFactor — passes the same { clean } ctx.
export function applyRoundMods(payout, stack, ctx = { clean: 0 }) {
  let p = payout;
  for (const mod of stack) {
    if (mod.round) p = mod.round(p, ctx);
    if (mod.roundIdx) p = mod.roundIdx(p, ctx);
  }
  return Math.round(p);
}

// Combined per-round sudden-death probability (GLASS CANNON etc.).
export function suddenDeathChance(stack) {
  let sd = 0;
  for (const m of stack) if (m.suddenDeath) sd = 1 - (1 - sd) * (1 - m.suddenDeath);
  return sd;
}

// A fully-simulated round payout (used by the sim AND as the EV factor that scales a
// real solo round's native score by the drafted modifiers — see useRunMode).
export function simulateRoundPayout(rnd, stack, ctx = { clean: 0 }, knobs = roundKnobs(stack)) {
  const wpr = Math.max(4, Math.round(WORDS_PER_ROUND * knobs.wprMul));
  let combo = knobs.comboStart, payout = 0;
  for (let i = 0; i < wpr; i++) {
    const x = rnd();
    let acc = 0, rarity = 'COMMON';
    for (const [n, p] of RARITY_MIX) { acc += p; if (x <= acc) { rarity = n; break; } }
    const len = 4 + Math.floor(rnd() * 6);
    const vowels = Math.max(1, Math.round(len * 0.4));
    const rare = rnd() < 0.08;
    const lucky = !knobs.noLucky && rnd() < 1 / knobs.luckyOdds;
    payout += scoreWord({ rarity, len, vowels, rare, lucky, combo }, stack, knobs);
    combo = Math.min(knobs.comboMax, combo + knobs.comboStep);
  }
  return applyRoundMods(payout, stack, ctx);
}

// Expected round payout for a stack (deterministic internal seed) — the greedy
// drafter's ranking signal AND the modifier EV factor applied to real rounds.
export function expectedRoundPayout(stack, ctx = { clean: 0 }) {
  let s = 0; const N = 60; const r = mulberry32(4242);
  for (let i = 0; i < N; i++) s += simulateRoundPayout(r, stack, ctx);
  return s / N;
}

// The modifier EV FACTOR: how a stack scales a round's score vs. an empty stack.
// Lets a REAL solo round (played on the shipped scoring) inherit the drafted
// modifiers as a single, sim-consistent multiplier on its native score.
export function modifierFactor(stack, ctx = { clean: 0 }) {
  const base = expectedRoundPayout([], ctx);
  if (base <= 0) return 1;
  return expectedRoundPayout(stack, ctx) / base;
}

// Deal three distinct modifier offers not already owned (seeded → testable).
export function dealOffers(ownedIds, rnd = Math.random) {
  const avail = MODIFIERS.filter((m) => !ownedIds.includes(m.id));
  const offer = [];
  for (let k = 0; k < 3 && avail.length; k++) {
    offer.push(avail.splice(Math.floor(rnd() * avail.length), 1)[0]);
  }
  return offer;
}

// Wins paid for a completed/ended run, scaled to the round reached. A full 10-round
// clear pays the cleared cumulative; a wall-out pays what was banked up to the miss.
//
// THE FORMULA IS: round(cumulativeScore / RUN_WINS_DIVISOR * roundReached/RUN_ROUNDS).
// (run-econ-sim.mjs used to PRINT this as "cumulative/100 x roundReached/10" — that label
// was left behind when JOB A moved the divisor off 100 and was wrong for two tunes running.
// It now prints RUN_WINS_DIVISOR directly so the two can never disagree again.)
//
// PAYOUT TUNE HISTORY, all measured with claude/run-econ-sim.mjs against the shipped 5-mode
// band (blitz 625 lo … chain 963 hi, spread 1.54x):
//   /100 (original) — ~60–95 wins/min, ~10x too stingy.
//   /10  (JOB A)    — 594/727/938 wins/min at 12/15/20 wpm. PASSED when it was fitted.
//   /10  (today)    — 155/189/245. It did not drift; `c180f90` (the deck rebalance) changed
//                     what a round SCORES without re-fitting the divisor that prices it, so
//                     the same divisor now pays 0.16–0.39x of the band and blows the spread
//                     to 3.9–6.2x. Nothing about the payout code changed.
//   /2.5 (this fix) — 618/758/978 wins/min, spreads 1.56x/1.54x/1.56x. @15 wpm lands 758
//                     against a band centre of 794.
//
// WHY 2.5 AND NOT 3 OR 2: a divisor sweep (10 → 1.5) has five candidates that put @15 wpm
// inside the band with every spread <= 2x — 3, 2.75, 2.5, 2.25 and 2. NO divisor puts all
// THREE rates inside the band, and that is structural rather than a tuning failure: 12→20
// wpm spans 1.58x while the band itself spans only 1.54x, so RUN cannot fit inside it at
// every throughput no matter how it is priced. 2.5 is the choice that minimises the miss at
// both ends (618 vs 625 lo = -1.1%; 978 vs 963 hi = +1.6%) and has the flattest spread of
// any candidate. The deck and the wall are deliberately untouched — the divisor is the only
// knob turned here, because it is the only one that prices a run without changing how one
// plays.
export const RUN_WINS_DIVISOR = 2.5;

export function runWinsPayout(cumulativeScore, roundReached) {
  const progress = Math.min(1, roundReached / RUN_ROUNDS);
  return Math.round((cumulativeScore / RUN_WINS_DIVISOR) * progress);
}
