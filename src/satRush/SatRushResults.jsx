// SatRushResults.jsx — the death / score reveal. Reuses the shared juice
// primitives and the JUICE.CELEBRATION timings (the same staged sequence the
// Category Blitz solo results use): entrance -> DEAD stamp slam -> score count-up
// with pitched ticks -> staggered stat reveal. AVG ANTE is the headline (bigger
// than raw score — it's the one number that says "I knew these fast"). Ends with
// the shared ShareBar (image card + QR + PostHog attribution).
import { useEffect, useRef, useState } from 'react';
import { JUICE, prefersReducedMotion } from '../juice';
import * as juice from './juice';
import { ShareBar } from '../share';
import { SAT_RUSH_COLOR } from './config';

const C = JUICE.CELEBRATION;

function ExitLink({ onExit }) {
  if (!onExit) return null;
  return (
    <button
      type="button"
      onClick={onExit}
      style={{ background: 'none', border: 'none', boxShadow: 'none', opacity: 0.5, fontWeight: 400 }}
    >
      exit
    </button>
  );
}

export default function SatRushResults({ results, onAgain, onExit }) {
  const finalScore = results.score || 0;
  const finalAnte = results.avgAnte ?? 0;
  const [score, setScore] = useState(0);
  const [ante, setAnte] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const raf = useRef(0);
  const timers = useRef([]);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    // Audio sting fires either way (sound ≠ motion).
    if (reduced) {
      setScore(finalScore);
      setAnte(finalAnte);
      setRevealed(true);
      juice.resultsSting();
      return undefined;
    }

    const add = (fn, ms) => timers.current.push(setTimeout(fn, ms));

    add(() => juice.resultsStamp(), C.stampDelay); // DEAD slam
    add(() => {
      juice.resultsSting(); // descending defeat tone
      const t0 = performance.now();
      let lastTick = 0;
      const step = (now) => {
        const p = Math.min(1, (now - t0) / C.countMs);
        const eased = 1 - Math.pow(1 - p, 3);
        const s = Math.round(finalScore * eased);
        setScore(s);
        setAnte(+(finalAnte * eased).toFixed(1));
        if (s - lastTick >= C.score.tickEvery) {
          lastTick = s;
          juice.scoreTick(p);
        }
        if (p < 1) raf.current = requestAnimationFrame(step);
        else {
          setScore(finalScore);
          setAnte(finalAnte);
          setRevealed(true);
          if (results.bestStreak >= 5) juice.resultsBest(); // a hot run earns a sparkle
        }
      };
      raf.current = requestAnimationFrame(step);
    }, C.scoreDelay);

    return () => {
      cancelAnimationFrame(raf.current);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // Run once on mount; results is fixed for a finished run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anteStr = finalAnte ? ante.toFixed(1) : '—';
  const hardest = results.hardestWord ? results.hardestWord.word.toUpperCase() : null;

  const shareData = {
    score: finalScore,
    cleared: results.cleared,
    bestStreak: results.bestStreak,
    avgAnte: finalAnte,
    hardest: results.hardestWord ? results.hardestWord.word : null,
    runLog: results.runLog,
  };

  return (
    <div className="sr-screen sr-results">
      <div className="sr-dead">DEAD</div>

      {/* AVG ANTE — the headline stat, biggest thing on the screen. */}
      <div className="sr-ante-hero">
        <div className="sr-ante-value" style={{ color: SAT_RUSH_COLOR }}>
          {anteStr}×
        </div>
        <div className="sr-ante-label">avg ante — how fast you knew them</div>
      </div>

      {/* Secondary stats. */}
      <div className={`sr-resstats${revealed ? ' in' : ''}`}>
        <div className="sr-stat">
          <b>{score}</b>
          <span>score</span>
        </div>
        <div className="sr-stat">
          <b>{results.cleared}</b>
          <span>cleared</span>
        </div>
        <div className="sr-stat">
          <b>{results.bestStreak}</b>
          <span>best streak</span>
        </div>
      </div>

      {hardest && (
        <div className={`sr-hardest${revealed ? ' in' : ''}`}>
          hardest clear — <b style={{ color: SAT_RUSH_COLOR }}>{hardest}</b>
        </div>
      )}

      <div className={`sr-results-actions${revealed ? ' in' : ''}`}>
        <ShareBar mode="sat-rush" outcome={{ solo: true }} data={shareData} neon={SAT_RUSH_COLOR} />
        <button type="button" className="sr-btn" onClick={onAgain}>
          Again
        </button>
        <ExitLink onExit={onExit} />
      </div>
    </div>
  );
}
