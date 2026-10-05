// useReduceMotion — React view of src/lib/reduceMotion.js. Re-renders when the in-game REDUCE MOTION
// toggle flips, so a mount-time motion gate (cursor parallax, magnetic pull, roll reveal) follows it live.
import { useSyncExternalStore } from 'react';
import { reduceMotion, onReduceMotionChange } from './reduceMotion';

export function useReduceMotion() {
  return useSyncExternalStore(onReduceMotionChange, reduceMotion, () => false);
}
