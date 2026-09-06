// deadstretch-sim.mjs — sim/dead-stretch (REPORT ONLY, applies nothing).
// Models the four candidate fixes for the ~162 h "nothing to buy" dead stretch and reports the
// resulting LONGEST dead stretch (longest span with no reward event) for each archetype.
// Baseline = main's live economy: KEY_TIERS ×6 ladder, pre-rebalance earn rates. Run:
//   node claude/deadstretch-sim.mjs
import { KEY_TIERS } from '../src/progress/xp.js';

const round10 = (n) => { const d = n / 10; const r = Math.round(d); const isHalf = Math.abs(d - Math.trunc(d) - 0.5) < 1e-9; return (isHalf ? (Math.trunc(d) % 2 === 0 ? Math.trunc(d) : Math.trunc(d) + 1) : r) * 10; };
const PLAY_MIN = 200 * 60; // 200 h of actual play

// Earn rates (wins/min), main pre-rebalance (claude/winsmin-sim.mjs baseline).
const ARCHETYPES = [
  { name: 'Word Bomb main', wpm: 196 },
  { name: 'Blitz main', wpm: 344 },
  { name: 'SAT Rush main', wpm: 1686 },
  { name: 'Chain main', wpm: 2403 },
  { name: 'Fuse grinder', wpm: 7400 },
];

// A ladder is an ascending array of cumulative wins costs to REACH tier i (index 0 = free start = 0).
// Baseline: the live KEY_TIERS costs, extended past T8 at ×6.
function baselineLadder(maxTier = 20) {
  const out = KEY_TIERS.map((t) => t.cost);
  let cost = out[out.length - 1];
  for (let i = out.length; i <= maxTier; i++) { cost = round10(cost * 6); out.push(cost); }
  return out;
}
// Rebuild the ladder past a break tier with a new ratio (more tiers if ratio<6, cheaper if we also
// cap the top). Keeps T0..breakTier identical, then geometric `ratio` up to a cost ceiling.
function reRatioLadder(breakTier, ratio, ceiling = 140000000, maxTier = 40) {
  const base = KEY_TIERS.map((t) => t.cost);
  const out = base.slice(0, breakTier + 1);
  let cost = out[out.length - 1];
  while (out.length <= maxTier) { cost = round10(cost * ratio); if (cost > ceiling) break; out.push(cost); }
  return out;
}

// Given a set of PURCHASE PRICES (absolute cumulative costs) and an earn rate, walk 200 h buying the
// next affordable tier as soon as affordable; return the longest gap between reward events (in h).
function longestGap(prices, wpm) {
  let minutes = 0, last = 0, longest = 0, gapTier = 0, tier = 0;
  for (let i = 1; i < prices.length; i++) {
    const buyAt = minutes + (prices[i] - prices[i - 1]) / wpm; // incremental cost since last buy
    if (buyAt > PLAY_MIN) { const tail = PLAY_MIN - last; if (tail > longest) { longest = tail; gapTier = i; } break; }
    const gap = buyAt - last; if (gap > longest) { longest = gap; gapTier = i; }
    minutes = buyAt; last = buyAt; tier = i;
  }
  return { hours: longest / 60, gapTier, reaches: tier };
}

// A merged-timeline model for TWO parallel sinks (KEY ladder + a new sink): the player always buys
// the cheapest available NEXT purchase across both tracks. Reward event = ANY purchase. Returns the
// longest gap between consecutive purchases over 200 h.
function longestGapTwoTracks(pricesA, pricesB, wpm) {
  // Convert each track to a stream of INCREMENTAL costs (price to advance one step in that track).
  const incA = []; for (let i = 1; i < pricesA.length; i++) incA.push(pricesA[i] - pricesA[i - 1]);
  const incB = []; for (let i = 1; i < pricesB.length; i++) incB.push(pricesB[i] - pricesB[i - 1]);
  let ia = 0, ib = 0, wins = 0, minutes = 0, last = 0, longest = 0;
  // Greedy: at each step earn until the cheaper of the two next purchases is affordable, buy it.
  while ((ia < incA.length || ib < incB.length) && minutes <= PLAY_MIN) {
    const nextA = ia < incA.length ? incA[ia] : Infinity;
    const nextB = ib < incB.length ? incB[ib] : Infinity;
    const cheapest = Math.min(nextA, nextB);
    const need = cheapest - wins;
    const dt = need / wpm;
    if (minutes + dt > PLAY_MIN) { const tail = PLAY_MIN - last; if (tail > longest) longest = tail; break; }
    minutes += dt; wins = 0; // spend all accumulated on this purchase (wins reset to 0 after buy)
    const gap = minutes - last; if (gap > longest) longest = gap;
    last = minutes;
    if (nextA <= nextB) ia++; else ib++;
  }
  return { hours: longest / 60 };
}

