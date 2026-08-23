// chain.js — CHAIN solo mode, pure engine (NO timers, NO DOM, NO React).
//
// RULES. Each word must START with the previous word's LAST letter. Min 3 letters,
// no repeats within a run, must be in the ACCEPT set. ONE life. The clock per turn
// shrinks as you go, and repeatedly ENDING on the same letter makes that letter hotter
// (less time) — that heat is the load-bearing anti-exploit rule (see heatMul).
//
// The engine is a stateful object built by createChainEngine(); the React hook owns the
// clock and calls currentTMax() / submit() / timeout(). Every constant here was fitted
// against the real dictionary and adversarially attacked — do not "improve" one.

// The 18 letters a run may OPEN on (independently verified — do not extend).
export const CHAIN_OPENERS = 'abcdefghilmnoprstw';

// tMax floor (ms). The curve is asymptotic to this — it approaches but never dips below.
export const CHAIN_TMAX_FLOOR = 4500;

// Base per-turn time BEFORE heat, as a function of links completed (k). Word 1 (k=0) is
// 18000ms; strictly decreasing; → 4500 as k grows.
export function chainT(k) {
  return CHAIN_TMAX_FLOOR + 13500 * Math.exp(-k / 10);
}

// HEAT — the anti-exploit rule. Time is scaled by (1 - min(0.95, 0.06 * endCount)),
// where endCount is how many times THIS run has ENDED a word on the required letter.
// No grace period: heat applies from the very first repeat. The 0.95 cap is load-bearing
// (at 0.60 the plural-pump exploit returns). Never returns a negative multiplier.
export function heatMul(endCount) {
  return 1 - Math.min(0.95, 0.06 * endCount);
}

// Score for one accepted link.
export function chainScore(wordLength, multiplier) {
  return Math.round(10 * wordLength * multiplier);
}

// Multiplier tuning.
export const CHAIN_MULT_BASE = 1.0;
export const CHAIN_MULT_STEP = 0.25;
export const CHAIN_MULT_CAP = 2.5;

// Supply/dead-end thresholds, measured against UNUSED top-3000-by-frequency continuations.
export const DEAD_END_BELOW = 3; // < this many unused common continuations ⇒ dead end
export const FEW_LEFT_BELOW = 35; // < this ⇒ "FEW LEFT"

export function pickOpener(rng = Math.random) {
  return CHAIN_OPENERS[Math.floor(rng() * CHAIN_OPENERS.length)];
}

// Reject codes reused from shared so the UI has one vocabulary.
import { REJECT } from './shared.js';

/**
 * @param {object} opts
 * @param {Set<string>} opts.accept    the ACCEPT membership set
 * @param {string[]}    opts.topCommon the top-3000 RECALL words (frequency-ordered)
 * @param {() => number} [opts.rng]    injected RNG in [0,1)
 */
export function createChainEngine({ accept, topCommon = [], rng = Math.random } = {}) {
  if (!accept) throw new Error('createChainEngine: accept set required');

  // Bucket the common words by first letter once, so supply/dead-end checks are cheap.
  const commonByFirst = new Map();
  for (const w of topCommon) {
    const c = w[0];
    let arr = commonByFirst.get(c);
    if (!arr) commonByFirst.set(c, (arr = []));
    arr.push(w);
  }

  const state = {
    alive: true,
    k: 0, // links completed
    score: 0,
    multiplier: CHAIN_MULT_BASE,
    requiredLetter: pickOpener(rng),
    used: new Set(),
    endCount: Object.create(null), // letter → times a word ENDED on it this run
    endedLetters: new Set(),
    lastLinks: [], // {word, score} — most recent last
    killedLetter: null,
    rerouted: false, // set true on the turn a reroute happened (for the UI cue)
  };

  const endCountOf = (letter) => state.endCount[letter] || 0;

  // Unused common continuations for a letter, and the readout label.
  function supply(letter) {
    const arr = commonByFirst.get(letter) || [];
    let count = 0;
    for (const w of arr) if (!state.used.has(w)) count += 1;
    let label;
    if (count < DEAD_END_BELOW) label = 'DEAD END';
    else if (count < FEW_LEFT_BELOW) label = `FEW LEFT · ${count} common words`;
    else label = `${count} common words start with ${letter.toUpperCase()}`;
    return { count, label };
  }

  function currentTMax() {
    return chainT(state.k) * heatMul(endCountOf(state.requiredLetter));
  }

  // Validate WITHOUT mutating. Returns a REJECT code, or null if the word is good.
  function validate(raw) {
    const word = String(raw).trim().toLowerCase();
    if (word.length < 3) return REJECT.TOO_SHORT;
    if (word[0] !== state.requiredLetter) return REJECT.BAD_START;
    if (state.used.has(word)) return REJECT.ALREADY_USED;
    if (!accept.has(word)) return REJECT.NOT_IN_LIST;
    return null;
  }

  // Reroute to the opener with the highest endCount (random among ties), bump that
  // letter's endCount (so dumping makes it hotter), and reset the multiplier.
  function reroute() {
    let best = -1;
    for (const c of CHAIN_OPENERS) best = Math.max(best, endCountOf(c));
    const tied = [];
    for (const c of CHAIN_OPENERS) if (endCountOf(c) === best) tied.push(c);
    const target = tied[Math.floor(rng() * tied.length)];
    state.endCount[target] = endCountOf(target) + 1;
    state.requiredLetter = target;
    state.multiplier = CHAIN_MULT_BASE;
    state.rerouted = true;
  }

  // Submit a word. On reject the input is NOT consumed and the multiplier resets to 1.0.
  // On accept the link scores, heat/multiplier update, the required letter advances to the
  // word's last letter, and if that letter is a dead end we award + reroute.
  function submit(raw) {
    if (!state.alive) return { ok: false, reason: null };
    state.rerouted = false;
    const reason = validate(raw);
    if (reason) {
      state.multiplier = CHAIN_MULT_BASE; // a rejection breaks the streak
      return { ok: false, reason, requiredLetter: state.requiredLetter };
    }

    const word = String(raw).trim().toLowerCase();
    const endLetter = word[word.length - 1];
    const fresh = !state.endedLetters.has(endLetter);

    // Multiplier: +step for a fresh end-letter (capped), reset on a repeat letter.
    if (fresh) state.multiplier = Math.min(CHAIN_MULT_CAP, state.multiplier + CHAIN_MULT_STEP);
    else state.multiplier = CHAIN_MULT_BASE;

    const gained = chainScore(word.length, state.multiplier);
    state.score += gained;
    state.used.add(word);
    state.endCount[endLetter] = endCountOf(endLetter) + 1;
    state.endedLetters.add(endLetter);
    state.k += 1;
    state.lastLinks.push({ word, score: gained });
    if (state.lastLinks.length > 5) state.lastLinks = state.lastLinks.slice(-5);

    state.requiredLetter = endLetter;

    // Dead-end rescue: if the new required letter has too few unused common words, the
    // link still counts but we reroute to keep the run going (and reset the multiplier).
    let rerouted = false;
    if (supply(endLetter).count < DEAD_END_BELOW) {
      reroute();
      rerouted = true;
    }

    return {
      ok: true,
      word,
      gained,
      multiplier: state.multiplier,
      requiredLetter: state.requiredLetter,
      rerouted,
    };
  }

  // The clock ran out — the run ends on the letter the player couldn't answer.
  function timeout() {
    if (!state.alive) return;
    state.alive = false;
    state.killedLetter = state.requiredLetter;
  }

  return {
    state,
    supply,
    currentTMax,
    validate,
    submit,
    timeout,
    endCountOf,
  };
}
