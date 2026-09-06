// useScreenShake.js — the app-wide screen-shake concern extracted from App.jsx (refactor/app-split-6).
// PURE refactor: the shake state + triggerShake helper + the beat-driven light-shake effect, moved
// verbatim. App-wide screen shake at three intensities (light=beat, medium=accept, heavy=explosion/
// game over). A class on the top-level wrapper; cleared after the shake duration so it can replay.
// Takes the live `view` + `beatCount`; returns `{ shake, triggerShake }`. The caller still fires
// triggerShake from its own effects/handlers (defeat sting, knife-split, GameScreen onShake).
import { useState, useRef, useEffect } from 'react';

export function useScreenShake({ view, beatCount }) {
  const [shake, setShake] = useState(null);
  const shakeTimerRef = useRef(null);
  const SHAKE_MS = { light: 100, medium: 200, heavy: 300 };
  function triggerShake(level) {
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    setShake(level);
    shakeTimerRef.current = setTimeout(
      () => setShake(null),
      SHAKE_MS[level] || 150
    );
  }
  // Light shake on every detected beat — IN-GAME ONLY. The ambient whole-screen
  // beat-shake made the menu/lobby feel busy and laggy (it transforms the entire
  // app tree on every drum hit), so it's now gated to the game view; the menu
  // stays calm. `view` is in the deps so the guard reads the live view, not a
  // stale closure (a view change alone never has a new beat, so it won't shake).
  const prevBeatRef = useRef(0);
  useEffect(() => {
    if (beatCount > prevBeatRef.current) {
      prevBeatRef.current = beatCount;
      if (view === 'game') triggerShake('light');
    }
    // triggerShake is stable enough; we react to beatCount (and read live view).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatCount, view]);

  return { shake, triggerShake };
}
