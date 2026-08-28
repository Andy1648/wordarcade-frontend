// useXpCapture.js — the SHARED menu/splash XP capture. One place owns the rate limiter,
// the streak, the persisted xp store, and the pop/level-up/edge feedback, so the splash
// and the homepage credit identically (no forked logic). Keystrokes always credit; on a
// ANY pointer (mouse included), a click/tap on empty space credits too — both go
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
  progressOf,
  xpPerInput,
  getKeyTier,
} from './xp';
import { equippedPopMult, equippedSoundMult } from './shop';
import { playClack } from './clack';
import { loadRarityIndex, rarityOf } from './rarityIndex';
import { wpmStart, wpmAddWord, wpmEnd } from './wpmLive';

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
  const [progress, setProgress] = useState(() => progressOf(xpRef.current));
  const streakRef = useRef({ count: 0, lastTime: 0, tier: 0 });
  const blockedRef = useRef(isBlocked);
  const creditRef = useRef(onCredit);
  blockedRef.current = isBlocked;
  creditRef.current = onCredit;

  // Menu RARITY self-test: buffer the letters being typed and, when a word finishes (space /
  // Enter / any non-letter), score it — a rare real word pops "RARE ×2.5" in its tier colour,
  // turning idle menu typing into a vocabulary self-test. COMMON / non-words stay silent.
  const wordBufRef = useRef('');

  useEffect(() => {
    if (!active) return undefined;
    loadRarityIndex(); // warm the rank index so the menu self-test can score words
    wpmStart('menu'); // WPM: menu free-typing is its own self-test session
    const limiter = createRateLimiter({ capacity: 30, windowMs: 1000 });
    // The per-input XP from the single multiplier stack (menu mode), INCLUDING the equipped
    // cosmetic multipliers (pop style + sound pack). Stable for this menu session — equipping
    // and rebirth happen on another screen, which remounts this hook and re-reads them.
    const menuGain = xpPerInput({
      mode: 'menu',
      popMult: equippedPopMult(),
      soundMult: equippedSoundMult(),
    });
    // KEY POWER tier → the per-keystroke feel band the player BOUGHT (item 1). Mapped
    // to 0..5 (the 6 escalation bands: plain / teal / +shards / +shadow / +edge / gold).
    // Stable for this menu session (buying remounts this hook via the shop round-trip).
    const feelTier = Math.min(5, getKeyTier());

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
      const res = creditXp(xpRef.current, menuGain, isTap ? 0 : 1);
      xpRef.current = res.state;
      saveProgress(res.state);
      setProgress(progressOf(res.state));
      if (isTap) {
        tapsRef.current += 1;
        saveTaps(tapsRef.current);
      }

      // Level-ups no longer pay wins (Economy v3): wins come only from finishing rounds.
      // A level-up is still celebrated — it just no longer shows a "+N WINS" line.
      const fx = fxRef && fxRef.current;
      if (fx) {
        if (res.leveledUp) fx.celebrate(res.level);
        if (isTap) fx.tapPop(`+${menuGain}`, TIER_SCALES[tier], TIER_COLORS[tier], opts.x, opts.y);
        else fx.letterPop(opts.letter, `+${menuGain}`, TIER_SCALES[tier], TIER_COLORS[tier], feelTier);
        // Edge pulse stays on a streak-cross (the menu has no "words" to glow per —
        // T4's per-accepted-word edge glow lives in-game). Gold at KEY POWER T5+.
        if (crossed && tier > 0) fx.edgePulse(feelTier >= 5 ? '#FFD54A' : TIER_COLORS[tier]);
      }
      if (creditRef.current) creditRef.current();
    };

    // Score the buffered word and, if it's rare enough to announce (UNCOMMON+), pop its tier
    // label in the tier colour via the existing letter-pop pool (label as the text, no "+N").
    const MAX_WORD = 24;
    const finalizeWord = () => {
      const w = wordBufRef.current;
      wordBufRef.current = '';
      if (w.length < 2) return;
      // WPM: count every word typed toward the menu self-test's typing speed.
      wpmAddWord(w);
      const r = rarityOf(w);
      if (!r.announce) return; // COMMON / non-words stay silent (no pop)
      const fx = fxRef && fxRef.current;
      if (fx && fx.letterPop) fx.letterPop(r.label, '', 1.2, r.color, 0);
    };

    const onKey = (e) => {
      if (blockedRef.current && blockedRef.current()) return;
      // Menu self-test word buffer: accumulate letters, finalize on a word boundary. Runs
      // regardless of the anti-mash limiter below (which only gates the XP credit).
      const k = e.key;
      if (k && k.length === 1 && /^[a-z]$/i.test(k)) {
        if (wordBufRef.current.length < MAX_WORD) wordBufRef.current += k.toLowerCase();
      } else if (k === ' ' || k === 'Enter' || k === 'Tab' || k === '.' || k === ',') {
        finalizeWord();
      }
      if (!isCreditableKey(e)) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!limiter.tryConsume(now)) return; // over the anti-mash cap → silently dropped
      credit(now, { kind: 'key', letter: e.key.toUpperCase() });
    };
    window.addEventListener('keydown', onKey);

    // ---- Click / tap-to-earn: ANY pointer (desktop mouse included) ----
    // A click/tap on empty menu space credits exactly like a keystroke — feeding taw.taps
    // (never lifetimeLetters). All ignore rules stay: an interactive target (button/link/
    // card/dialog) or a >10px drag credits nothing.
    const pending = new Map(); // pointerId → { x, y, moved, ignore }
    const onDown = (e) => {
      const t = e.target;
      // A LOCKED (level-gated) card credits XP exactly like empty space — being locked must
      // not feel dead. Every other interactive target (buttons, links, UNLOCKED cards, open
      // dialogs) still credits nothing.
      const card = t && t.closest && t.closest('.game-card');
      const lockedCard = !!(card && card.classList.contains('locked'));
      const ignore =
        !lockedCard && !!(t && t.closest && (t.closest(INTERACTIVE) || t.closest('[role="dialog"]')));
      pending.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: false, ignore });
    };
    const onMove = (e) => {
      const p = pending.get(e.pointerId);
      if (!p) return;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_MOVE_TOLERANCE) p.moved = true;
    };
    const onUp = (e) => {
      const p = pending.get(e.pointerId);
      pending.delete(e.pointerId);
      if (!p || p.ignore || p.moved) return; // interactive target or a scroll → no credit
      if (blockedRef.current && blockedRef.current()) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!limiter.tryConsume(now)) return; // SAME limiter as keystrokes (multitouch shares it)
      credit(now, { kind: 'tap', x: p.x, y: p.y });
    };
    const onCancel = (e) => pending.delete(e.pointerId);
    // Capture phase so we always observe the gesture even if an app handler stops it.
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);

    return () => {
      finalizeWord(); // flush any half-typed word's WPM before the session ends
      wpmEnd(); // WPM: persist the menu self-test session on leave
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
    };
  }, [active, fxRef]);

  return { progress };
}
