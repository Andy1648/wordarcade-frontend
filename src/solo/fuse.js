// fuse.js — FUSE solo mode, pure engine (NO timers, NO DOM, NO React).
//
// RULES. A fragment appears; type any ACCEPT word CONTAINING it. No repeats. TWO lives,
// capped at 3. The fuse (time to answer) shrinks as you solve more words, is stretched a
// little for harder fragment tiers, and is DOCKED after a short word so shortest-word play
// can't defeat the fitted curve. Every constant here was fitted against the real dictionary
// and adversarially attacked — do not "improve" one.

import { REJECT } from './shared.js';

// Base fuse (ms) BEFORE tier + length adjustments, as a function of words solved (w).
// w=0 ⇒ 12500ms.
export function fuseBase(w) {
  return 3500 + 9000 * Math.exp(-w / 15);
}

// Tiers, easy→brutal, and the time multiplier each earns (harder ⇒ a little more time).
export const FUSE_TIERS = ['e', 'm', 'h', 'b'];
export const FUSE_TIER_MULT = { e: 1.0, m: 1.05, h: 1.14, b: 1.3 };

// LENGTH FACTOR, applied to the NEXT fuse based on the word just solved: a 3-letter word
// docks the next fuse to 0.80, a 4-letter to 0.92, 5+ leaves it at 1.00. A natural player's
// mean factor is ~0.990 (costs them ~1%); a shortest-word bot pays it every turn.
export function lenFactor(len) {
  if (len <= 3) return 0.8;
  if (len === 4) return 0.92;
  return 1.0;
}

// Probabilistic CROSSFADE tier selection (NOT a step function — a step produced a 15-point
// hazard cliff; this keeps it near 4). x ramps 0→3 over the first 33 words; the fractional
// part is the chance of bumping up a tier this turn.
export function selectTier(w, rng = Math.random) {
  const x = Math.min(3, w / 11);
  const i = Math.floor(x);
  return FUSE_TIERS[rng() < x - i ? Math.min(i + 1, 3) : i];
}

export const FUSE_START_LIVES = 2;
export const FUSE_MAX_LIVES = 3;

// LAST-LETTERS STEERING (STEP 20 / Andy oct2). Players stalled on the last 3 strip letters because
// a random fragment rarely leads to a q/x/z/j word. From STEER_FROM lit letters on, STEER_P of the
// served fragments are drawn from the fragments that LEAD to a still-dark letter: the fragment
// contains it, or its words are at least STEER_LIFT× likelier than average to contain it (with
// STEER_MIN_WORDS real examples) — "ect" for j (reject, object, subject…). 'j' has no fragment in
// any pool, so the second rule is the only way it is ever reachable — and with it, it always is.
// The tier (and so the fuse timing) is still picked by selectTier: steering changes WHICH fragment
// of that tier, never how long you get.
export const STEER_FROM = 19;
export const STEER_P = 0.75;
export const STEER_MIN_WORDS = 3;
export const STEER_LIFT = 3;
const STEER_SCAN_CAP = 2500;
const STEER_BASE_SAMPLE = 3000; // words sampled for each fragment's base rate // words scanned per letter when building its reachable-fragment set
// Built once per (accept set, pools) pair and shared by every engine/run — the scan is the only
// non-trivial work steering does, and a fresh run must not redo it (or hitch on it).
const LEADS_CACHE = new WeakMap(); // accept → WeakMap(pools → Map(letter → {e,m,h,b}))

// A shuffled bag over a fragment pool: draws WITHOUT REPLACEMENT, reshuffling only once the
// bag is empty. So the first pool.length draws are a permutation (no repeat within a run
// until the pool is exhausted). Plain random repeated a fragment within a run 95.6% of runs.
export function createFragmentBag(pool, rng = Math.random) {
  const base = pool.slice();
  let bag = [];
  const refill = () => {
    bag = base.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = bag[i];
      bag[i] = bag[j];
      bag[j] = t;
    }
  };
  return {
    draw() {
      if (bag.length === 0) refill();
      return bag.pop();
    },
  };
}

