// FeelLadder.jsx — the in-game ESCALATION LADDER's visible parts (next-passes-spec PASS 2, V2
// "ARCADE"). Shared by Word Bomb, Category Blitz, CHAIN and FUSE (SAT RUSH takes only the LV chip
// and the ladder's cue pitch — its retro-print page stays quiet by design).
//
//   TierSlam     ONE pre-mounted node per screen. When the combo count crosses 2 / 4 / 7 / 10 it
//                replays a WAAPI slam on that same node (320ms in, 500ms hold, 200ms out) + one
//                tier-coloured screen flash + a stinger. Outranked by a clutch / lucky / rare word
//                (effectSlot.js) it says its label as a small TAG instead.
//   LuckyBurst   the gold ring + "LUCKY ×5" for Word Bomb / Blitz (the solo modes have their own).
//   SlotTags     the outranked effects of a word, as one >=13px tag line under it.
//   LevelUpChip  a mid-game level crossed: a small finite "LV n" punch + chime.
//
// BUDGET (CLAUDE.md): every animation here is FINITE and transform/opacity only; the slam and its
// tag are pooled (one node each, replayed — never a node per event); will-change is set only while
// an animation plays and cleared on finish; nothing reads layout. Reduced motion: the slam is an
// opacity-only label and there is no flash; the CSS one-shots resolve instantly.
import { useEffect, useRef, useState } from 'react';
import { screenFlash, tierStinger, levelChime } from '../juice';
import { reduced } from '../juice/settings';
import { LADDER, SLAM_MS, SLAM_TOTAL_MS, tierCrossed, slamLabel } from '../juice/ladder';
import { onMidGameLevelUp } from '../progress/levelUpSignal';
import './FeelLadder.css';

const TAG_MS = 1200;

/**
 * Compute a value ONCE per `key` and hold it until the key changes. The light-slot decision is made
 * for a word when it lands and must not be re-made by later, unrelated state changes (a reject
 * clearing a flag, a combo break) — that would mount a word's effect late. Pure ref bookkeeping, no
 * effects, no layout.
 */
export function useLatched(key, compute) {
  const ref = useRef(null);
  if (!ref.current || ref.current.key !== key) ref.current = { key, value: compute() };
  return ref.current.value;
}

function playOn(node, frames, duration, onEnd) {
  if (!node || typeof node.animate !== 'function') return null;
  if (typeof node.getAnimations === 'function') node.getAnimations().forEach((a) => a.cancel());
  node.style.willChange = 'transform, opacity';
  const a = node.animate(frames, { duration, easing: 'ease-out', fill: 'none' });
  const done = () => {
    node.style.willChange = '';
    if (onEnd) onEnd();
  };
  a.onfinish = done;
  a.oncancel = done;
  return a;
}

// Reduced motion: no animation at all — the node is shown (a style write) and hidden again after
// `ms`. One timer per node, replaced on replay.
function showStatic(node, ms, onEnd) {
  if (!node) return;
  if (node.__tawStatic) clearTimeout(node.__tawStatic);
  node.style.opacity = '1';
  node.__tawStatic = setTimeout(() => {
    node.__tawStatic = 0;
    node.style.opacity = '';
    if (onEnd) onEnd();
  }, ms);
}

/** The slam's keyframes for a tier: scale 0.6 -> 1.12 -> 1, opacity 0 -> 1 -> 0. Exported for tests. */
export function slamFrames(reduce) {
  const pIn = SLAM_MS.in / SLAM_TOTAL_MS;
  const pHold = (SLAM_MS.in + SLAM_MS.hold) / SLAM_TOTAL_MS;
  if (reduce) {
    // Opacity-only label: the state still reads, nothing moves.
    return [
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: pIn },
      { opacity: 1, offset: pHold },
      { opacity: 0, offset: 1 },
    ];
  }
  const base = 'translate(-50%, -50%) rotate(-4deg)';
  return [
    { transform: `${base} scale(0.6)`, opacity: 0, offset: 0 },
    { transform: `${base} scale(1.12)`, opacity: 1, offset: pIn * 0.7 },
    { transform: `${base} scale(1)`, opacity: 1, offset: pIn },
    { transform: `${base} scale(1)`, opacity: 1, offset: pHold },
    { transform: `${base} scale(1)`, opacity: 0, offset: 1 },
  ];
}

const TAG_FRAMES = [
  { opacity: 0, offset: 0 },
  { opacity: 1, offset: 0.12 },
  { opacity: 1, offset: 0.8 },
  { opacity: 0, offset: 1 },
];

