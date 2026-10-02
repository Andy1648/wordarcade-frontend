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
// @keyframes key off of) and publish --beat-intensity for pop strength. Beats are
// entirely DISCRETE now — no continuous per-frame :root vars — so nothing writes
// document-wide style off the animation loop.
//
// The loop only runs while `active` (music playing + unmuted); when it stops
// everything resets to neutral.

import { useEffect, useRef, useState } from 'react';

// Onset tuning.
const HISTORY_FRAMES = 43; // ~0.7s local window for the adaptive threshold
const SENSITIVITY = 2.2; // current flux must exceed local-average flux * this
// (lower = more sensitive / more beats; higher = only the strongest onsets)
const MIN_FLUX = 0.025; // floor so quiet/steady passages don't false-trigger
const COOLDOWN_MS = 130; // min gap between beats (no double-trigger per hit)
const BEAT_HOLD_MS = 120; // how long data-beat stays "true" per hit

// The whole-viewport screen flash is pink on every beat (was a random palette
// pick, which read as a multicolour strobe). [TUNABLE: for slight variety, pick
// from a pink-biased array each beat, e.g. ['#ff4fa3','#ff4fa3','#ff4fa3','#2EFFE0'].]
const FLASH_COLOR = '#FF2EC4';

const NEUTRAL = {
  '--beat-intensity': '0',
};

function applyNeutral(root) {
  for (const key in NEUTRAL) root.style.setProperty(key, NEUTRAL[key]);
  root.removeAttribute('data-beat');
}

// STEP 59 (measured at 4x CPU throttle, 1280x720 menu while typing): with music on, the menu ran
// 93 frames / 2.6 s and 1.09 s of style recalc; muted, 139 frames and 0.32 s. Two costs per beat:
//   1. `setBeatCount` re-rendered the WHOLE App on every beat (App only used it to shake in-game).
//      Beats are now delivered through `onBeatRef` — a ref the caller points at its handler — so a
//      beat costs no React render unless the handler itself sets state.
//   2. Two custom properties written on <html> every beat. A custom property on the root is
//      inherited, so each write re-resolves EVERY element's style: measured, dropping the per-beat
//      --beat-intensity write alone took the menu from ~93 to 125 frames / 2.6 s and halved style
//      recalc (1.1 s -> 0.64 s). Both are now written ONCE when the music starts: --flash-color
//      never changed, and --beat-intensity is a constant 1 (every pop at full strength) — the
//      per-hit strength was not worth a document-wide restyle four times a second.
export function useBeatSync(getFrequencyData, active, onBeatRef = null) {
  const [isAnalysing, setIsAnalysing] = useState(false);

  const rafRef = useRef(null);
  const fluxHistRef = useRef([]); // recent flux readings (max HISTORY_FRAMES)
  const lastBeatRef = useRef(0); // perf timestamp of the last accepted beat
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
    // Pink wash for the whole-viewport screen flash (same colour every beat) — written once.
    root.style.setProperty('--flash-color', FLASH_COLOR);
    root.style.setProperty('--beat-intensity', '1');

    const loop = () => {
      const data = getFrequencyData();
      const flux = typeof data.flux === 'number' ? data.flux : 0;

      // No per-frame :root custom-property write. --beat-mid used to be published
      // here every frame for the combo prompt's music breathe, but a var-dependent
      // transform can't be composited and each write invalidated document-wide
      // style against the whole stylesheet at 60fps — the biggest in-game jank
      // source. The prompt's per-beat reaction now runs entirely off the discrete
      // data-beat class + the once-per-beat --beat-intensity below.

      // ---- Spectral-flux onset detection vs an adaptive local threshold ----
      const hist = fluxHistRef.current;
      const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;

      const now = performance.now();
      const isOnset = flux > MIN_FLUX && flux > avg * SENSITIVITY;
      if (isOnset && now - lastBeatRef.current > COOLDOWN_MS) {
        lastBeatRef.current = now;

        // Flip data-beat on for BEAT_HOLD_MS so CSS one-shot pops fire. Removing
        // and (next beat) re-adding the attribute restarts the animation.
        root.setAttribute('data-beat', 'true');
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        holdTimerRef.current = setTimeout(() => {
          root.removeAttribute('data-beat');
          holdTimerRef.current = null;
        }, BEAT_HOLD_MS);

        if (onBeatRef && typeof onBeatRef.current === 'function') onBeatRef.current();
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
  }, [getFrequencyData, active, onBeatRef]);

  return { isAnalysing };
}
