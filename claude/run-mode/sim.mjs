// claude/run-mode/sim.mjs — RUN MODE v2 payout+WALL simulation (Job A, PROTOTYPE).
// v1 proved the rarity×combo×lucky engine BREAKS (×1.48/round, 34× over 10). v2 adds
// Balatro's other half so drafts become real decisions:
//   1. an ANTE WALL per round (escalating score requirement),
//   2. a LOSS CONDITION (miss the wall, or a GLASS CANNON fumble → run over),
//   3. genuine TRADE-OFF drafts — 15 of the 18 modifiers now carry a real downside.
// The wall curve is DERIVED, not guessed: we sweep (W0, g) in wall(r)=W0·g^(r-1)
// against the greedy drafter over 1000 seeds and pick the coefficients that land the
// win rate in the 30–40% target band with deaths peaking around rounds 6–8.
//
// Run: node claude/run-mode/sim.mjs
'use strict';

// ---- REAL constants pulled from the shipped modules (src/progress/{rarity,combo,luck,xp}.js) ----
const RARITY = { COMMON: 1.0, UNCOMMON: 1.5, RARE: 2.5, OBSCURE: 4.0 };
const RARITY_MAX = 4.5;
const COMBO_STEP = 0.1, COMBO_MAX = 3.0;
const LUCKY_ODDS = 40, LUCKY_MULT = 5;
const PER_WORD_CAP = 40;
const BASE_WIN_PER_WORD = 10;
const WORDS_PER_ROUND = 16;
const RARITY_MIX = [['COMMON', 0.68], ['UNCOMMON', 0.22], ['RARE', 0.08], ['OBSCURE', 0.02]];

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rollRarity(rnd) { const x = rnd(); let acc = 0; for (const [n, p] of RARITY_MIX) { acc += p; if (x <= acc) return n; } return 'COMMON'; }

