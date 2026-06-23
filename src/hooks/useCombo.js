// useCombo.js
// A PURELY CLIENT-SIDE, PER-LOCAL-PLAYER hype streak. It tracks the local
// player's consecutive accepted answers and exposes escalating feedback hooks.
//
// IMPORTANT: this reads NOTHING from the server and writes NOTHING back. It does
// not touch scoring, points, win conditions, timers, or any WebSocket message -
// callers simply call hit() / miss() / reset() from the accept / reject /
// life-loss / round-boundary events that ALREADY exist in their component. The
// streak is local cosmetic + audio state only; who wins never changes.
import { useCallback, useRef, useState } from 'react';
import { useSound } from '../contexts/SoundContext';

export function useCombo() {
  const { sound } = useSound();
  const [count, setCount] = useState(0);
  // Break info: bumping `key` re-keys the shatter animation so it replays; `count`
  // is the streak length that was just lost (so the shatter can show "×N LOST").
  const [brk, setBrk] = useState({ key: 0, count: 0 });
  // Synchronous source of truth (count mirrors it for render), so rapid hits
  // can't race the async setState.
  const ref = useRef(0);

  // A successful answer extends the streak; the blip climbs in pitch with it.
  const hit = useCallback(() => {
    const n = ref.current + 1;
    ref.current = n;
    setCount(n);
    sound.combo?.(n);
  }, [sound]);

  // A real miss (reject / timeout / life lost) ends the streak: reset + a shatter
  // and break sound, but only if there was an actual streak (>= 2) to lose.
  const miss = useCallback(() => {
    const had = ref.current;
    ref.current = 0;
    setCount(0);
    if (had >= 2) {
      sound.comboBreak?.();
      setBrk((b) => ({ key: b.key + 1, count: had }));
    }
  }, [sound]);

  // A silent reset at a round / game boundary: no shatter, no sound.
  const reset = useCallback(() => {
    ref.current = 0;
    setCount(0);
  }, []);

  return { count, brk, hit, miss, reset };
}
