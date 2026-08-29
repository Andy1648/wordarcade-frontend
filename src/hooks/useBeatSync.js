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

import { useEffect, useRef } from 'react';

// Onset tuning.
const HISTORY_FRAMES = 43; // ~0.7s local window for the adaptive threshold
const SENSITIVITY = 2.2; // current flux must exceed local-average flux * this
// (lower = more sensitive / more beats; higher = only the strongest onsets)
const MIN_FLUX = 0.025; // floor so quiet/steady passages don't false-trigger
const COOLDOWN_MS = 130; // min gap between beats (no double-trigger per hit)
const BEAT_HOLD_MS = 120; // how long data-beat stays "true" per hit
// Slow decay of the observed max flux so --beat-intensity stays responsive.
const MAX_DECAY = 0.999;

// The whole-viewport screen flash is pink on every beat (was a random palette
// pick, which read as a multicolour strobe). [TUNABLE: for slight variety, pick
// from a pink-biased array each beat, e.g. ['#FF2EC4','#FF2EC4','#FF2EC4','#2EFFE0'].]
const FLASH_COLOR = '#FF2EC4';

const NEUTRAL = {
  '--beat-intensity': '0',
};

function applyNeutral(root) {
  for (const key in NEUTRAL) root.style.setProperty(key, NEUTRAL[key]);
  root.removeAttribute('data-beat');
}

// `onBeat` is fired (at most once per detected beat) INSTEAD of bumping React state.
// The hook holds NO state, so it NEVER re-renders its host: the beat's visual reaction is
// entirely the DOM writes below (data-beat / --beat-intensity on <html>, which the menu title
// pop + frame glow and the in-game pulses key off), and any React-side reaction (e.g. the
// in-game screen shake) is the host's business, done in its onBeat handler. This is deliberate:
// the previous version bumped a `beatCount` state ~1-2x/sec while music played, re-rendering the
// WHOLE App (and every child) on every drum hit even on the menu/shop where nothing consumed it —
// churn that remounted/repeated child work and caused shipped bugs. onBeat is read through a ref
// so passing a fresh closure each render never re-subscribes the analysis loop.
export function useBeatSync(getFrequencyData, active, onBeat) {
  const rafRef = useRef(null);
  const fluxHistRef = useRef([]); // recent flux readings (max HISTORY_FRAMES)
  const lastBeatRef = useRef(0); // perf timestamp of the last accepted beat
  const maxFluxRef = useRef(MIN_FLUX); // observed peak flux, for intensity
  const holdTimerRef = useRef(null); // pending data-beat removal
  // Latest onBeat, so the rAF loop calls the current handler without the effect depending on
  // (and thus re-subscribing to) a new callback identity each render.
  const onBeatRef = useRef(onBeat);
  onBeatRef.current = onBeat;

  useEffect(() => {
    const root = document.documentElement;

    if (!active || typeof getFrequencyData !== 'function') {
      fluxHistRef.current = [];
      applyNeutral(root);
      return undefined;
    }

    const loop = () => {
      const data = getFrequencyData();
      const flux = typeof data.flux === 'number' ? data.flux : 0;

      // No per-frame :root custom-property write. --beat-mid used to be published
      // here every frame for the combo prompt's music breathe, but a var-dependent
      // transform can't be composited and each write invalidated document-wide
      // style against the whole stylesheet at 60fps — the biggest in-game jank
      // source. The prompt's per-beat reaction now runs entirely off the discrete
      // data-beat class + the once-per-beat --beat-intensity below.

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
        // Pink wash for the whole-viewport screen flash (same colour every beat).
        root.style.setProperty('--flash-color', FLASH_COLOR);

        // Flip data-beat on for BEAT_HOLD_MS so CSS one-shot pops fire. Removing
        // and (next beat) re-adding the attribute restarts the animation.
        root.setAttribute('data-beat', 'true');
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        holdTimerRef.current = setTimeout(() => {
          root.removeAttribute('data-beat');
          holdTimerRef.current = null;
        }, BEAT_HOLD_MS);

        // Fire the host's per-beat reaction (e.g. in-game shake). No React state here.
        if (typeof onBeatRef.current === 'function') onBeatRef.current();
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
}