// ---- THE 18 MODIFIERS — now TWO-SIDED. `down` documents the cost. ----
// word(w,m): per-word mult transform.  knob(k): mutate round knobs.
// round(p): per-round payout transform.  roundIdx(p,ctx): indexed round transform.
// suddenDeath: per-round probability the run ends regardless of score.
const MODIFIERS = [
  { id: 'double-vowels', name: 'DOUBLE VOWELS', text: '3+ vowels ×2, but ≤2 vowels ×0.7', down: true,
    word: (w, m) => (w.vowels >= 3 ? m * 2 : m * 0.7) },
  { id: 'short-fuse', name: 'SHORT FUSE', text: 'All wins ×1.5, but 20% fewer words (timer −20%)', down: true,
    knob: (k) => { k.wprMul *= 0.8; }, round: (p) => p * 1.5 },
  { id: 'lexicographer', name: 'LEXICOGRAPHER', text: 'RARE+ words ×3, but COMMON/UNCOMMON score 0', down: true,
    word: (w, m) => (w.rarity === 'RARE' || w.rarity === 'OBSCURE' ? m * 3 : 0) },
  { id: 'hot-streak', name: 'HOT STREAK', text: 'Combo cap ×5.0, but each round starts at combo ×0.6', down: true,
    knob: (k) => { k.comboMax = 5.0; k.comboStart = 0.6; } },
  { id: 'lucky-charm', name: 'LUCKY CHARM', text: 'Lucky odds 1/40→1/20, but non-lucky words ×0.9', down: true,
    knob: (k) => { k.luckyOdds /= 2; }, word: (w, m) => (w.lucky ? m : m * 0.9) },
  { id: 'jackpot', name: 'JACKPOT', text: 'Lucky payout ×8, but lucky odds 1/40→1/60 (rarer)', down: true,
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
  { id: 'rare-breed', name: 'RARE BREED', text: 'OBSCURE words ×6, but COMMON ×0.7', down: true,
    word: (w, m) => (w.rarity === 'OBSCURE' ? m * 1.5 : (w.rarity === 'COMMON' ? m * 0.7 : m)) },
  { id: 'combo-king', name: 'COMBO KING', text: 'Combo builds +0.2×/accept, but combo cap ×3→×2.4', down: true,
    knob: (k) => { k.comboStep = 0.2; k.comboMax = Math.min(k.comboMax, 2.4); } },
  { id: 'deep-pockets', name: 'DEEP POCKETS', text: '+150 flat wins per round (fades late)', down: false,
    round: (p) => p + 150 },
  { id: 'scrabble-bag', name: 'SCRABBLE BAG', text: 'Words with J/Q/X/Z pay ×3', down: false,
    word: (w, m) => (w.rare ? m * 3 : m) },
  { id: 'momentum', name: 'MOMENTUM', text: 'Each clean round: +0.5× running mult', down: false,
    roundIdx: (p, c) => p * (1 + 0.5 * c.clean) },
];

// ---- score one round given the owned modifiers ----
function playRound(rnd, owned, ctx) {
  const k = { comboStep: COMBO_STEP, comboMax: COMBO_MAX, comboStart: 1.0, luckyOdds: LUCKY_ODDS, luckyMult: LUCKY_MULT, cap: PER_WORD_CAP, wprMul: 1.0, noLucky: false };
  for (const mod of owned) if (mod.knob) mod.knob(k);
  const wpr = Math.max(4, Math.round(WORDS_PER_ROUND * k.wprMul));

  let combo = k.comboStart, payout = 0;
  for (let i = 0; i < wpr; i++) {
    const rarity = rollRarity(rnd);
    const len = 4 + Math.floor(rnd() * 6);
    const vowels = Math.max(1, Math.round(len * 0.4));
    const hasRare = rnd() < 0.08;
    const isLucky = !k.noLucky && rnd() < (1 / k.luckyOdds);
    const rarityMult = Math.min(RARITY_MAX, RARITY[rarity] + Math.min(0.5, Math.max(0, len - 5) * 0.1));
    const luckyMult = isLucky ? k.luckyMult : 1;
    const w = { rarity, len, vowels, rare: hasRare, lucky: isLucky, combo };

    let m = Math.min(k.cap, rarityMult * combo * luckyMult);
    for (const mod of owned) if (mod.word) m = mod.word(w, m);
    payout += Math.max(0, m) * BASE_WIN_PER_WORD;

    combo = Math.min(k.comboMax, combo + k.comboStep);
  }
  for (const mod of owned) {
    if (mod.round) payout = mod.round(payout);
    if (mod.roundIdx) payout = mod.roundIdx(payout, ctx);
  }
  return Math.round(payout);
}

// EV of next round's payout for a candidate stack (fixed internal seed → deterministic pick)
function expectedRound(owned, clean) {
  let s = 0; const N = 60; const r = mulberry32(4242);
  for (let i = 0; i < N; i++) s += playRound(r, owned, { owned: 0, clean });
  return s / N;
}

// Two-phase CONVEX wall: gentle slope g1 through round KNEE, steep slope g2 after.
// Early rounds (thin stacks) stay near-always survivable; the wall accelerates
// mid-late so failures cluster where the stack either compounds or falls behind.
const KNEE = 5; // rounds 1..KNEE use g1, rounds >KNEE use g2
const wallAt = (round, W0, g1, g2) => {
  const a = Math.min(round - 1, KNEE - 1);      // gentle steps
  const b = Math.max(0, round - KNEE);          // steep steps
  return Math.round(W0 * Math.pow(g1, a) * Math.pow(g2, b));
};

// ---- TRACE a full run under the greedy drafter, WALL-INDEPENDENT ----
// Greedy draft choices, per-round payouts and the GLASS CANNON sudden-death roll all
// depend only on the seed + modifiers, never on the wall. So we simulate all 10 rounds
// once (no wall truncation) and record everything; then ANY wall config is evaluated in
// O(10) against the recorded payouts. This decouples the expensive sim from the sweep.
function traceRun(seed) {
  const rnd = mulberry32(seed);
  const pool = MODIFIERS.slice();
  const owned = []; const ownedAt = {};
  let clean = 0;
  const payouts = []; let sdRound = null;   // first round a sudden-death roll fires
  for (let round = 1; round <= 10; round++) {
    const ctx = { owned: ownedAt.snowball != null ? (round - ownedAt.snowball) : 0, clean };
    payouts.push(playRound(rnd, owned, ctx));

    let sd = 0; for (const m of owned) if (m.suddenDeath) sd = 1 - (1 - sd) * (1 - m.suddenDeath);
    const fired = sd > 0 && rnd() < sd;       // consume the roll every round (keeps stream stable)
    if (fired && sdRound == null) sdRound = round;
    clean++;

    if (round < 10) {
      const avail = pool.filter((m) => !owned.includes(m));
      const offer = [];
      for (let k = 0; k < 3 && avail.length; k++) offer.push(avail.splice(Math.floor(rnd() * avail.length), 1)[0]);
      let pick = offer[0], best = -1;
      for (const cand of offer) {
        const ev = expectedRound(owned.concat([cand]), clean);
        if (ev > best) { best = ev; pick = cand; }
      }
      if (pick) { owned.push(pick); ownedAt[pick.id] = round + 1; }
    }
  }
  return { payouts, sdRound, stack: owned.map((m) => m.name) };
}

// Resolve one trace against a wall config → {won, diedRound, reason, finalScore, walls}
function resolve(trace, W0, g1, g2) {
  let cumulative = 0; const walls = [];
  for (let round = 1; round <= 10; round++) {
    const wall = wallAt(round, W0, g1, g2); walls.push(wall);
    const payout = trace.payouts[round - 1];
    cumulative += payout;
    if (trace.sdRound === round && payout >= wall) return { won: false, diedRound: round, reason: 'fumble', finalScore: cumulative, walls };
    if (payout < wall) return { won: false, diedRound: round, reason: 'wall', finalScore: cumulative, walls };
  }
  return { won: true, diedRound: null, reason: null, finalScore: cumulative, walls };
}

function percentile(sorted, p) { if (!sorted.length) return 0; const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1)))); return sorted[i]; }

