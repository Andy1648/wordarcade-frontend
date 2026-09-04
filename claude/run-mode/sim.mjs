// claude/run-mode/sim.mjs — RUN MODE payout-curve simulation (Job 5, PROTOTYPE).
// Models the REAL, already-shipped per-word scoring (src/progress/rarity.js,
// combo.js, luck.js, xp.js cappedWordMult) and layers Balatro-style stacking
// modifiers drafted between rounds. Answers: does the 10-round payout break?
//
// Run: node claude/run-mode/sim.mjs
'use strict';

// ---- REAL constants pulled from the shipped modules (kept in sync by hand) ----
const RARITY = { COMMON: 1.0, UNCOMMON: 1.5, RARE: 2.5, OBSCURE: 4.0 };
const RARITY_MAX = 4.5;              // rarity.js RARITY_MAX_MULT (band + length bonus)
const COMBO_STEP = 0.1, COMBO_MAX = 3.0; // combo.js
const LUCKY_ODDS = 40, LUCKY_MULT = 5;   // luck.js
const PER_WORD_CAP = 40;             // xp.js cappedWordMult PER_WORD_MULT_CAP
const BASE_WIN_PER_WORD = 10;        // illustrative wins per accepted word at ×1

// A realistic per-round word mix (what a decent player actually types).
const WORDS_PER_ROUND = 16;
const RARITY_MIX = [ // cumulative distribution
  ['COMMON', 0.68], ['UNCOMMON', 0.22], ['RARE', 0.08], ['OBSCURE', 0.02],
];
function rollRarity(rnd) {
  const x = rnd(); let acc = 0;
  for (const [name, p] of RARITY_MIX) { acc += p; if (x <= acc) return name; }
  return 'COMMON';
}
// deterministic RNG (mulberry32) so the curve is reproducible
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- THE 18 MODIFIERS (real numbers, grounded in the shipped mechanics) ----
// Each hook takes the round CONTEXT and mutates knobs. `apply` runs per-word;
// `round` runs once per round on the summed payout. Balatro-flavored names.
const MODIFIERS = [
  { id: 'double-vowels', name: 'DOUBLE VOWELS', text: 'Words with 3+ vowels pay ×2', tag: 'word',
    word: (w, m) => (w.vowels >= 3 ? m * 2 : m) },
  { id: 'short-fuse', name: 'SHORT FUSE', text: 'Timer −20%, but ALL wins ×1.5', tag: 'round',
    round: (p) => p * 1.5, sideEffect: 'timer-20' },
  { id: 'lexicographer', name: 'LEXICOGRAPHER', text: 'Only RARE+ words score — but at ×3', tag: 'word',
    word: (w, m) => (w.rarity === 'RARE' || w.rarity === 'OBSCURE' ? m * 3 : 0) },
  { id: 'hot-streak', name: 'HOT STREAK', text: 'Combo cap ×3.0 → ×5.0', tag: 'knob',
    knob: (k) => { k.comboMax = 5.0; } },
  { id: 'lucky-charm', name: 'LUCKY CHARM', text: 'Lucky odds 1/40 → 1/20', tag: 'knob',
    knob: (k) => { k.luckyOdds = 20; } },
  { id: 'jackpot', name: 'JACKPOT', text: 'Lucky payout ×5 → ×8', tag: 'knob',
    knob: (k) => { k.luckyMult = 8; } },
  { id: 'bookworm', name: 'BOOKWORM', text: 'Every word +0.4× rarity', tag: 'word',
    word: (w, m) => m + 0.4 * w.comboAtWord }, // +0.4 scaled by combo so it stays in-system
  { id: 'long-haul', name: 'LONG HAUL', text: 'Length bonus doubled (+0.2×/letter >5)', tag: 'word',
    word: (w, m) => m + Math.min(1.0, Math.max(0, (w.len - 5)) * 0.1) },
  { id: 'common-folk', name: 'COMMON FOLK', text: 'COMMON words pay ×1.8 (not ×1.0)', tag: 'word',
    word: (w, m) => (w.rarity === 'COMMON' ? m * 1.8 : m) },
  { id: 'glass-cannon', name: 'GLASS CANNON', text: 'All payouts ×2.5 — one miss ends the run', tag: 'round',
    round: (p) => p * 2.5, sideEffect: 'sudden-death' },
  { id: 'snowball', name: 'SNOWBALL', text: 'Each round: +0.3× that never leaves', tag: 'round',
    roundIndexed: (p, ctx) => p * (1 + 0.3 * ctx.roundsOwned) },
  { id: 'uncapped', name: 'UNCAPPED', text: 'Remove the ×40 per-word cap', tag: 'knob',
    knob: (k) => { k.perWordCap = Infinity; } },
  { id: 'vowel-movement', name: 'VOWEL MOVEMENT', text: '+0.3× per vowel in a word', tag: 'word',
    word: (w, m) => m + 0.3 * w.vowels },
  { id: 'rare-breed', name: 'RARE BREED', text: 'OBSCURE words pay ×6 (not ×4)', tag: 'word',
    word: (w, m) => (w.rarity === 'OBSCURE' ? m * 1.5 : m) },
  { id: 'combo-king', name: 'COMBO KING', text: 'Combo builds +0.2×/accept (2× faster)', tag: 'knob',
    knob: (k) => { k.comboStep = 0.2; } },
  { id: 'deep-pockets', name: 'DEEP POCKETS', text: '+150 flat wins per round', tag: 'round',
    round: (p) => p + 150 },
  { id: 'scrabble-bag', name: 'SCRABBLE BAG', text: 'Words with J/Q/X/Z pay ×3', tag: 'word',
    word: (w, m) => (w.hasRare ? m * 3 : m) },
  { id: 'momentum', name: 'MOMENTUM', text: 'Each clean round: +0.5× running mult', tag: 'round',
    roundIndexed: (p, ctx) => p * (1 + 0.5 * ctx.cleanRounds) },
];

