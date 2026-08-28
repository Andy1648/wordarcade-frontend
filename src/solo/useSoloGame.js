// useSoloGame.js — the shared RUNTIME for both solo modes. The engines (chain.js,
// fuse.js) are PURE and hold no clock; this hook owns the clock, the arm state, the
// reject feedback, and the restart arming, and drives either engine through a tiny
// `adapter`. Keeping the timer here (not in the engine) is the same split satRush uses,
// so the rules stay unit-testable and the timing lives in one place.
//
// The adapter abstracts the two modes' differences:
//   budgetMs(engine)   → ms for the current turn (CHAIN: currentTMax; FUSE: fuseMs)
//   onTimeout(engine)  → the clock hit 0. Returns { dead } (CHAIN: always dead; FUSE:
//                        loses a life, dead only at 0 lives). Serves the next fuse itself.
//   getScore(engine)   → the run's score for the personal best
//   rejectCtx(engine)  → { letter, fragment } to fill a reject message
import { useCallback, useEffect, useRef, useState } from 'react';
import { RED_ZONE_MS, rejectMessage, restartArmMs, getPB, setPB, submitSoloWord } from './shared.js';
import { tierForClockLeft } from '../share/resultCard.js';
import { freshCombo, comboAccept, comboBreak } from '../progress/combo.js';
import { makeLuckyOracle, luckyReward, randomSeed } from '../progress/luck.js';
import { xpPerInput, creditXp, loadProgress, saveProgress } from '../progress/xp.js';
import { sndWordAccepted, sndWordRejected, sndLucky, sndRunOver } from '../audio/gameSounds.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// DEV/TEST-ONLY per-turn clock cap, read once from ?soloms=<100..20000>. Lets an e2e drive a
// CHAIN/FUSE run to its death-card screen deterministically instead of waiting the real ~18s
// word-1 timer. null (the default) leaves the shipped clock untouched. Mirrors satRush's ?stage=.
const SOLO_CLOCK_CAP_MS = (() => {
  try {
    const raw = new URLSearchParams(window.location.search).get('soloms');
    if (raw == null) return null;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 100 && n <= 20000) return n;
  } catch {
    /* location unavailable — no override */
  }
  return null;
})();

