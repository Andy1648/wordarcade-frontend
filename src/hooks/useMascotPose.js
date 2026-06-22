// useMascotPose.js
// Decides the Word Bomb mascot's pose from live game state. Priority order
// (first match wins):
//   1. game over + you won      -> celebrate (permanent)
//   2. game over + you lost     -> panic     (permanent)
//   3. opponent KO'd / lost a life (recent) -> taunt 1.5s
//   4. your correct word (recent)           -> celebrate 1s
//   5. your turn + timer < 30%  -> panic
//   6. your turn + timer >= 30% -> idle
//   7. not your turn            -> idle
// Timed overrides (3 & 4) are held by a short-lived `transient` state; the rest
// is derived each render.

import { useEffect, useRef, useState } from 'react';

export function useMascotPose(gameState, myId, timerSeconds, lastWordResult, gameOver) {
  const [transient, setTransient] = useState(null);
  const transientTimerRef = useRef(null);
  const prevLivesRef = useRef({});
  const prevResultRef = useRef(null);

  function flash(pose, ms) {
    if (transientTimerRef.current) clearTimeout(transientTimerRef.current);
    setTransient(pose);
    transientTimerRef.current = setTimeout(() => {
      setTransient(null);
      transientTimerRef.current = null;
    }, ms);
  }

  // Opponent lost a life / got eliminated -> taunt. (Diff lives vs last snapshot.)
  useEffect(() => {
    if (!gameState) return;
    const players = gameState.players || [];
    const prev = prevLivesRef.current;
    let opponentDown = false;
    players.forEach((p) => {
      const before = prev[p.id];
      if (
        typeof before === 'number' &&
        typeof p.lives === 'number' &&
        p.lives < before &&
        p.id !== myId
      ) {
        opponentDown = true;
      }
    });
    prevLivesRef.current = Object.fromEntries(players.map((p) => [p.id, p.lives]));
    if (opponentDown && !gameOver) flash('taunt', 1500);
    // flash is stable enough; only react to state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, myId, gameOver]);

  // Your own correct word -> celebrate. word_result (accepted) arrives before the
  // turn advances, so currentPlayerId is still the submitter here.
  useEffect(() => {
    if (!lastWordResult || lastWordResult === prevResultRef.current) return;
    prevResultRef.current = lastWordResult;
    if (
      lastWordResult.accepted &&
      gameState &&
      gameState.currentPlayerId === myId &&
      !gameOver
    ) {
      flash('celebrate', 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastWordResult, gameState, myId, gameOver]);

  // Tear down the pending timer on unmount.
  useEffect(() => {
    return () => {
      if (transientTimerRef.current) clearTimeout(transientTimerRef.current);
    };
  }, []);

  if (gameOver) return gameOver.winnerId === myId ? 'celebrate' : 'panic';
  if (transient) return transient;

  const isMyTurn = !!gameState && gameState.currentPlayerId === myId;
  if (isMyTurn) {
    const maxT = (gameState && gameState.timerSeconds) || 1;
    return timerSeconds / maxT < 0.3 ? 'panic' : 'idle';
  }
  return 'idle';
}
