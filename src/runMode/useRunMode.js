// useRunMode.js — the RUN state machine + round clock. The engine (runMode/engine)
// is pure; this hook owns time and React state, mirroring how the solo modes split
// pure logic from useSoloGame. A run is RUN_ROUNDS rounds; each round is a real timed
// typing round scored by the shipped rarity×combo×lucky engine with the drafted
// modifiers applied, flavoured by the rolled solo mode (CHAIN / FUSE / SAT).
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  MODIFIERS, MODIFIER_BY_ID, RUN_ROUNDS, wallAt, roundKnobs, scoreWord,
  applyRoundMods, suddenDeathChance, dealOffers, runWinsPayout,
} from './engine.js';
import { ROUND_MODES } from './config.js';
import { markFreeRunUsed } from './runGate.js';
import { loadSoloWords, loadSoloAcceptExt } from '../solo/words.js';
import { loadRarityIndex, rarityOf } from '../progress/rarityIndex.js';
import { makeLuckyOracle, randomSeed, mulberry32 } from '../progress/luck.js';

export const ROUND_SECONDS = 30;
// Dev-only: ?rs=N shortens the round clock for screenshots / manual play. Clamped 2–60;
// ignored (→ 30s) in normal play.
function resolveRoundSeconds() {
  try {
    const n = parseInt(new URLSearchParams(window.location.search).get('rs'), 10);
    return Number.isFinite(n) && n >= 2 && n <= 60 ? n : ROUND_SECONDS;
  } catch { return ROUND_SECONDS; }
}
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const RARE_LETTERS = /[jqxz]/;
const countVowels = (w) => [...w].filter((c) => VOWELS.has(c)).length;

// Dev-only screenshot/QA overrides (mirrors ?rs=): ?stack=id,id preloads a modifier
// stack, ?round=N starts partway up the wall (clean=N-1 so MOMENTUM etc. show), and
// ?seed=N makes the whole run (rolled modes, luck) reproducible. Inert in normal play.
function devOverrides() {
  try {
    const q = new URLSearchParams(window.location.search);
    const raw = q.get('stack');
    const stackIds = raw
      ? raw.split(',').map((s) => s.trim()).filter((id) => MODIFIER_BY_ID[id])
      : [];
    const n = parseInt(q.get('round'), 10);
    const round = Number.isFinite(n) && n >= 1 && n <= RUN_ROUNDS ? n : 1;
    const sd = parseInt(q.get('seed'), 10);
    const seed = Number.isFinite(sd) ? (sd >>> 0) : null;
    return { stackIds, round, clean: round - 1, seed };
  } catch { return { stackIds: [], round: 1, clean: 0, seed: null }; }
}

// A run's whole state lives in one reducer so the phase transitions are explicit and
// the effects below never race a stale closure.
const initial = (seed) => {
  const dev = devOverrides();
  return {
    phase: 'loading', // loading | wall | round | draft | over
    seed: dev.seed ?? seed,
    round: dev.round,
    stackIds: dev.stackIds,
    cumulative: 0,
    clean: dev.clean, // clean (survived) rounds — feeds MOMENTUM
    lastRoundScore: 0,
    lastWall: 0,
    reason: null, // 'wall' | 'fumble' | 'cleared' (win)
    offers: [], // modifier ids offered this draft
    words: null, // { accept:Set }
  };
};

function reducer(s, a) {
  switch (a.type) {
    case 'ready': return { ...s, phase: 'wall', words: a.words };
    case 'startRound': return { ...s, phase: 'round' };
    case 'endRound': {
      const wall = wallAt(s.round);
      const passed = a.score >= wall && !a.fumbled;
      const cumulative = s.cumulative + a.score;
      if (!passed) {
        return { ...s, phase: 'over', cumulative, lastRoundScore: a.score, lastWall: wall, reason: a.fumbled ? 'fumble' : 'wall' };
      }
      if (s.round >= RUN_ROUNDS) {
        return { ...s, phase: 'over', cumulative, lastRoundScore: a.score, lastWall: wall, reason: 'cleared', clean: s.clean + 1 };
      }
      const rnd = mulberry32((s.seed ^ (s.round * 2654435761)) >>> 0);
      const offers = dealOffers(s.stackIds, rnd).map((m) => m.id);
      return { ...s, phase: 'draft', cumulative, lastRoundScore: a.score, lastWall: wall, clean: s.clean + 1, offers };
    }
    case 'pick': {
      return { ...s, phase: 'wall', round: s.round + 1, stackIds: [...s.stackIds, a.id], offers: [] };
    }
    default: return s;
  }
}

