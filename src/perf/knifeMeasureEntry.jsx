// knifeMeasureEntry.jsx — MEASUREMENT HARNESS ONLY (perf/knife-measure branch).
// Mounts the REAL KnifeSplit component in isolation over a black background so the
// intro->menu slash chain can be replayed on demand and measured under CPU throttle.
// Imports the shipping component verbatim — it changes NO product code or timing.
//
// NOT wired into the app, NOT in any build input, NOT imported by src. Served only
// via /knife-measure.html on the dev server. No StrictMode (double-invoke would fire
// the KnifeSplit effect's setTimeout chain twice).
import { createRoot } from 'react-dom/client';
import { useState, useCallback } from 'react';
import KnifeSplit from '../components/KnifeSplit.jsx';

function Harness() {
  const [runId, setRunId] = useState(0);
  const [playing, setPlaying] = useState(false);

  const onComplete = useCallback(() => {
    if (window.__knife) window.__knife.done = true;
    setPlaying(false);
  }, []);

  // Driven from the Playwright harness: reset the done flag, remount KnifeSplit
  // (fresh key => fresh mount => fresh chain) and let it play once.
  window.__replayKnife = () => {
    window.__knife = { done: false };
    setRunId((k) => k + 1);
    setPlaying(true);
  };
  // So the harness can confirm the reduced-motion skip: KnifeSplit returns null
  // under reduce, so nothing with .knife-split ever mounts.
  window.__knifeMounted = playing;

  return playing ? (
    <KnifeSplit key={runId} onComplete={onComplete} onSlash={() => {}} onOpen={() => {}} />
  ) : null;
}

window.__knife = { done: false };
createRoot(document.getElementById('root')).render(<Harness />);
