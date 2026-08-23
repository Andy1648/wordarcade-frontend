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
export function createFuseEngine({ accept, pools, rng = Math.random } = {}) {
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
    fragment: null,
    tier: null,
    fuseMs: 0, // the current fragment's fuse length
    shortPenalty: false, // was THIS fuse docked by a preceding short word?
  };

  // The length factor to apply to the NEXT served fuse. 1.0 after a 5+ word / a life loss.
  let lenFactorNext = 1.0;

  // Serve the next fragment: pick a tier by crossfade, draw without replacement, and set the
  // fuse from base(w) × tierMult × the carried length factor.
  function serve() {
    const tier = selectTier(state.wordsSolved, rng);
    state.tier = tier;
    state.fragment = bags[tier].draw();
    state.shortPenalty = lenFactorNext < 1.0;
    state.fuseMs = fuseBase(state.wordsSolved) * FUSE_TIER_MULT[tier] * lenFactorNext;
    lenFactorNext = 1.0; // consumed
    return { fragment: state.fragment, tier, fuseMs: state.fuseMs, shortPenalty: state.shortPenalty };
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

  return { state, start, serve, validate, submit, expire };
}
