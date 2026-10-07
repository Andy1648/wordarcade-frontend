// wb/BombHudV2.jsx — the pieces of the v2 Word Bomb HUD (claude/mockups/v2/BombHUD.dc.html, SEASON2-QUEUE 9c) that the
// existing board does not already have. The board itself (the bomb, the fragment on its belly, players on a RING,
// hearts, the input) is GameScreen's; under SEASON2 it wears the v2 skin (BombHudV2.css, [data-hud="v2"]).
//
//   <WbFuseRing ratio seconds critical />  40 fuse segments round the bomb, lit = the time left (one SVG, no motion
//                                           per segment — a re-render per timer_tick, not per frame) + the seconds.
//   <WbAlphabet used={Set} />               the A–Z row: the letters YOUR accepted words have used this game, n/26.
//                                           (No bonus life is claimed: the server has no alphabet rule — see the PR.)
//   <LearnCard word combo ms onDone />      PAUSE TO LEARN: "NEXT TIME: SING" for ~2 s after YOUR turn blows up — an
//                                           edge card in the bottom cluster, pointer-events:none, one finite slide.
import { useEffect, useRef } from 'react';
import { kitPlay } from '../kit/motion.js';
import { formatNum } from '../../format';
import './BombHudV2.css';

const NSEG = 40;
const R = 130;
const C = 160;
function arc(a0, a1) {
  const r = Math.PI / 180;
  const x0 = C + R * Math.cos(a0 * r);
  const y0 = C + R * Math.sin(a0 * r);
  const x1 = C + R * Math.cos(a1 * r);
  const y1 = C + R * Math.sin(a1 * r);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
const SEGS = Array.from({ length: NSEG }, (_, i) => {
  const a0 = -90 + i * (360 / NSEG) + 1.3;
  return arc(a0, a0 + 360 / NSEG - 2.6);
});

/** PURE: the set of A–Z letters a list of words uses. */
export function lettersUsed(words) {
  const out = new Set();
  for (const w of words || []) for (const ch of String(w || '').toUpperCase()) if (ch >= 'A' && ch <= 'Z') out.add(ch);
  return out;
}

/** PURE: how many of the 40 fuse segments are lit for a 0..1 time ratio (a started turn always shows one). */
export function litSegments(ratio) {
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  return r <= 0 ? 0 : Math.max(1, Math.ceil(r * NSEG));
}

export function WbFuseRing({ ratio = 1, seconds, critical = false }) {
  const lit = litSegments(ratio);
  return (
    <div className={`wb-v2-fuse${critical ? ' is-critical' : ''}`} aria-hidden="true" data-lit={lit}>
      <svg viewBox="0 0 320 320" focusable="false">
        <circle cx={C} cy={C} r={R} fill="none" stroke="#000" strokeWidth="26" />
        {SEGS.map((d, i) => (
          <path key={i} d={d} fill="none" strokeWidth="16" strokeLinecap="butt" className={i < lit ? 'is-on' : 'is-off'} />
        ))}
      </svg>
      {typeof seconds === 'number' ? <span className="wb-v2-secs" translate="no">{formatNum(Math.max(0, seconds))}</span> : null}
    </div>
  );
}

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export function WbAlphabet({ used }) {
  const set = used instanceof Set ? used : new Set();
  return (
    <div className="wb-v2-abc" aria-label={`Letters used ${set.size} of 26`}>
      {ABC.map((ch) => (
        <span key={ch} className={`wb-v2-abc-l${set.has(ch) ? ' is-on' : ''}`} aria-hidden="true">{ch}</span>
      ))}
      <span className="wb-v2-abc-n">{formatNum(set.size)}/26</span>
    </div>
  );
}

const IN = [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'translateY(-4px)', opacity: 1, offset: 0.7 }, { transform: 'translateY(0)', opacity: 1 }];

export function LearnCard({ word, combo, ms = 2000, onDone }) {
  const ref = useRef(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    kitPlay(ref.current, IN, { duration: 260, easing: 'cubic-bezier(.2,1.2,.4,1)' });
    const t = setTimeout(() => done.current && done.current(), ms);
    return () => clearTimeout(t);
  }, [ms]);
  const w = String(word || '').toUpperCase();
  const c = String(combo || '').toUpperCase();
  const at = c ? w.indexOf(c) : -1;
  return (
    <div ref={ref} className="wb-learn" role="status" data-word={w}>
      <span className="wb-learn-k">NEXT TIME:</span>
      <span className="wb-learn-w" translate="no">
        {at >= 0 ? (
          <>
            {w.slice(0, at)}
            <b>{w.slice(at, at + c.length)}</b>
            {w.slice(at + c.length)}
          </>
        ) : w}
      </span>
    </div>
  );
}
