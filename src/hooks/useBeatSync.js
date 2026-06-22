// useBeatSync.js
// Reads live frequency data from the music player every animation frame and
// writes it to CSS custom properties on :root, so any element can react to the
// beat purely in CSS. Setting a few properties on documentElement once per frame
// is a single cheap DOM write; CSS does the rest, so JS never touches elements.
//
// To make hits read CRISP rather than as soft bobbing, the raw band amplitude is
// run through an attack/release envelope: it SNAPS up to a new peak instantly
// (attack) then decays fast (release). The result punches on each kick and falls
// away quickly, instead of smoothly tracking the amplitude.
//
// The rAF loop only runs while `active` (music playing + unmuted). When it stops
// the variables reset to neutral so animations settle.

import { useEffect, useRef, useState } from 'react';

// Per-frame release multiplier: lower = snappier decay (more staccato). At 60fps
// ~0.80 decays a hit to ~10% in roughly 170ms.
const RELEASE = 0.8;

// Neutral resting values - chosen so var(--x, fallback) consumers sit still.
const NEUTRAL = {
  '--beat-bass': '0',
  '--beat-mid': '0',
  '--beat-high': '0',
  '--beat-scale': '1',
  '--beat-bounce': '0',
};

function applyNeutral(root) {
  for (const key in NEUTRAL) root.style.setProperty(key, NEUTRAL[key]);
}

// Envelope follower: instant attack to a higher value, exponential release down.
function envelope(prev, value) {
  return value > prev ? value : prev * RELEASE;
}

export function useBeatSync(getFrequencyData, active) {
  const [isAnalysing, setIsAnalysing] = useState(false);
  const rafRef = useRef(null);
  const bassEnvRef = useRef(0);
  const midEnvRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;

    if (!active || typeof getFrequencyData !== 'function') {
      bassEnvRef.current = 0;
      midEnvRef.current = 0;
      applyNeutral(root);
      setIsAnalysing(false);
      return undefined;
    }

    setIsAnalysing(true);

    const loop = () => {
      const { bass, mid, high } = getFrequencyData();

      // Snap-and-decay envelopes so the motion punches on hits, not bobs.
      const b = envelope(bassEnvRef.current, bass);
      const m = envelope(midEnvRef.current, mid);
      bassEnvRef.current = b;
      midEnvRef.current = m;

      root.style.setProperty('--beat-bass', b.toFixed(3));
      root.style.setProperty('--beat-mid', m.toFixed(3));
      root.style.setProperty('--beat-high', high.toFixed(3));
      // Punchy bass-driven pulse: a strong scale pop + a sharp upward jump.
      root.style.setProperty('--beat-scale', (1 + b * 0.16).toFixed(3));
      root.style.setProperty('--beat-bounce', (b * -18).toFixed(2));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      bassEnvRef.current = 0;
      midEnvRef.current = 0;
      applyNeutral(root);
    };
  }, [getFrequencyData, active]);

  return { isAnalysing };
}
