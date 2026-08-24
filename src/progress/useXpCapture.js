// useXpCapture.js — the SHARED menu/splash XP capture. One place owns the rate limiter,
// the streak, the persisted xp store, and the pop/level-up/edge feedback, so the splash
// and the homepage credit identically (no forked logic). Keystrokes always credit; on a
// COARSE pointer, taps on empty space credit too (touch-only tap-to-earn) — both go
// through the SAME limiter and the SAME streak. Mount with the fx layer's ref.
import { useEffect, useRef, useState } from 'react';
import {
  loadProgress,
  saveProgress,
  getTaps,
  saveTaps,
  creditXp,
  createRateLimiter,
  isCreditableKey,
  levelFromXp,
  XP_MULTIPLIERS,
} from './xp';
import { playClack } from './clack';

// Streak tier → pop scale (transform only) and colour. Index 0..3 (tiers at 10/25/50).
export const TIER_SCALES = [1.0, 1.15, 1.3, 1.45];
export const TIER_COLORS = ['#2EFFE0', '#FFE94A', '#FF6B3D', '#FF2EC4'];

// A tap is ignored when it lands on (or inside) any of these — they're doing something
// else. `.game-card` and open dialogs included; matched with closest().
const INTERACTIVE = 'button, a, input, textarea, select, [role="button"], .game-card';
const TAP_MOVE_TOLERANCE = 10; // px — beyond this the pointerdown was a scroll, not a tap

export function useXpCapture({ fxRef, active = true, isBlocked, onCredit } = {}) {
  const xpRef = useRef(null);
  if (xpRef.current === null) xpRef.current = loadProgress();
  const tapsRef = useRef(null);
  if (tapsRef.current === null) tapsRef.current = getTaps();
  const [xpTotal, setXpTotal] = useState(xpRef.current.xp);
  const streakRef = useRef({ count: 0, lastTime: 0, tier: 0 });
  const blockedRef = useRef(isBlocked);
  const creditRef = useRef(onCredit);
  blockedRef.current = isBlocked;
  creditRef.current = onCredit;

  useEffect(() => {
    if (!active) return undefined;
    const limiter = createRateLimiter({ capacity: 30, windowMs: 1000 });

    // Shared credit path for a keystroke OR a tap. `kind` is 'key' | 'tap'; a tap credits
    // xp but NOT lifetimeLetters (rawKeys 0) and bumps taw.taps instead; its pop is the
    // "+N" alone at the tap coordinates.
    const credit = (now, opts) => {
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

      playClack(st.count - 1); // creates/resumes the AudioContext inside this gesture
      const isTap = opts.kind === 'tap';
      const res = creditXp(xpRef.current, XP_MULTIPLIERS.menu, isTap ? 0 : 1);
      xpRef.current = res.state;
      saveProgress(res.state);
      setXpTotal(res.state.xp);
      if (isTap) {
        tapsRef.current += 1;
        saveTaps(tapsRef.current);
      }

      const fx = fxRef && fxRef.current;
      if (fx) {
        if (res.leveledUp) fx.celebrate(res.level);
        if (isTap) fx.tapPop(`+${XP_MULTIPLIERS.menu}`, TIER_SCALES[tier], TIER_COLORS[tier], opts.x, opts.y);
        else fx.letterPop(opts.letter, `+${XP_MULTIPLIERS.menu}`, TIER_SCALES[tier], TIER_COLORS[tier]);
        if (crossed && tier > 0) fx.edgePulse(TIER_COLORS[tier]);
      }
      if (creditRef.current) creditRef.current();
    };

    const onKey = (e) => {
      if (blockedRef.current && blockedRef.current()) return;
      if (!isCreditableKey(e)) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!limiter.tryConsume(now)) return; // over the anti-mash cap → silently dropped
      credit(now, { kind: 'key', letter: e.key.toUpperCase() });
    };
    window.addEventListener('keydown', onKey);

    // ---- Tap-to-earn: COARSE pointer only (desktop mouse credits nothing) ----
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    let onDown;
    let onMove;
    let onUp;
    let onCancel;
    if (coarse) {
      const pending = new Map(); // pointerId → { x, y, moved, ignore }
      onDown = (e) => {
        if (e.pointerType === 'mouse') return; // never credit a mouse, even on a coarse device
        const t = e.target;
        const ignore = !!(t && t.closest && (t.closest(INTERACTIVE) || t.closest('[role="dialog"]')));
        pending.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: false, ignore });
      };
      onMove = (e) => {
        const p = pending.get(e.pointerId);
        if (!p) return;
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_MOVE_TOLERANCE) p.moved = true;
      };
      onUp = (e) => {
        const p = pending.get(e.pointerId);
        pending.delete(e.pointerId);
        if (!p || p.ignore || p.moved) return; // interactive target or a scroll → no credit
        if (blockedRef.current && blockedRef.current()) return;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (!limiter.tryConsume(now)) return; // SAME limiter as keystrokes (multitouch shares it)
        credit(now, { kind: 'tap', x: p.x, y: p.y });
      };
      onCancel = (e) => pending.delete(e.pointerId);
      // Capture phase so we always observe the gesture even if an app handler stops it.
      window.addEventListener('pointerdown', onDown, true);
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onCancel, true);
    }

    return () => {
      window.removeEventListener('keydown', onKey);
      if (coarse) {
        window.removeEventListener('pointerdown', onDown, true);
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('pointercancel', onCancel, true);
      }
    };
  }, [active, fxRef]);

  return { xpTotal, progress: levelFromXp(xpTotal) };
}
