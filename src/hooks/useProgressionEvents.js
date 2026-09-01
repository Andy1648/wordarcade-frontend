// useProgressionEvents.js — the Daily-Challenge state extracted from App.jsx (refactor/app-split
// step 3). PURE refactor: the three daily state slices + the ref-mirror effect, moved verbatim.
//
// Scope note: the plan also grouped "menu XP/wins/rebirth celebration consumption" here, but that
// work is the per-word awardWordXp/bankWordWins calls INSIDE the WS drain (word_result/answer_result
// handlers) — it is drain logic and moves with useGameSocket (step 4), not separable now. So this
// step is the daily concern only. No params: the hook owns state + its own sync effect; the drain
// (still in App), goHome, and handleLeaveRequest/handleStartDaily call the returned setters and read
// the returned dailyStateRef — all unchanged.
import { useState, useRef, useEffect } from 'react';
import { loadDailyState } from '../daily/streak.js';

export function useProgressionEvents() {
  // Whether the CURRENT game is today's daily challenge (drives the leave-confirm + results copy).
  const [isDailyGame, setIsDailyGame] = useState(false);
  // dailyState: the persisted streak history (localStorage). dailyResult: the just-finished daily's
  // { dayNumber, streak, bestStreak, score } for the results screen + share text; null otherwise.
  const [dailyState, setDailyState] = useState(() => loadDailyState());
  const [dailyResult, setDailyResult] = useState(null);
  // dailyStateRef mirrors dailyState for the WS drain (keyed only on [messages], so reading the
  // state there would be stale — same pattern as the other drain mirror refs).
  const dailyStateRef = useRef(dailyState);
  useEffect(() => {
    dailyStateRef.current = dailyState;
  }, [dailyState]);

  return {
    isDailyGame,
    setIsDailyGame,
    dailyState,
    setDailyState,
    dailyResult,
    setDailyResult,
    dailyStateRef,
  };
}