/**
 * @param {object} opts
 * @param {Set<string>} opts.accept  the ACCEPT membership set
 * @param {{e:string[],m:string[],h:string[],b:string[]}} opts.pools  fragment pools by tier
 * @param {() => number} [opts.rng]  injected RNG in [0,1)
 */
export function createFuseEngine({ accept, pools, rng = Math.random, steerP = STEER_P } = {}) {
  if (!accept) throw new Error('createFuseEngine: accept set required');
  if (!pools) throw new Error('createFuseEngine: fragment pools required');

  const bags = {
    e: createFragmentBag(pools.e, rng),
    m: createFragmentBag(pools.m, rng),
    h: createFragmentBag(pools.h, rng),
    b: createFragmentBag(pools.b, rng),
  };

  const state = {
    alive: true,
    wordsSolved: 0,
    score: 0, // FUSE scores in words solved
    lives: FUSE_START_LIVES,
    used: new Set(),
    lettersUsed: new Set(), // the alphabet strip (a-z lit this cycle)
    stripsCleared: 0, // full a–z strips this run — each one triggers FUSE FRENZY (frenzy.js)
    fragment: null,
    tier: null,
    fuseMs: 0, // the current fragment's fuse length
    shortPenalty: false, // was THIS fuse docked by a preceding short word?
    shortFactor: 1, // the ACTUAL length factor applied to this fuse (0.8 / 0.92 / 1.0) — the UI
    //                shows this exact number instead of a hardcoded ×0.8 (a 4-letter word is ×0.92).
    lastWord: '', // the most recently solved word (RARITY scoring + pop)
  };

  // The length factor to apply to the NEXT served fuse. 1.0 after a 5+ word / a life loss.
  let lenFactorNext = 1.0;

  // letter → { e:[...], m:[...], h:[...], b:[...] } fragments that lead to it (built lazily, cached).
  let byPools = LEADS_CACHE.get(accept);
  if (!byPools) LEADS_CACHE.set(accept, (byPools = new WeakMap()));
  let leadsTo = byPools.get(pools);
  if (!leadsTo) byPools.set(pools, (leadsTo = new Map()));
  // Each fragment's base rate (share of a common-word sample containing it), computed once.
  function baseRates() {
    if (leadsTo.has('__base')) return leadsTo.get('__base');
    const freq = new Map();
    let n = 0;
    for (const w of accept) {
      if (++n > STEER_BASE_SAMPLE) break;
      for (const t of FUSE_TIERS) for (const f of pools[t]) if (w.includes(f)) freq.set(f, (freq.get(f) || 0) + 1);
    }
    const out = { freq, n: Math.min(n, STEER_BASE_SAMPLE) };
    leadsTo.set('__base', out);
    return out;
  }
  function fragmentsLeadingTo(ch) {
    if (leadsTo.has(ch)) return leadsTo.get(ch);
    const base = baseRates();
    const hits = new Map(); // fragment → scanned words containing both it and ch
    let scanned = 0;
    for (const w of accept) {
      if (!w.includes(ch)) continue;
      if (++scanned > STEER_SCAN_CAP) break;
      for (const t of FUSE_TIERS) for (const f of pools[t]) if (w.includes(f)) hits.set(f, (hits.get(f) || 0) + 1);
    }
    const n = Math.max(1, Math.min(scanned, STEER_SCAN_CAP));
    const leads = (f) => {
      const h = hits.get(f) || 0;
      if (h < STEER_MIN_WORDS) return false;
      const p = (base.freq.get(f) || 0.5) / base.n; // base rate (half a hit if unseen in the sample)
      return h / n >= STEER_LIFT * p;
    };
    const out = {};
    for (const t of FUSE_TIERS) out[t] = pools[t].filter((f) => f.includes(ch) || leads(f));
    leadsTo.set(ch, out);
    return out;
  }
  // A steering fragment for this tier, or null (not steering this turn / nothing leads anywhere).
  function steerFragment(tier) {
    if (state.lettersUsed.size < STEER_FROM || !(steerP > 0) || rng() >= steerP) return null;
    const dark = [];
    for (let c = 97; c <= 122; c++) if (!state.lettersUsed.has(String.fromCharCode(c))) dark.push(String.fromCharCode(c));
    if (!dark.length) return null;
    const ch = dark[Math.floor(rng() * dark.length)];
    const lead = fragmentsLeadingTo(ch);
    // Same tier first; else the nearest tier that has one (easier first).
    const order = [tier, ...FUSE_TIERS.filter((t) => t !== tier)];
    for (const t of order) {
      const cands = lead[t].filter((f) => f !== state.fragment && !state.used.has(f));
      if (cands.length) return cands[Math.floor(rng() * cands.length)];
    }
    return null;
  }

  // Serve the next fragment: pick a tier by crossfade, draw without replacement, and set the
  // fuse from base(w) × tierMult × the carried length factor.
  function serve() {
    const tier = selectTier(state.wordsSolved, rng);
    state.tier = tier;
    state.fragment = steerFragment(tier) || bags[tier].draw();
    state.shortPenalty = lenFactorNext < 1.0;
    state.shortFactor = lenFactorNext; // the exact factor applied (for a truthful UI readout)
    state.fuseMs = fuseBase(state.wordsSolved) * FUSE_TIER_MULT[tier] * lenFactorNext;
    lenFactorNext = 1.0; // consumed
    return { fragment: state.fragment, tier, fuseMs: state.fuseMs, shortPenalty: state.shortPenalty, shortFactor: state.shortFactor };
  }

  function start() {
    return serve();
  }

  function validate(raw) {
    const word = String(raw).trim().toLowerCase();
    if (!word.includes(state.fragment)) return REJECT.BAD_CONTAIN;
    if (state.used.has(word)) return REJECT.ALREADY_USED;
    if (!accept.has(word)) return REJECT.NOT_IN_LIST;
    return null;
  }

  // Light every distinct letter of a solved word; a full a-z strip grants +1 life (cap 3)
  // and resets the strip. Returns whether the strip cleared this time.
  function lightLetters(word) {
    for (const ch of word) if (ch >= 'a' && ch <= 'z') state.lettersUsed.add(ch);
    if (state.lettersUsed.size >= 26) {
      state.lettersUsed = new Set();
      state.stripsCleared += 1;
      const gained = state.lives < FUSE_MAX_LIVES;
      if (gained) state.lives += 1;
      return { stripCleared: true, lifeGained: gained };
    }
    return { stripCleared: false, lifeGained: false };
  }

  function submit(raw) {
    if (!state.alive) return { ok: false, reason: null };
    const reason = validate(raw);
    if (reason) return { ok: false, reason, fragment: state.fragment };

    const word = String(raw).trim().toLowerCase();
    state.used.add(word);
    state.wordsSolved += 1;
    state.score = state.wordsSolved;
    state.lastWord = word; // RARITY: aligned with wordsSolved for per-word scoring
    const strip = lightLetters(word);

    // Dock the NEXT fuse if this word was short.
    lenFactorNext = lenFactor(word.length);
    const shortWord = lenFactorNext < 1.0;

    const served = serve();
    return {
      ok: true,
      word,
      wordsSolved: state.wordsSolved,
      lives: state.lives,
      stripCleared: strip.stripCleared,
      lifeGained: strip.lifeGained,
      shortWord, // the word just solved was short ⇒ next fuse is docked
      ...served,
    };
  }

  // The fuse ran out: lose a life and serve a fresh fragment; at 0 lives the run ends.
  function expire() {
    if (!state.alive) return { ok: false, ended: false };
    state.lives -= 1;
    if (state.lives <= 0) {
      state.lives = 0;
      state.alive = false;
      return { ok: false, ended: true, lives: 0 };
    }
    lenFactorNext = 1.0; // a life loss is not a short word
    const served = serve();
    return { ok: false, ended: false, lives: state.lives, ...served };
  }

  return { state, start, serve, validate, submit, expire, fragmentsLeadingTo };
}