// ---- score one round given the owned modifiers ----
function playRound(rnd, owned, ctx) {
  const knob = { comboStep: COMBO_STEP, comboMax: COMBO_MAX, luckyOdds: LUCKY_ODDS, luckyMult: LUCKY_MULT, perWordCap: PER_WORD_CAP };
  for (const mod of owned) if (mod.knob) mod.knob(knob);

  let combo = 1.0, payout = 0;
  for (let i = 0; i < WORDS_PER_ROUND; i++) {
    const rarity = rollRarity(rnd);
    const len = 4 + Math.floor(rnd() * 6);          // 4..9 letters
    const vowels = Math.max(1, Math.round(len * 0.4));
    const hasRare = rnd() < 0.08;                    // ~8% carry a J/Q/X/Z
    const isLucky = rnd() < (1 / knob.luckyOdds);
    const rarityMult = Math.min(RARITY_MAX, RARITY[rarity] + Math.min(0.5, Math.max(0, len - 5) * 0.1));
    const luckyMult = isLucky ? knob.luckyMult : 1;
    const w = { rarity, len, vowels, hasRare, comboAtWord: combo };

    let m = Math.min(knob.perWordCap, rarityMult * combo * luckyMult);
    for (const mod of owned) if (mod.word) m = mod.word(w, m);
    payout += m * BASE_WIN_PER_WORD;

    combo = Math.min(knob.comboMax, combo + knob.comboStep); // accepted → build combo
  }
  // round-level modifiers
  for (const mod of owned) {
    if (mod.round) payout = mod.round(payout);
    if (mod.roundIndexed) payout = mod.roundIndexed(payout, ctx);
  }
  return Math.round(payout);
}

// ---- greedy draft: each round, offer 3 random unowned mods, take the one that
// most increases the NEXT round's expected payout (Balatro-style optimizing player) ----
function expectedRound(owned, ctx) {
  let s = 0, N = 40; const r = mulberry32(999);
  for (let i = 0; i < N; i++) s += playRound(r, owned, ctx);
  return s / N;
}

function run(seed = 12345, draftStrategy = 'greedy') {
  const rnd = mulberry32(seed);
  const pool = MODIFIERS.slice();
  const owned = [];
  const rows = [];
  let cumulative = 0, cleanRounds = 0;
  for (let round = 1; round <= 10; round++) {
    const ctx = { roundsOwned: owned.filter(m => m.roundIndexed && m.id === 'snowball').length ? round - snowballAcquired : 0, cleanRounds };
    // simpler ctx: track per-mod acquisition
    ctx.roundsOwned = owned.filter(m => m.id === 'snowball').length ? (round - (snowballAt || round)) : 0;
    ctx.cleanRounds = cleanRounds;
    const payout = playRound(rnd, owned, ctx);
    cumulative += payout;
    rows.push({ round, payout, cumulative, stack: owned.map(m => m.name) });
    cleanRounds++; // assume no miss in the sim (optimizing player)

    // draft after the round (rounds 1..9 grant a pick; 10 is the finale)
    if (round < 10) {
      const offer = [];
      const avail = pool.filter(m => !owned.includes(m));
      for (let k = 0; k < 3 && avail.length; k++) {
        const idx = Math.floor(rnd() * avail.length);
        offer.push(avail.splice(idx, 1)[0]);
      }
      let pick = offer[0];
      if (draftStrategy === 'greedy') {
        let best = -1;
        for (const cand of offer) {
          const trial = owned.concat([cand]);
          const ev = expectedRound(trial, { roundsOwned: 0, cleanRounds });
          if (ev > best) { best = ev; pick = cand; }
        }
      }
      if (pick && pick.id === 'snowball') snowballAt = round + 1;
      if (pick) owned.push(pick);
    }
  }
  return rows;
}
let snowballAt = null;

// ---- report ----
console.log('RUN MODE — 10-round payout curve (greedy optimizing draft)\n');
const rows = run(12345, 'greedy');
console.log('Rd | round payout | cumulative | ×vs Rd1 | stack (drafted)');
const r1 = rows[0].payout;
for (const r of rows) {
  console.log(
    String(r.round).padStart(2) + ' | ' +
    String(r.payout).padStart(12) + ' | ' +
    String(r.cumulative).padStart(10) + ' | ' +
    (r.payout / r1).toFixed(1).padStart(6) + 'x | ' +
    r.stack.join(', ')
  );
}
// break analysis: is round-over-round growth super-linear?
const growth = rows.slice(1).map((r, i) => r.payout / rows[i].payout);
const geomean = Math.pow(growth.reduce((a, b) => a * b, 1), 1 / growth.length);
console.log('\nround-over-round growth factors:', growth.map(g => g.toFixed(2)).join(' '));
console.log('geometric-mean growth/round:', geomean.toFixed(2) + 'x');
console.log('Rd10 / Rd1 total blow-up:', (rows[9].payout / r1).toFixed(1) + 'x');
console.log('\nVERDICT:', geomean > 1.35
  ? 'BREAKS (exponential runaway — Balatro-style; ×' + geomean.toFixed(2) + '/round). Fun, but needs an ante/scaling wall or a per-word cap that survives UNCAPPED.'
  : 'bounded (grows but sub-exponential).');