function evaluate(traces, W0, g1, g2) {
  let wins = 0; const deaths = {}; const banks = [], winnerBanks = [];
  for (const t of traces) {
    const r = resolve(t, W0, g1, g2);
    banks.push(r.finalScore);
    if (r.won) { wins++; winnerBanks.push(r.finalScore); }
    else deaths[r.diedRound] = (deaths[r.diedRound] || 0) + 1;
  }
  return { rate: wins / traces.length, deaths, banks, winnerBanks };
}

// ---- DERIVE the wall: sweep (W0,g), pick the config closest to 35% win rate
//      whose modal death round is in 6..8 ----
function modalDeath(deaths) { let best = null, bestN = -1; for (const k of Object.keys(deaths)) { if (deaths[k] > bestN) { bestN = deaths[k]; best = +k; } } return best; }

// fraction of deaths landing in the target 6..8 window (higher = better clustering)
function deathWindowShare(deaths) { let tot = 0, win = 0; for (const k of Object.keys(deaths)) { tot += deaths[k]; if (+k >= 6 && +k <= 8) win += deaths[k]; } return tot ? win / tot : 0; }

function sweep(traces) {
  let bestCfg = null;
  for (let W0 = 200; W0 <= 500; W0 += 25) {
    for (let g1 = 1.15; g1 <= 1.45; g1 = +(g1 + 0.05).toFixed(2)) {
      for (let g2 = 1.55; g2 <= 2.05; g2 = +(g2 + 0.05).toFixed(2)) {
        const e = evaluate(traces, W0, g1, g2);
        const md = modalDeath(e.deaths);
        const share = deathWindowShare(e.deaths);
        const inBand = e.rate >= 0.30 && e.rate <= 0.40;
        const deathOk = md !== null && md >= 6 && md <= 8;
        // objective: be in the win-rate band, cluster deaths at 6–8, land near 35%.
        const score = (inBand ? 0 : 12) + (deathOk ? 0 : 4) + (1 - share) * 2 + Math.abs(e.rate - 0.35);
        if (!bestCfg || score < bestCfg.score) bestCfg = { W0, g1, g2, rate: e.rate, md, share, score };
      }
    }
  }
  return bestCfg;
}

