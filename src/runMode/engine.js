// engine.js — RUN MODE (feat/run-mode). Pure, timer-free rules ported from the
// calibrated proto/run-mode-2 sim (Job A): a two-phase ANTE WALL, a LOSS condition,
// and 18 stacking modifiers (15 of them two-sided). The scoring REUSES the shipped
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

// ---- THE 18 MODIFIERS — two-sided. `down:true` = carries a real cost. ----
// word(w,m): per-word mult transform.  knob(k): mutate round knobs.
// round(p): per-round payout transform.  roundIdx(p,ctx): indexed round transform.
// suddenDeath: per-round probability the run ends regardless of score.
export const MODIFIERS = [
  { id: 'double-vowels', name: 'DOUBLE VOWELS', text: '3+ vowels ×2, but ≤2 vowels ×0.7', down: true,
    word: (w, m) => (w.vowels >= 3 ? m * 2 : m * 0.7) },
  { id: 'short-fuse', name: 'SHORT FUSE', text: 'All wins ×1.5, but 20% fewer words', down: true,
    knob: (k) => { k.wprMul *= 0.8; }, round: (p) => p * 1.5 },
  { id: 'lexicographer', name: 'LEXICOGRAPHER', text: 'RARE+ ×3, but COMMON/UNCOMMON score 0', down: true,
    word: (w, m) => (w.rarity === 'RARE' || w.rarity === 'OBSCURE' ? m * 3 : 0) },
  { id: 'hot-streak', name: 'HOT STREAK', text: 'Combo cap ×5.0, but each round starts at combo ×0.6', down: true,
    knob: (k) => { k.comboMax = 5.0; k.comboStart = 0.6; } },
  { id: 'lucky-charm', name: 'LUCKY CHARM', text: 'Lucky odds 1/40→1/20, but non-lucky words ×0.9', down: true,
    knob: (k) => { k.luckyOdds /= 2; }, word: (w, m) => (w.lucky ? m : m * 0.9) },
  { id: 'jackpot', name: 'JACKPOT', text: 'Lucky payout ×8, but lucky odds 1/40→1/60', down: true,
    knob: (k) => { k.luckyMult = 8; k.luckyOdds *= 1.5; } },
  { id: 'bookworm', name: 'BOOKWORM', text: 'Every word +0.4× (combo-scaled), but lucky never procs', down: true,
    knob: (k) => { k.noLucky = true; }, word: (w, m) => m + 0.4 * w.combo },
  { id: 'long-haul', name: 'LONG HAUL', text: 'Length bonus doubled, but words ≤5 letters ×0.7', down: true,
    word: (w, m) => (w.len > 5 ? m + Math.min(1.0, (w.len - 5) * 0.1) : m * 0.7) },
  { id: 'common-folk', name: 'COMMON FOLK', text: 'COMMON ×1.8, but RARE/OBSCURE ×0.6', down: true,
    word: (w, m) => (w.rarity === 'COMMON' ? m * 1.8 : (w.rarity === 'RARE' || w.rarity === 'OBSCURE' ? m * 0.6 : m)) },
  { id: 'glass-cannon', name: 'GLASS CANNON', text: 'All payouts ×2.5 — but 8%/round the run just ends', down: true,
    round: (p) => p * 2.5, suddenDeath: 0.08 },
  { id: 'snowball', name: 'SNOWBALL', text: '+0.3× per round forever, but ×0.7 the round you draft it', down: true,
    roundIdx: (p, c) => p * (0.7 + 0.3 * c.owned) },
  { id: 'uncapped', name: 'UNCAPPED', text: 'Remove the ×40 word cap, but combo cap ×3→×1.5', down: true,
    knob: (k) => { k.cap = Infinity; k.comboMax = Math.min(k.comboMax, 1.5); } },
  { id: 'vowel-movement', name: 'VOWEL MOVEMENT', text: '+0.3× per vowel, but J/Q/X/Z words ×0.5', down: true,
    word: (w, m) => (w.rare ? m * 0.5 : m) + 0.3 * w.vowels },
  { id: 'rare-breed', name: 'RARE BREED', text: 'OBSCURE ×6, but COMMON ×0.7', down: true,
    word: (w, m) => (w.rarity === 'OBSCURE' ? m * 1.5 : (w.rarity === 'COMMON' ? m * 0.7 : m)) },
  { id: 'combo-king', name: 'COMBO KING', text: 'Combo builds +0.2×/accept, but combo cap ×3→×2.4', down: true,
    knob: (k) => { k.comboStep = 0.2; k.comboMax = Math.min(k.comboMax, 2.4); } },
  { id: 'deep-pockets', name: 'DEEP POCKETS', text: '+150 flat wins per round', down: false,
    round: (p) => p + 150 },
  { id: 'scrabble-bag', name: 'SCRABBLE BAG', text: 'Words with J/Q/X/Z pay ×3', down: false,
    word: (w, m) => (w.rare ? m * 3 : m) },
  { id: 'momentum', name: 'MOMENTUM', text: 'Each clean round: +0.5× running mult', down: false,
    roundIdx: (p, c) => p * (1 + 0.5 * c.clean) },
];

export const MODIFIER_BY_ID = MODIFIERS.reduce((m, x) => ((m[x.id] = x), m), {});

// ---- the ANTE WALL — DERIVED in the proto sweep, not guessed ----
// wall(r)=W0·g1^min(r-1,KNEE-1)·g2^max(0,r-KNEE): gentle early, steep from the knee.
// Sweep fit against 1000 greedy runs: 34.5% win rate, deaths peak round 8.
export const WALL = { W0: 225, g1: 1.3, g2: 1.8, KNEE: 5 };
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
// { owned: rounds since SNOWBALL drafted, clean: clean rounds so far }.
export function applyRoundMods(payout, stack, ctx = { owned: 0, clean: 0 }) {
  let p = payout;
  for (const mod of stack) {
    if (mod.round) p = mod.round(p);
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
export function simulateRoundPayout(rnd, stack, ctx = { owned: 0, clean: 0 }, knobs = roundKnobs(stack)) {
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
export function expectedRoundPayout(stack, ctx = { owned: 0, clean: 0 }) {
  let s = 0; const N = 60; const r = mulberry32(4242);
  for (let i = 0; i < N; i++) s += simulateRoundPayout(r, stack, ctx);
  return s / N;
}

// The modifier EV FACTOR: how a stack scales a round's score vs. an empty stack.
// Lets a REAL solo round (played on the shipped scoring) inherit the drafted
// modifiers as a single, sim-consistent multiplier on its native score.
export function modifierFactor(stack, ctx = { owned: 0, clean: 0 }) {
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
// PAYOUT TUNE (JOB A, run-econ-sim.mjs): the original /100 divisor made a run earn only
// ~60–95 wins/min against a shipped 5-mode band of 625–963 (winsmin-sim), i.e. ~10× too
// STINGY — moving the unlock to LV8 would have handed new players a headline mode that
// pays a tenth of everything else, blowing the wins/min spread from 1.54× to ~13×. /10
// lands a run at ~590–940 wins/min (mid-pack, below FUSE/CHAIN), holding the spread at
// ~1.5–1.6×. So the tune is UP to sit IN the band — not a nerf, a correction. It still
// never dominates (the exploding SCORE governs the WALL/survival, not the wins).
export function runWinsPayout(cumulativeScore, roundReached) {
  const progress = Math.min(1, roundReached / RUN_ROUNDS);
  return Math.round((cumulativeScore / 10) * progress);
}
