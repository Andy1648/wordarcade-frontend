// SatRushResults.jsx — the death / score reveal, as one retro-print PAGE (the
// part-1 language: --paper, double-ruled panels, ink + the off-register violet
// plate). Death still dominates entry: the DEAD stamp slams, the score + AVG ANTE
// count up on the shared JUICE.CELEBRATION timings (same staged sequence Category
// Blitz solo results use), then the rest of the page staggers in. AVG ANTE stays
// the headline. Once landed, nothing loops (quiet-by-default). ShareBar is kept
// working untouched; only its container is styled to sit on the page.
import { useEffect, useRef, useState } from 'react';
import { JUICE, prefersReducedMotion } from '../juice';
import * as juice from './juice';
import { ShareBar } from '../share';
import { satRushLink } from '../share/links.js';
import { SAT_RUSH_COLOR } from './config';

const C = JUICE.CELEBRATION;

// One runLog entry -> its film-strip frame. Special states keep a GLYPH mark, so
// clear/miss and deep/rev/silver read by shape + label, never colour alone.
function frameOf(e) {
  const glyph = e.silver ? '✦' : e.deepCut ? '◆' : e.revenant ? '↺' : e.ok ? '' : '✕';
  const kind = e.ok ? 'ok' : 'miss';
  const parts = [e.ok ? 'captured' : 'got away'];
  if (e.silver) parts.push('silver tongue');
  if (e.deepCut) parts.push('deep cut');
  if (e.revenant) parts.push('revenant');
  return { glyph, kind, label: parts.join(', ') };
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
  const anteHero = `${anteStr}×`;
  const scoreStr = String(score).padStart(6, '0');
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
      <div className="sr-respage">
        {/* entry stamp, bounty voice: the run is over — the case is closed. */}
        <div className="sr-dead">CASE CLOSED</div>

        {/* AVG ANTE — the headline stat: big Bungee ink with the violet plate off-register. */}
        <div className="sr-panel sr-hero">
          <div className="sr-ante-value sr-print" data-v={anteHero} aria-label={`average ante ${anteStr} times`}>
            {anteHero}
          </div>
          <div className="sr-panel-label">avg ante — how fast you knew them</div>
          {/* Words mastered (box ≥ 3) — the number that makes the mode legibly a
              study tool, sitting beside the ante. */}
          <div className="sr-mastered" aria-label={`${results.mastered || 0} words mastered`}>
            <b>{results.mastered || 0}</b> {results.mastered === 1 ? 'word' : 'words'} mastered
          </div>
        </div>

        {/* SCORE — zero-padded Bungee ink. */}
        <div className="sr-panel sr-scorepanel">
          <div className="sr-score-value">{scoreStr}</div>
          <div className="sr-panel-label">score</div>
        </div>

        {/* cleared / missed / best-streak — a ruled strip like the in-game HUD. */}
        <div className={`sr-resstrip${revealed ? ' in' : ''}`}>
          <div className="sr-hcell">
            <span className="sr-hlabel">cleared</span>
            <b className="sr-hval">{results.cleared}</b>
          </div>
          <div className="sr-hcell">
            <span className="sr-hlabel">missed</span>
            <b className="sr-hval">{results.missed}</b>
          </div>
          <div className="sr-hcell">
            <span className="sr-hlabel">best streak</span>
            <b className="sr-hval">{results.bestStreak}</b>
          </div>
        </div>

        {/* runLog film-strip: one small ruled frame per word, in order. */}
        {results.runLog.length > 0 && (
          <div className={`sr-filmstrip${revealed ? ' in' : ''}`} aria-label="run timeline">
            {results.runLog.map((e, i) => {
              const f = frameOf(e);
              return (
                <div key={i} className={`sr-frame ${f.kind}`} title={f.label} aria-label={f.label}>
                  <span aria-hidden="true">{f.glyph}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* hardest word — its own panel, sitting on the one halftone patch. */}
        {hardest && (
          <div className={`sr-panel sr-hardestpanel${revealed ? ' in' : ''}`}>
            <span className="sr-panel-label">hardest clear</span>
            <b className="sr-hardest-word">{hardest}</b>
          </div>
        )}

        <div className={`sr-results-actions${revealed ? ' in' : ''}`}>
          <div className="sr-share">
            <ShareBar
              mode="sat-rush"
              outcome={{ solo: true }}
              data={shareData}
              link={satRushLink()}
              neon={SAT_RUSH_COLOR}
            />
          </div>
          <button type="button" className="sr-btn" onClick={onAgain}>
            Run it back
          </button>
          <button type="button" className="sr-btn sr-btn-ghost" onClick={onExit}>
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
