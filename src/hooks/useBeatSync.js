// useBeatSync.js
// Discrete BEAT DETECTION driving crisp one-shot pop animations, plus a few
// continuous CSS vars for elements that still want a smooth reaction.
//
// Every animation frame we read the bass energy and compare it to a short
// running average. A sudden spike above that average (a kick/snare) fires a
// discrete "beat": we flip data-beat="true" on <html> for 120ms, which is what
// CSS one-shot @keyframes animations key off of (html[data-beat="true"] .x).
// --beat-intensity says how hard the hit was so pops scale with it.
//
// This replaces the old continuous-amplitude approach, which read as smooth
// floaty motion rather than punchy hits. The loop only runs while `active`
// (music playing + unmuted); when it stops everything resets to neutral.

import { useEffect, useRef, useState } from 'react';

// Detection tuning.
const HISTORY_FRAMES = 15; // running-average window
const BEAT_FACTOR = 1.4; // current must exceed avg * this to count as a beat
const MIN_ENERGY = 0.3; // floor so quiet passages don't false-trigger
const COOLDOWN_MS = 150; // min gap between beats (no double-triggers per hit)
const BEAT_HOLD_MS = 120; // how long data-beat stays "true" per hit
// Slow decay of the observed max so --beat-intensity stays responsive after a
// one-off loud peak instead of being permanently scaled down.
const MAX_DECAY = 0.999;

const NEUTRAL = {
  '--beat-bass': '0',
  '--beat-mid': '0',
  '--beat-high': '0',
  '--beat-bounce': '0',
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
  const historyRef = useRef([]); // recent bass energies (max HISTORY_FRAMES)
  const lastBeatRef = useRef(0); // perf timestamp of the last accepted beat
  const maxRef = useRef(MIN_ENERGY); // observed peak bass, for intensity scaling
  const holdTimerRef = useRef(null); // pending data-beat removal

  useEffect(() => {
    const root = document.documentElement;

    if (!active || typeof getFrequencyData !== 'function') {
      historyRef.current = [];
      applyNeutral(root);
      setIsAnalysing(false);
      return undefined;
    }

    setIsAnalysing(true);

    const loop = () => {
      const { bass, mid, high } = getFrequencyData();

      // Continuous vars (smooth reaction) - still useful for subtle elements.
      root.style.setProperty('--beat-bass', bass.toFixed(3));
      root.style.setProperty('--beat-mid', mid.toFixed(3));
      root.style.setProperty('--beat-high', high.toFixed(3));
      root.style.setProperty('--beat-bounce', (bass * -18).toFixed(2));

      // Track a decaying observed max so intensity is relative to recent loudness.
      maxRef.current = Math.max(bass, maxRef.current * MAX_DECAY, MIN_ENERGY);

      // Running average of the last HISTORY_FRAMES bass readings.
      const hist = historyRef.current;
      const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;

      // ---- Beat detection ----
      const now = performance.now();
      const isSpike = bass > avg * BEAT_FACTOR && bass > MIN_ENERGY;
      if (isSpike && now - lastBeatRef.current > COOLDOWN_MS) {
        lastBeatRef.current = now;
        const intensity = Math.min(1, bass / maxRef.current);
        root.style.setProperty('--beat-intensity', intensity.toFixed(3));

        // Flip data-beat on for BEAT_HOLD_MS so CSS one-shot pops fire. Removing
        // and (next beat) re-adding the attribute is what restarts the animation.
        root.setAttribute('data-beat', 'true');
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        holdTimerRef.current = setTimeout(() => {
          root.removeAttribute('data-beat');
          holdTimerRef.current = null;
        }, BEAT_HOLD_MS);

        setBeatCount((c) => c + 1);
      }

      // Push current reading into the running-average window.
      hist.push(bass);
      if (hist.length > HISTORY_FRAMES) hist.shift();

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
      historyRef.current = [];
      applyNeutral(root);
    };
  }, [getFrequencyData, active]);

  return { beatCount, isAnalysing };
}
