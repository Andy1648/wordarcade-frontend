// useBeatSync.js
// Reads live frequency data from the music player every animation frame and
// writes it to CSS custom properties on :root, so any element can react to the
// beat purely in CSS (e.g. transform: scale(var(--beat-scale))). Setting a few
// properties on documentElement once per frame is a single cheap DOM write; CSS
// does the rest, so JS never touches individual elements.
//
// The rAF loop only runs while `active` (music playing + unmuted). When it stops
// the variables are reset to neutral so animations settle smoothly.

import { useEffect, useRef, useState } from 'react';

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

export function useBeatSync(getFrequencyData, active) {
  const [isAnalysing, setIsAnalysing] = useState(false);
  const rafRef = useRef(null);

  useEffect(() => {
    const root = document.documentElement;

    if (!active || typeof getFrequencyData !== 'function') {
      applyNeutral(root);
      setIsAnalysing(false);
      return undefined;
    }

    setIsAnalysing(true);

    const loop = () => {
      const { bass, mid, high } = getFrequencyData();
      root.style.setProperty('--beat-bass', bass.toFixed(3));
      root.style.setProperty('--beat-mid', mid.toFixed(3));
      root.style.setProperty('--beat-high', high.toFixed(3));
      // Bass-driven pulse: scale up to +8% and a small upward jump on kicks.
      root.style.setProperty('--beat-scale', (1 + bass * 0.08).toFixed(3));
      root.style.setProperty('--beat-bounce', (bass * -8).toFixed(2));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      applyNeutral(root);
    };
  }, [getFrequencyData, active]);

  return { isAnalysing };
}
