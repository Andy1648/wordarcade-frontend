// useBeatSync.js
// Discrete drum-onset detection driving crisp one-shot pop animations.
//
// Drum hits are TRANSIENTS - a sudden jump in sub-bass energy - not just a high
// level (a sustained bass note is loud for many frames but never "jumps"). So we
// detect onsets by the frame-to-frame DELTA in the kick band (bins 0-2), not the
// absolute level or a running average. On an onset we flip data-beat="true" on
// <html> for 120ms (what CSS one-shot @keyframes key off of) and publish
// --beat-intensity for pop strength. A few continuous --beat-* vars remain for
// elements that still want smooth reaction.
//
// The loop only runs while `active` (music playing + unmuted); when it stops
// everything resets to neutral.

import { useEffect, useRef, useState } from 'react';

// Onset tuning.
const DELTA_THRESHOLD = 0.15; // sub-bass must JUMP this much in one frame
const MIN_ENERGY = 0.25; // ...and clear this floor, so quiet parts don't trigger
const COOLDOWN_MS = 150; // min gap between beats (no double-trigger per hit)
const BEAT_HOLD_MS = 120; // how long data-beat stays "true" per hit
// Slow decay of the observed max so --beat-intensity stays responsive after a
// one-off loud peak instead of being permanently scaled down.
const MAX_DECAY = 0.999;

const NEUTRAL = {
  '--beat-bass': '0',
  '--beat-mid': '0',
  '--beat-high': '0',
  '--beat-intensity': '0',
};

function applyNeutral(root) {
  for (const key in NEUTRAL) root.style.setProperty(key, NEUTRAL[key]);
  root.removeAttribute('data-beat');
}

export function useBeatSync(getFrequencyData, active) {
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [beatCount, setBeatCount] = useState(0);

  const rafRef = useRef(null);
  const prevKickRef = useRef(0); // last frame's kick energy (for the delta)
  const lastBeatRef = useRef(0); // perf timestamp of the last accepted beat
  const maxRef = useRef(MIN_ENERGY); // observed peak kick, for intensity scaling
  const holdTimerRef = useRef(null); // pending data-beat removal

  useEffect(() => {
    const root = document.documentElement;

    if (!active || typeof getFrequencyData !== 'function') {
      prevKickRef.current = 0;
      applyNeutral(root);
      setIsAnalysing(false);
      return undefined;
    }

    setIsAnalysing(true);

    const loop = () => {
      const data = getFrequencyData();
      const { bass, mid, high } = data;
      const kick = typeof data.kick === 'number' ? data.kick : bass;

      // Continuous vars (smooth reaction) for elements that want them.
      root.style.setProperty('--beat-bass', bass.toFixed(3));
      root.style.setProperty('--beat-mid', mid.toFixed(3));
      root.style.setProperty('--beat-high', high.toFixed(3));

      // Track a decaying observed max so intensity is relative to recent loudness.
      maxRef.current = Math.max(kick, maxRef.current * MAX_DECAY, MIN_ENERGY);

      // ---- Onset (transient) detection ----
      const delta = kick - prevKickRef.current;
      prevKickRef.current = kick;

      const now = performance.now();
      const isOnset = delta > DELTA_THRESHOLD && kick > MIN_ENERGY;
      if (isOnset && now - lastBeatRef.current > COOLDOWN_MS) {
        lastBeatRef.current = now;
        const intensity = Math.min(1, kick / maxRef.current);
        root.style.setProperty('--beat-intensity', intensity.toFixed(3));

        // Flip data-beat on for BEAT_HOLD_MS so CSS one-shot pops fire. Removing
        // and (next beat) re-adding the attribute restarts the animation.
        root.setAttribute('data-beat', 'true');
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        holdTimerRef.current = setTimeout(() => {
          root.removeAttribute('data-beat');
          holdTimerRef.current = null;
        }, BEAT_HOLD_MS);

        setBeatCount((c) => c + 1);
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      prevKickRef.current = 0;
      applyNeutral(root);
    };
  }, [getFrequencyData, active]);

  return { beatCount, isAnalysing };
}
