// WinnerPopup.jsx — H4 (Andy oct3): "a big WINNER popup animation with the amount counting up."
//
// Shown ONLY to the winner of a multiplayer match (Word Bomb, Category Blitz, WORD RACE), on the
// game-over screen, by the screen that owns it — a pointer-events:none layer absolutely placed
// inside that screen's own overlay/panel, never a new position:fixed element, so it can never
// block REMATCH / LEAVE or collide with the corner nav.
//
// MOTION: ONE finite pop-in (transform/opacity), the number counted up by a short rAF that only
// WRITES text (no layout reads), a hold, ONE finite fade-out, then it unmounts. Nothing loops.
// REDUCED MOTION: no animation at all — a static card with the final amount, removed after the
// same hold.
//
// Lazy-loaded (lazyWithReload) by GameScreen + WordRaceScreen, so it costs nothing until a win.
import { useEffect, useRef, useState } from 'react';
import { formatNum } from '../format';
import './WinnerPopup.css';

const COUNT_MS = 900;
const HOLD_MS = 3600; // pop-in + count + a beat to read it; the fade-out starts here

function reducedMotion() {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** @param {{ pay: { wins:number, mult:number, tier:string, note:string|null } }} props */
export default function WinnerPopup({ pay }) {
  const [reduce] = useState(reducedMotion);
  const [phase, setPhase] = useState('in'); // 'in' → 'out' → 'gone'
  const numRef = useRef(null);
  const wins = pay && pay.wins > 0 ? Math.round(pay.wins) : 0;

  // Count up 0 → wins (ease-out). Writes textContent only; the final value is also what React
  // renders, so a skipped/aborted rAF still leaves the right number on screen.
  useEffect(() => {
    if (reduce || !wins || typeof requestAnimationFrame !== 'function') return undefined;
    const el = numRef.current;
    let raf = 0;
    let t0 = 0;
    const step = (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / COUNT_MS);
      const eased = 1 - Math.pow(1 - k, 3);
      if (el) el.textContent = `+${formatNum(Math.round(wins * eased))}`;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    if (el) el.textContent = '+0';
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      if (el) el.textContent = `+${formatNum(wins)}`;
    };
  }, [wins, reduce]);

  // The hold. With motion the fade-out is a CSS animation whose end unmounts; reduced motion just
  // unmounts at the same moment.
  useEffect(() => {
    const id = setTimeout(() => setPhase(reduce ? 'gone' : 'out'), HOLD_MS);
    return () => clearTimeout(id);
  }, [reduce]);

  if (!pay || phase === 'gone') return null;

  // The bonus is a multiple of the game's own wins, so the caption names the TOTAL multiplier.
  const caption = wins > 0 ? `YOUR GAME ×${formatMult(pay.mult)}` : 'NO MATCH BONUS';

  return (
    <div className="winner-pop-layer" aria-hidden={phase === 'out' ? 'true' : undefined}>
      <div
        className={`winner-pop${reduce ? ' is-static' : ''}${phase === 'out' ? ' is-out' : ''}`}
        role="status"
        data-winner-pop={pay.tier}
        data-winner-wins={wins}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget && phase === 'out') setPhase('gone');
        }}
      >
        <div className="winner-pop-title">WINNER</div>
        {wins > 0 && (
          <div className="winner-pop-amount">
            <span ref={numRef}>+{formatNum(wins)}</span> WINS
          </div>
        )}
        <div className="winner-pop-caption">{caption}</div>
        {pay.note && <div className="winner-pop-note">{pay.note}</div>}
      </div>
    </div>
  );
}

function formatMult(m) {
  if (!Number.isFinite(m)) return '1';
  const r = Math.round(m * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
