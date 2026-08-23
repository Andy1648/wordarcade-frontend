// useXpCapture.js — the SHARED menu/splash keystroke → XP capture. One place owns the
// rate limiter, the streak, the persisted xp store, and the pop/level-up/edge feedback, so
// the splash and the homepage credit identically (no forked logic). Mount it with the fx
// layer's ref; it wires a window keydown listener while `active`.
import { useEffect, useRef, useState } from 'react';
import {
  loadProgress,
  saveProgress,
  creditXp,
  createRateLimiter,
  isCreditableKey,
  levelFromXp,
  XP_MULTIPLIERS,
} from './xp';
import { playClack } from './clack';

// Streak tier → letter-pop scale (transform only) and colour. Index 0..3 (tiers at 10/25/50).
export const TIER_SCALES = [1.0, 1.15, 1.3, 1.45];
export const TIER_COLORS = ['#2EFFE0', '#FFE94A', '#FF6B3D', '#FF2EC4'];

/**
 * @param {object} opts
 * @param {{current: any}} opts.fxRef  MenuXpFx imperative handle (letterPop/edgePulse/celebrate).
 * @param {boolean} [opts.active]      attach the listener while true (default true).
 * @param {() => boolean} [opts.isBlocked]  return true to ignore keys (e.g. a dialog is open).
 * @param {(e: KeyboardEvent) => void} [opts.onCredit]  fired after each CREDITED keystroke
 *   (the splash uses it to dismiss on the first credit).
 */
export function useXpCapture({ fxRef, active = true, isBlocked, onCredit } = {}) {
  const xpRef = useRef(null);
  if (xpRef.current === null) xpRef.current = loadProgress();
  const [xpTotal, setXpTotal] = useState(xpRef.current.xp);
  const streakRef = useRef({ count: 0, lastTime: 0, tier: 0 });
  // Keep the latest callbacks reachable from the once-bound listener.
  const blockedRef = useRef(isBlocked);
  const creditRef = useRef(onCredit);
  blockedRef.current = isBlocked;
  creditRef.current = onCredit;

  useEffect(() => {
    if (!active) return undefined;
    const limiter = createRateLimiter({ capacity: 30, windowMs: 1000 });
    const onKey = (e) => {
      if (blockedRef.current && blockedRef.current()) return;
      if (!isCreditableKey(e)) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!limiter.tryConsume(now)) return; // over the anti-mash cap → silently dropped

      // Streak: reset if the gap since the last credit exceeded 1200ms.
      const st = streakRef.current;
      if (now - st.lastTime > 1200) {
        st.count = 0;
        st.tier = 0;
      }
      st.count += 1;
      st.lastTime = now;
      const tier = st.count >= 50 ? 3 : st.count >= 25 ? 2 : st.count >= 10 ? 1 : 0;
      const crossed = tier > st.tier;
      st.tier = tier;

      // First keydown is a user gesture → this lazily creates/resumes the AudioContext.
      playClack(st.count - 1);
      const res = creditXp(xpRef.current, XP_MULTIPLIERS.menu, 1);
      xpRef.current = res.state;
      saveProgress(res.state);
      setXpTotal(res.state.xp);

      const fx = fxRef && fxRef.current;
      if (fx) {
        if (res.leveledUp) fx.celebrate(res.level);
        // ONE combined pop per keystroke: "[LETTER] [+N]". Letter is tier-scaled/coloured.
        fx.letterPop(e.key.toUpperCase(), `+${XP_MULTIPLIERS.menu}`, TIER_SCALES[tier], TIER_COLORS[tier]);
        if (crossed && tier > 0) fx.edgePulse(TIER_COLORS[tier]);
      }
      if (creditRef.current) creditRef.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, fxRef]);

  return { xpTotal, progress: levelFromXp(xpTotal) };
}