export function useSoloGame({ createEngine, adapter, pbKey, onRunStart, onAccept, mode }) {
  const engineRef = useRef(null);
  if (engineRef.current === null) engineRef.current = createEngine();

  // Optional "a run just began" hook, fired on the first run (mount) and on every restart
  // — button OR Enter — so a caller-owned run counter can't miss the Enter path (which
  // lives in this hook). Kept in a ref so restart's identity doesn't depend on it.
  const onRunStartRef = useRef(onRunStart);
  onRunStartRef.current = onRunStart;
  // Optional "a word was accepted" hook, fired PER accepted word (see onSubmit). CHAIN/FUSE pass
  // progress/streak.touchStreak so playing either mode counts toward the daily streak — they never
  // route through wordCount.addWords. Kept in a ref so onSubmit's identity doesn't depend on it.
  const onAcceptRef = useRef(onAccept);
  onAcceptRef.current = onAccept;
  const firstRunFiredRef = useRef(false);
  useEffect(() => {
    if (firstRunFiredRef.current) return undefined;
    firstRunFiredRef.current = true;
    onRunStartRef.current?.();
    return undefined;
  }, []);

  const runIndexRef = useRef(0);
  const armedRef = useRef(false);
  const turnStartRef = useRef(0);
  const turnBudgetRef = useRef(0);
  // Per-accepted-word SPEED tier log for the shareable result card (Job 1): one
  // 'fast'|'mid'|'slow' per accepted word, from the clock-left fraction at submit.
  // Pure data only — it never affects the run. Reset on every restart.
  const tierLogRef = useRef([]);
  // WINS COMBO (Job 2): consecutive accepts build a multiplier that boosts the run's wins
  // payout; a reject/timeout resets it. Pure state kept in a ref (mutated at the same points
  // that already trigger a re-render), read live by the HUD readout and the round-end payout.
  const comboRef = useRef(freshCombo());
  // LUCKY WORDS (Job 4): a per-run seeded oracle decides, AFTER each accept, whether the word is
  // lucky (1/40) — paying 5× wins (folded into the per-word banking WEIGHT via `luckyMult`, see
  // ChainGame/FuseGame) and 5× XP (credited here). `luckyLastMultRef` holds THIS word's factor
  // (5 or 1); `luckyCountRef` is the run's lucky-hit count, used as the gold-burst re-key.
  const luckyOracleRef = useRef(makeLuckyOracle(randomSeed()));
  const luckyLastMultRef = useRef(1);
  const luckyCountRef = useRef(0);
  const rafRef = useRef(0);
  const restartTimerRef = useRef(null);

  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  const [phase, setPhase] = useState('playing'); // 'playing' | 'over'
  const [armed, setArmed] = useState(false);
  const [input, setInput] = useState('');
  const [remaining, setRemaining] = useState(() => adapter.budgetMs(engineRef.current));
  const [sillKey, setSillKey] = useState(0); // bumped per reject → the sill flash re-fires
  const [reason, setReason] = useState('');
  const [restartArmed, setRestartArmed] = useState(false);
  const [best, setBest] = useState(() => getPB(pbKey));

  const engine = engineRef.current;
  const tMax = turnBudgetRef.current || adapter.budgetMs(engine);
  const redZone = armed && remaining <= RED_ZONE_MS;

  const stopRaf = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };

  const endRun = useCallback(() => {
    stopRaf();
    armedRef.current = false;
    setArmed(false);
    setPhase('over');
    sndRunOver(); // Job 11: gentle descending run-over fall
    const score = adapter.getScore(engineRef.current);
    setBest(setPB(pbKey, score));
    // Enter-to-restart arms after a delay (longer on run 1 / very short runs) so an
    // Enter-masher can't skip the death card. The button is clickable immediately.
    setRestartArmed(false);
    const delay = restartArmMs({
      runIndex: runIndexRef.current,
      wordsThisRun: adapter.getWords(engineRef.current),
    });
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => setRestartArmed(true), delay);
  }, [adapter, pbKey]);

  // Start a fresh turn's clock (or the very first, once armed).
  const startTurnClock = useCallback(() => {
    turnStartRef.current = now();
    const budget = adapter.budgetMs(engineRef.current);
    // DEV/TEST-ONLY override (mirrors SAT Rush's ?stage=): ?soloms=<100..20000> caps the per-turn
    // budget so the run-over / death-card screen is reachable deterministically in e2e without
    // waiting the real ~18s word-1 clock. No effect unless the param is present.
    turnBudgetRef.current = SOLO_CLOCK_CAP_MS != null ? Math.min(budget, SOLO_CLOCK_CAP_MS) : budget;
    setRemaining(turnBudgetRef.current);
  }, [adapter]);

  // The countdown loop. Only runs once armed and alive.
  useEffect(() => {
    if (!armed || phase !== 'playing') return undefined;
    const tick = () => {
      const rem = turnBudgetRef.current - (now() - turnStartRef.current);
      if (rem <= 0) {
        comboRef.current = comboBreak(comboRef.current); // a timeout resets the wins combo
        const { dead } = adapter.onTimeout(engineRef.current);
        if (dead) {
          setRemaining(0);
          endRun();
          return;
        }
        // survived (FUSE life loss): a new fuse was served — restart the clock
        startTurnClock();
        rerender();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      setRemaining(rem);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return stopRaf;
  }, [armed, phase, adapter, endRun, startTurnClock, rerender]);

  // Arm on the first typed character of word 1 (see ARM_HINT): the clock does not run
  // until then, so word 1 can't be lost before the rule is read.
  const onInput = useCallback(
    (value) => {
      setInput(value);
      if (!armedRef.current && phase === 'playing' && value.length > 0) {
        armedRef.current = true;
        setArmed(true);
        startTurnClock();
      }
    },
    [phase, startTurnClock]
  );

  const onSubmit = useCallback(() => {
    if (phase !== 'playing') return;
    const word = input.trim().toLowerCase();
    if (!word) return;
    // submitSoloWord fires onAccept (streak touch) exactly once on an accepted word, mid-run.
    const r = submitSoloWord(engineRef.current, word, onAcceptRef.current);
    if (r.ok) {
      // Record how much of the clock was left when this word landed (share-card glyph).
      const budget = turnBudgetRef.current || 1;
      const left = (budget - (now() - turnStartRef.current)) / budget;
      tierLogRef.current.push(tierForClockLeft(left));
      comboRef.current = comboAccept(comboRef.current); // grow the wins combo
      sndWordAccepted(comboRef.current.streak); // Job 11: accept chime, pitch climbs with the combo
      // LUCKY check — AFTER acceptance only (never telegraphed). Record THIS word's factor
      // (×5 on a 1/40 hit, else ×1) for the per-word banking fold; on a hit, bank 5× the mode's
      // per-word XP and bump the gold-burst count.
      const reward = luckyReward(luckyOracleRef.current.next());
      luckyLastMultRef.current = reward.winsWeight;
      if (reward.lucky) {
        luckyCountRef.current += 1;
        sndLucky(); // Job 11: lucky-word sparkle
        if (mode) {
          const gain = xpPerInput({ mode }) * reward.xpMult;
          saveProgress(creditXp(loadProgress(), gain, 0).state);
        }
      }
      setReason('');
      setInput('');
      startTurnClock(); // the next turn's budget (new required letter / new fragment)
      rerender();
    } else {
      // Reject: the input is NEVER cleared and there is NO shake — the sill flashes and a
      // named reason prints, so the evidence of the attempt survives.
      comboRef.current = comboBreak(comboRef.current); // a reject resets the wins combo
      sndWordRejected(); // Job 11: soft downward reject (not a buzzer)
      setReason(rejectMessage(r.reason, adapter.rejectCtx(engineRef.current)));
      setSillKey((k) => k + 1);
    }
  }, [phase, input, adapter, startTurnClock, rerender]);

  const restart = useCallback(() => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    stopRaf();
    engineRef.current = createEngine();
    runIndexRef.current += 1;
    tierLogRef.current = []; // fresh run → fresh share-card glyph log
    comboRef.current = freshCombo(); // fresh run → fresh wins combo
    // Fresh run → fresh lucky oracle (new seed), reset per-word factor + hit count.
    luckyOracleRef.current = makeLuckyOracle(randomSeed());
    luckyLastMultRef.current = 1;
    luckyCountRef.current = 0;
    armedRef.current = false;
    turnBudgetRef.current = adapter.budgetMs(engineRef.current);
    setArmed(false);
    setInput('');
    setReason('');
    setRestartArmed(false);
    setRemaining(turnBudgetRef.current);
    setPhase('playing');
    onRunStartRef.current?.(); // count this new run (covers both button and Enter)
  }, [createEngine, adapter]);

  // Enter restarts from the death card, but only once armed (guards the tutorial).
  useEffect(() => {
    if (phase !== 'over') return undefined;
    const onKey = (e) => {
      if (e.key === 'Enter' && restartArmed) restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, restartArmed, restart]);

  useEffect(
    () => () => {
      stopRaf();
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    },
    []
  );

  return {
    engine,
    phase,
    armed,
    input,
    onInput,
    onSubmit,
    remaining,
    tMax,
    redZone,
    sillKey,
    reason,
    restart,
    restartArmed,
    best,
    // Per-accepted-word speed tiers for the share card (live array; fully populated by 'over').
    tierLog: tierLogRef.current,
    // WINS combo (live): { streak, mult, weighted, breaks }. `mult` folds into each word's
    // per-word banking weight (see ChainGame/FuseGame); `breaks` re-keys the HUD pill shake.
    combo: comboRef.current,
    // LUCKY (live): the just-accepted word's factor (×5 on a 1/40 hit, else ×1) folded into the
    // per-word banking weight, plus `luckyKey` (the run's hit count) that re-fires the gold burst.
    luckyMult: luckyLastMultRef.current,
    luckyKey: luckyCountRef.current,
  };
}