/**
 * @param {number}  count      the live combo count (the same number the ComboMeter shows)
 * @param {boolean} outranked  a higher-priority effect owns this word -> say the tier as a tag
 * @param {boolean} flash      fire the tier-up screen flash (default true)
 */
export function TierSlam({ count = 0, outranked = false, flash = true }) {
  const slamRef = useRef(null);
  const tagRef = useRef(null);
  const prevRef = useRef(count);
  const outrankedRef = useRef(outranked);
  outrankedRef.current = outranked;

  // Unmount: drop any reduced-motion hide timer (the WAAPI animations die with their nodes).
  useEffect(() => {
    const nodes = [slamRef.current, tagRef.current];
    return () => nodes.forEach((n) => n && n.__tawStatic && clearTimeout(n.__tawStatic));
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = count;
    const t = tierCrossed(prev, count);
    if (!t) return; // no crossing (a step inside a tier, a break, a reset): nothing fires
    const label = slamLabel(t);
    tierStinger(t);
    const reduce = reduced();
    if (outrankedRef.current) {
      const tag = tagRef.current;
      if (tag) {
        tag.textContent = label;
        if (reduce) showStatic(tag, TAG_MS);
        else playOn(tag, TAG_FRAMES, TAG_MS);
      }
      return;
    }
    const node = slamRef.current;
    if (!node) return;
    // Pure writes: the label, the tier colour, and a flag on the slot that hides its hype word
    // while the slam owns it (one thing in the slot at a time).
    node.firstChild.textContent = label;
    node.setAttribute('data-tier', String(t));
    const host = node.parentElement;
    if (host) host.setAttribute('data-slam', '');
    const release = () => {
      if (host) host.removeAttribute('data-slam');
    };
    // Reduced motion: the label is shown STATIC for the slam's length — no motion, no flash.
    if (reduce) showStatic(node, SLAM_TOTAL_MS, release);
    else playOn(node, slamFrames(false), SLAM_TOTAL_MS, release);
    if (flash && !reduce) screenFlash({ alpha: LADDER[t].flash, color: LADDER[t].edge, life: 0.2 });
  }, [count, flash]);

  return (
    <>
      <div ref={slamRef} className="tier-slam" data-tier="1" aria-hidden="true">
        <span className="tier-slam-label" />
      </div>
      <div ref={tagRef} className="fx-tags tier-slam-tag" aria-hidden="true" />
    </>
  );
}

/** Word Bomb / Blitz LUCKY: a finite gold ring + stamp. Re-key per lucky word to replay. Visual juice
 *  only — Rebirth Rush pays no lucky multiplier, so the stamp names no "×N". (`mult` accepted, unused.) */
// eslint-disable-next-line no-unused-vars
export function LuckyBurst({ mult = 5 }) {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <span className="fx-lucky" aria-hidden="true">
      <span className="fx-lucky-ring" />
      <span className="fx-lucky-label" onAnimationEnd={() => setDone(true)}>
        LUCKY!
      </span>
    </span>
  );
}

/** The outranked effects of one word, as one small tag line. Re-key per word. */
export function SlotTags({ labels }) {
  const [done, setDone] = useState(false);
  if (done || !labels || !labels.length) return null;
  return (
    <div className="fx-tags fx-tags--word" onAnimationEnd={() => setDone(true)} aria-hidden="true">
      {labels.join(' · ')}
    </div>
  );
}

/**
 * Mid-game LEVEL-UP: hears progress/levelUpSignal (emitted by awardWordXp for a game word that
 * crossed a level) and punches a small "LV n" chip — LIGHT, the full celebration waits for the
 * menu. Renders nothing until a level is crossed while it is mounted; unmounts after its one-shot.
 */
export function LevelUpChip({ variant = '' }) {
  const [lv, setLv] = useState(null); // { level, key }
  useEffect(
    () =>
      onMidGameLevelUp(({ level }) => {
        if (!Number.isFinite(level)) return;
        levelChime();
        setLv((p) => ({ level, key: (p ? p.key : 0) + 1 }));
      }),
    []
  );
  if (!lv) return null;
  return (
    <span
      key={lv.key}
      className={`fx-lvchip${variant ? ` fx-lvchip--${variant}` : ''}`}
      onAnimationEnd={(e) => {
        if (e.animationName === 'fx-lvchip-out' || e.animationName === 'fx-hold') setLv(null);
      }}
      aria-hidden="true"
    >
      LV {lv.level} ↑
    </span>
  );
}
