// useBeatSync.js
// Discrete beat detection driving crisp one-shot pop animations.
//
// Detecting "the beat" reliably means catching percussive ONSETS - the moment a
// kick/snare hits - across the spectrum, not just a single band's level. A pure
// sub-bass level/delta catches bass-note changes and misses snares, which reads
// as out-of-sync. So we use SPECTRAL FLUX (the per-frame sum of positive energy
// increases across the low-mid range, computed in useMusicPlayer) compared to an
// ADAPTIVE local threshold: a beat fires when the current flux clearly exceeds
// the recent average flux. This is the standard onset-detection approach and
// tracks the drum pulse rather than melody.
//
// On a beat we flip data-beat="true" on <html> for 120ms (what CSS one-shot
// @keyframes key off of) and publish --beat-intensity for pop strength. A few
// continuous --beat-* vars remain for elements that want a smooth reaction.
//
// The loop only runs while `active` (music playing + unmuted); when it stops
// everything resets to neutral.

import { useEffect, useRef, useState } from 'react';

// Onset tuning.
const HISTORY_FRAMES = 43; // ~0.7s local window for the adaptive threshold
const SENSITIVITY = 1.7; // current flux must exceed local-average flux * this
// (lower = more sensitive / more beats; higher = only the strongest onsets)
const MIN_FLUX = 0.025; // floor so quiet/steady passages don't false-trigger
const COOLDOWN_MS = 130; // min gap between beats (no double-trigger per hit)
const BEAT_HOLD_MS = 120; // how long data-beat stays "true" per hit
// Slow decay of the observed max flux so --beat-intensity stays responsive.
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
  const fluxHistRef = useRef([]); // recent flux readings (max HISTORY_FRAMES)
  const lastBeatRef = useRef(0); // perf timestamp of the last accepted beat
  const maxFluxRef = useRef(MIN_FLUX); // observed peak flux, for intensity
  const holdTimerRef = useRef(null); // pending data-beat removal

  useEffect(() => {
    const root = document.documentElement;

    if (!active || typeof getFrequencyData !== 'function') {
      fluxHistRef.current = [];
      applyNeutral(root);
      setIsAnalysing(false);
      return undefined;
    }

    setIsAnalysing(true);

    const loop = () => {
      const data = getFrequencyData();
      const { bass, mid, high } = data;
      const flux = typeof data.flux === 'number' ? data.flux : 0;

      // Continuous vars (smooth reaction) for elements that want them.
      root.style.setProperty('--beat-bass', bass.toFixed(3));
      root.style.setProperty('--beat-mid', mid.toFixed(3));
      root.style.setProperty('--beat-high', high.toFixed(3));

      // Track a decaying observed max flux so intensity is relative to recent hits.
      maxFluxRef.current = Math.max(flux, maxFluxRef.current * MAX_DECAY, MIN_FLUX);

      // ---- Spectral-flux onset detection vs an adaptive local threshold ----
      const hist = fluxHistRef.current;
      const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;

      const now = performance.now();
      const isOnset = flux > MIN_FLUX && flux > avg * SENSITIVITY;
      if (isOnset && now - lastBeatRef.current > COOLDOWN_MS) {
        lastBeatRef.current = now;
        const intensity = Math.min(1, flux / maxFluxRef.current);
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

      // Push current flux into the running-average window.
      hist.push(flux);
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
      fluxHistRef.current = [];
      applyNeutral(root);
    };
  }, [getFrequencyData, active]);

  return { beatCount, isAnalysing };
}