// ================================ RUN ================================
console.log('RUN MODE v2 — deriving the ante wall from the sim\n');
console.log('Tracing 1,000 greedy runs (wall-independent)…');
const TRACES = []; for (let s = 1; s <= 1000; s++) TRACES.push(traceRun(s));
const cfg = sweep(TRACES);
const W0 = cfg.W0, G1 = cfg.g1, G2 = cfg.g2;
console.log(`Swept two-phase wall(r)=W0·g1^min(r-1,${KNEE - 1})·g2^max(0,r-${KNEE}); best fit →`);
console.log(`  W0=${W0}, g1=${G1} (rounds 1–${KNEE}), g2=${G2} (rounds ${KNEE + 1}–10)  (calib win ${(cfg.rate * 100).toFixed(1)}%, modal death R${cfg.md}, ${(cfg.share * 100).toFixed(0)}% of deaths in R6–8)\n`);

console.log('Derived WALL curve (round : required score):');
console.log('  ' + Array.from({ length: 10 }, (_, i) => `R${i + 1}=${wallAt(i + 1, W0, G1, G2)}`).join('  '));

// Final measurement: the same 1000 traces resolved against the chosen wall
const R = evaluate(TRACES, W0, G1, G2);
console.log(`\n=== 1,000-run greedy-drafter results (wall W0=${W0}, g1=${G1}, g2=${G2}) ===`);
console.log(`WIN RATE (reached round 10 alive): ${(R.rate * 100).toFixed(1)}%`);

const total = 1000 - Math.round(R.rate * 1000);
console.log('\nDEATH ROUND histogram (of the runs that died):');
let modal = null, modalN = -1;
for (let r = 1; r <= 10; r++) {
  const n = R.deaths[r] || 0; if (n > modalN) { modalN = n; modal = r; }
  const bar = '█'.repeat(Math.round(n / 6));
  console.log(`  R${String(r).padStart(2)} | ${String(n).padStart(4)} ${bar}`);
}
console.log(`  most runs die on ROUND ${modal} (${modalN} of ${total} deaths).`);

const allSorted = R.banks.slice().sort((a, b) => a - b);
const winSorted = R.winnerBanks.slice().sort((a, b) => a - b);
console.log('\nLUCKY vs UNLUCKY spread (final bank):');
console.log(`  ALL runs   p10=${percentile(allSorted, 10).toLocaleString()}  p50=${percentile(allSorted, 50).toLocaleString()}  p90=${percentile(allSorted, 90).toLocaleString()}  (min=${allSorted[0].toLocaleString()}, max=${allSorted[allSorted.length - 1].toLocaleString()})`);
if (winSorted.length) {
  const p10 = percentile(winSorted, 10), p90 = percentile(winSorted, 90);
  console.log(`  WINNERS    p10=${p10.toLocaleString()}  p50=${percentile(winSorted, 50).toLocaleString()}  p90=${p90.toLocaleString()}  → p90/p10 spread = ×${(p90 / Math.max(1, p10)).toFixed(1)}`);
}

// A sample surviving + losing run trace vs the wall
for (let s = 1; s <= 1000; s++) { const t = TRACES[s - 1]; const r = resolve(t, W0, G1, G2); if (r.won) { console.log(`\nSample WINNING run (seed ${s}):`); for (let i = 0; i < 10; i++) console.log(`  R${String(i + 1).padStart(2)}  payout ${String(t.payouts[i]).padStart(9)}  vs wall ${String(r.walls[i]).padStart(9)}  PASS`); console.log('  stack: ' + t.stack.join(', ')); break; } }
for (let s = 1; s <= 1000; s++) { const t = TRACES[s - 1]; const r = resolve(t, W0, G1, G2); if (!r.won) { console.log(`\nSample LOSING run (seed ${s}, died R${r.diedRound} by ${r.reason}):`); for (let i = 0; i < r.diedRound; i++) console.log(`  R${String(i + 1).padStart(2)}  payout ${String(t.payouts[i]).padStart(9)}  vs wall ${String(r.walls[i]).padStart(9)}  ${i + 1 === r.diedRound && r.reason === 'wall' ? 'FAIL' : (i + 1 === r.diedRound ? 'FUMBLE' : 'PASS')}`); break; } }

// export the derived wall for the HTML page to mirror
export const WALL = { W0, G1, G2, KNEE, at: (r) => wallAt(r, W0, G1, G2) };
