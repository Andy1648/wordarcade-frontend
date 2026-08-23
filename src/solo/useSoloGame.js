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
import { RED_ZONE_MS, rejectMessage, restartArmMs, getPB, setPB } from './shared.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function useSoloGame({ createEngine, adapter, pbKey }) {
  const engineRef = useRef(null);
  if (engineRef.current === null) engineRef.current = createEngine();

  const runIndexRef = useRef(0);
  const armedRef = useRef(false);
  const turnStartRef = useRef(0);
  const turnBudgetRef = useRef(0);
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
    turnBudgetRef.current = adapter.budgetMs(engineRef.current);
    setRemaining(turnBudgetRef.current);
  }, [adapter]);

  // The countdown loop. Only runs once armed and alive.
  useEffect(() => {
    if (!armed || phase !== 'playing') return undefined;
    const tick = () => {
      const rem = turnBudgetRef.current - (now() - turnStartRef.current);
      if (rem <= 0) {
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
    const r = engineRef.current.submit(word);
    if (r.ok) {
      setReason('');
      setInput('');
      startTurnClock(); // the next turn's budget (new required letter / new fragment)
      rerender();
    } else {
      // Reject: the input is NEVER cleared and there is NO shake — the sill flashes and a
      // named reason prints, so the evidence of the attempt survives.
      setReason(rejectMessage(r.reason, adapter.rejectCtx(engineRef.current)));
      setSillKey((k) => k + 1);
    }
  }, [phase, input, adapter, startTurnClock, rerender]);

  const restart = useCallback(() => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    stopRaf();
    engineRef.current = createEngine();
    runIndexRef.current += 1;
    armedRef.current = false;
    turnBudgetRef.current = adapter.budgetMs(engineRef.current);
    setArmed(false);
    setInput('');
    setReason('');
    setRestartArmed(false);
    setRemaining(turnBudgetRef.current);
    setPhase('playing');
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
  };
}