const worst = (fn) => { let w = { hours: 0 }; let who = ''; for (const a of ARCHETYPES) { const r = fn(a.wpm); if (r.hours > w.hours) { w = r; who = a.name; } } return { ...w, who }; };

console.log('=== DEAD-STRETCH OPTIONS (longest span with no reward event, worst archetype over 200 h) ===\n');

const base = baselineLadder();
{ const w = worst((wpm) => longestGap(base, wpm)); console.log(`BASELINE (×6 ladder)                 longest ${w.hours.toFixed(1)}h  (${w.who}, toward T${w.gapTier})`); }

// A) MORE TIERS — insert intermediate Key tiers past T4 (ratio ×√6≈2.449 → 2× the tiers).
{ const L = reRatioLadder(4, Math.sqrt(6)); const w = worst((wpm) => longestGap(L, wpm)); console.log(`A) MORE TIERS  ratio √6≈2.45 past T4  longest ${w.hours.toFixed(1)}h  (${w.who})   [+${L.length - base.slice(0, 9).length} tiers to reach T8-equiv]`); }
{ const L = reRatioLadder(4, 1.7); const w = worst((wpm) => longestGap(L, wpm)); console.log(`   MORE TIERS  ratio 1.7 past T4       longest ${w.hours.toFixed(1)}h  (${w.who})`); }

// B) CHEAPER LATE TIERS — lower the past-T4 ratio ×6 → ×3 (same T0-T4, gentler top).
{ const L = reRatioLadder(4, 3); const w = worst((wpm) => longestGap(L, wpm)); console.log(`B) CHEAPER LATE  ratio ×6→×3 past T4   longest ${w.hours.toFixed(1)}h  (${w.who})`); }

// C) NEW SINK — a second parallel track alongside KEY POWER: many cheaper tiers (ratio ×1.6 from 2000),
//    reward event = a purchase in EITHER track. Player buys the cheapest next across both.
{ const sink = []; let c = 0, p = 2000; sink.push(0); for (let i = 0; i < 40 && p < 140000000; i++) { c = round10(c + p); sink.push(c); p = round10(p * 1.6); }
  const w = worst((wpm) => longestGapTwoTracks(base, sink, wpm)); console.log(`C) NEW SINK  parallel ×1.6 track       longest ${w.hours.toFixed(1)}h  (${w.who})   [always-something-to-buy]`); }

// C-BEST) REPEATABLE SINK — the classic idle answer: one "buy another unit" upgrade whose price
//   rises GENTLY (×1.05) from a low base, so the next purchase is always only minutes-to-hours away
//   and it NEVER runs out. This is the strongest lever by far.
{ const s = []; let c = 0, p = 5000; s.push(0); for (let i = 0; i < 200; i++) { c = round10(c + p); s.push(c); p = round10(p * 1.05); }
  const w = worst((wpm) => longestGapTwoTracks(base, s, wpm)); console.log(`C-BEST) REPEATABLE SINK ×1.05 (200 buys)  longest ${w.hours.toFixed(1)}h  (${w.who})   <== RECOMMENDED`); }

// D) CONTENT UNLOCKS — free reward events on a fixed PLAYTIME cadence (a new category/cosmetic every
//    K h), independent of wins. Longest gap = K by construction; report the cadence needed to cap at 20 h.
console.log(`D) CONTENT UNLOCKS  cadence = the cap  longest = K h  (a reward every K h of play; K=20 → 20h, needs ~10 unlocks over 200h)`);