export function useRunMode() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initial(randomSeed()));
  const stack = state.stackIds.map((id) => MODIFIER_BY_ID[id]);

  // Load word + rarity data once (both are cached module-side).
  useEffect(() => {
    let alive = true;
    Promise.all([loadSoloWords(), loadRarityIndex().catch(() => null)]).then(([w]) => {
      if (!alive) return;
      loadSoloAcceptExt().catch(() => {}); // widen vocab in the background
      dispatch({ type: 'ready', words: w });
    });
    return () => { alive = false; };
  }, []);

  // The rolled mode for the current round — deterministic from seed+round so the wall
  // preview and the round agree.
  const roundMode = ROUND_MODES[Math.floor(mulberry32((state.seed ^ (state.round * 40503)) >>> 0)() * ROUND_MODES.length)];

  // ---- live round play (only meaningful while phase==='round') ----
  const knobs = roundKnobs(stack);
  const playRef = useRef(null);
  const [, force] = useReducer((x) => x + 1, 0);

  const startRound = useCallback(() => {
    const seed = (state.seed ^ (state.round * 0x9e3779b1)) >>> 0;
    playRef.current = {
      timeLeft: resolveRoundSeconds(),
      combo: knobs.comboStart,
      score: 0,
      words: 0,
      used: new Set(),
      lucky: makeLuckyOracle(seed),
      constraint: roundMode.key === 'fuse' ? pickFragment(mulberry32(seed)) : null,
      lastLetter: null,
      toast: null,
    };
    // fix/onramp: starting a round means the player actually PLAYED a run, so the free
    // first run is now spent — the LV8 gate engages from here on (idempotent write).
    markFreeRunUsed();
    dispatch({ type: 'startRound' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.seed, state.round, roundMode.key, knobs.comboStart]);

  // Round timer.
  useEffect(() => {
    if (state.phase !== 'round') return undefined;
    const id = setInterval(() => {
      const p = playRef.current;
      if (!p) return;
      p.timeLeft -= 1;
      if (p.timeLeft <= 0) {
        clearInterval(id);
        const ctx = { owned: 0, clean: state.clean };
        let score = applyRoundMods(p.score, stack, ctx);
        const fumbled = suddenDeathChance(stack) > 0 && p.lucky.next() && Math.random() < suddenDeathChance(stack);
        dispatch({ type: 'endRound', score, fumbled });
      }
      force();
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Submit a typed word during a round. Returns {ok, reason}.
  const submitWord = useCallback((raw) => {
    const p = playRef.current;
    if (!p || state.phase !== 'round') return { ok: false };
    const word = String(raw || '').trim().toLowerCase();
    if (word.length < 3) return fail(p, 'TOO SHORT', force);
    if (p.used.has(word)) return fail(p, 'ALREADY USED', force);
    if (!state.words?.accept.has(word)) return fail(p, 'NOT A WORD', force);
    if (roundMode.key === 'chain' && p.lastLetter && word[0] !== p.lastLetter) return fail(p, `START WITH "${p.lastLetter.toUpperCase()}"`, force);
    if (roundMode.key === 'fuse' && p.constraint && !word.includes(p.constraint)) return fail(p, `NEEDS "${p.constraint.toUpperCase()}"`, force);

    // rarityOf returns { band, mult, announce, … } — the band NAME is `.band`. (Reading
    // `.name` left rarity undefined, so live rounds silently scored every word as COMMON,
    // contradicting the sim/wall calibration, and the toast printed "undefined!".)
    const r = rarityOf(word);
    const w = {
      rarity: r.band, len: word.length, vowels: countVowels(word),
      rare: RARE_LETTERS.test(word), lucky: !knobs.noLucky && p.lucky.next(), combo: p.combo,
    };
    p.score += scoreWord(w, stack, knobs);
    p.combo = Math.min(knobs.comboMax, p.combo + knobs.comboStep);
    p.words += 1;
    p.used.add(word);
    p.lastLetter = word[word.length - 1];
    if (roundMode.key === 'fuse') p.constraint = pickFragment(p.lucky.next() ? mulberry32(p.words * 7919) : mulberry32(p.words * 104729));
    p.toast = w.lucky ? 'LUCKY ×5!' : (r.announce ? `${r.band}!` : null);
    force();
    return { ok: true, lucky: w.lucky, band: r.band };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.words, roundMode.key, knobs]);

  const pick = useCallback((id) => dispatch({ type: 'pick', id }), []);

  const winsEarned = state.phase === 'over'
    ? runWinsPayout(state.cumulative, state.reason === 'cleared' ? RUN_ROUNDS : state.round)
    : 0;

  // THE TRUE LIVE STANDING vs the wall. The round-level modifiers (DEEP POCKETS's flat
  // +150, MOMENTUM's ×N, SHORT FUSE ×1.5, GLASS CANNON ×2.5…) are applied to the raw
  // per-word sum at round end — so the meter MUST show the same round-adjusted number the
  // wall is actually compared against, not the raw typed total. The ctx here is byte-for-
  // byte the one endRound uses ({ owned: 0, clean }), so the displayed gap is the real gap.
  const rawRoundScore = state.phase === 'round' && playRef.current ? playRef.current.score : 0;
  const projected = state.phase === 'round' && playRef.current
    ? applyRoundMods(playRef.current.score, stack, { owned: 0, clean: state.clean })
    : 0;

  return {
    phase: state.phase,
    round: state.round,
    totalRounds: RUN_ROUNDS,
    wall: wallAt(state.round),
    projected,      // round-adjusted live score — compare THIS to the wall
    rawRoundScore,  // the raw typed total (before round-level modifiers)
    roundMode,
    stack,
    offers: state.offers.map((id) => MODIFIER_BY_ID[id]),
    allModifiers: MODIFIERS,
    cumulative: state.cumulative,
    lastRoundScore: state.lastRoundScore,
    lastWall: state.lastWall,
    reason: state.reason,
    winsEarned,
    play: playRef.current,
    startRound,
    submitWord,
    pick,
  };
}

function fail(p, toast, force) { p.toast = toast; p.combo = 1; force(); return { ok: false, reason: toast }; }
function pickFragment(rnd) {
  const frags = ['er', 'in', 'at', 'ing', 'ent', 'ar', 'st', 'ck', 're', 'on', 'an', ' or', 'te'].map((f) => f.trim());
  return frags[Math.floor(rnd() * frags.length)];
}
