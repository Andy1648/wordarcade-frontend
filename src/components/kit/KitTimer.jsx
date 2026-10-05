// KitTimer.jsx — 03 TIMERS (claude/mockups/v2/KitBars.dc.html): "URGENT < 30S".
//
// KitTimerRing  the RESTOCK ring: a tick ring, a hand that sweeps, mm:ss in the middle; slams
//               "RESTOCKED" when it rolls over.
// KitTimerBar   the BOOST bar: a chip (×2 WINS), mm:ss, a ticked bar; "EXPIRED" at 0.
// KitTimerChip  the compact LUCK chip: label + time on a draining fill.
//
// All three take `remaining` and `total` in SECONDS (the caller ticks them). A one-second tick glides
// (1 s linear); a jump (skip / reset) eases in 350 ms; a roll-over snaps. Under 30 s they go hot pink
// and pulse once per tick; the ring also rattles each tick under 10 s. The mockup loops the throb /
// pulse / shake while urgent; the kit plays one beat per TICK instead (the tick is the event).
// Fills are scaleX; the ring's hand is a rotate. REDUCE MOTION: no glide, no beat.
import { useEffect, useRef, useState } from 'react';
import { FX, fx } from './motion.js';
import './tokens.css';
import './KitTimer.css';

export const URGENT_S = 30;
const RING_C = 364.42;

export function mmss(s) {
  const t = Math.max(0, Math.ceil(Number.isFinite(s) ? s : 0));
  const m = Math.floor(t / 60);
  const r = t % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

/** The transition to use for this tick: glide / jump / snap. */
function useTickMode(remaining) {
  const prev = useRef(remaining);
  const d = remaining - prev.current;
  let mode = 'glide';
  if (d > 1.5) mode = 'snap'; // rolled over / reset upward: never sweep backwards
  else if (d < -1.5) mode = 'jump';
  useEffect(() => {
    prev.current = remaining;
  }, [remaining]);
  return mode;
}

function useUrgentBeat(remaining, urgent, ref, shakeRef) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!urgent) return;
    fx(ref.current, FX.throb(1));
    if (shakeRef && remaining < 10) fx(shakeRef.current, FX.tickShake);
  }, [remaining, urgent, ref, shakeRef]);
}

export function KitTimerRing({ remaining, total, label = 'RESTOCK', doneLabel = 'RESTOCKED', className }) {
  const f = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const urgent = remaining > 0 && remaining < URGENT_S;
  const mode = useTickMode(remaining);
  const numRef = useRef(null);
  const wrapRef = useRef(null);
  const slamRef = useRef(null);
  const [restocked, setRestocked] = useState(0);
  const prev = useRef(remaining);
  useEffect(() => {
    if (remaining > prev.current + 1.5 && prev.current <= 1) setRestocked((n) => n + 1);
    prev.current = remaining;
  }, [remaining]);
  const [showDone, setShowDone] = useState(false);
  useEffect(() => {
    if (!restocked) return undefined;
    setShowDone(true);
    const t = setTimeout(() => setShowDone(false), 2000);
    return () => clearTimeout(t);
  }, [restocked]);
  useEffect(() => {
    if (showDone) fx(slamRef.current, FX.slamBig);
  }, [showDone, restocked]);
  useUrgentBeat(remaining, urgent, numRef, wrapRef);
  return (
    <div ref={wrapRef} className={`ktr is-${mode}${urgent ? ' is-urgent' : ''}${className ? ` ${className}` : ''}`} role="timer" aria-label={`${label} in ${mmss(remaining)}`}>
      <svg width="156" height="156" viewBox="0 0 156 156" aria-hidden="true" focusable="false">
        <circle cx="78" cy="78" r="58" fill="#12071f" stroke="#000" strokeWidth="26" />
        <circle cx="78" cy="78" r="58" fill="none" stroke="#2a1745" strokeWidth="16" />
        <circle className="ktr-arc" cx="78" cy="78" r="58" fill="none" strokeWidth="16" strokeDasharray={RING_C} strokeDashoffset={(RING_C * (1 - f)).toFixed(2)} transform="rotate(-90 78 78)" />
        <circle cx="78" cy="78" r="58" fill="none" stroke="#000" strokeWidth="18" strokeDasharray="3 27.37" transform="rotate(-91 78 78)" />
      </svg>
      {/* the hand is its own HTML-level layer: an SVG <g> transform cannot run on the compositor */}
      <svg className="ktr-hand" width="156" height="156" viewBox="0 0 156 156" aria-hidden="true" focusable="false" style={{ transform: `rotate(${(f * 360).toFixed(2)}deg)` }}>
        <rect x="72" y="8" width="12" height="28" fill="#fff" stroke="#000" strokeWidth="3.5" />
      </svg>
      <div className="ktr-mid">
        <span ref={numRef} className="ktr-num">{mmss(remaining)}</span>
        <span className="ktr-lab">{label}</span>
      </div>
      {showDone && (
        <span ref={slamRef} className="ktr-done">
          {doneLabel}
        </span>
      )}
    </div>
  );
}

const BOLT = (
  <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true" focusable="false">
    <path d="M8 1 L1 10 L6 10 L5 17 L13 7 L8 7 Z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export function KitTimerBar({ remaining, total, chip = '×2 WINS', label = 'BOOST', expiredLabel = 'EXPIRED', marks, className }) {
  const f = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const urgent = remaining > 0 && remaining < URGENT_S;
  const out = remaining <= 0;
  const mode = useTickMode(remaining);
  const numRef = useRef(null);
  useUrgentBeat(remaining, urgent, numRef, null);
  const m = marks || ['0', mmss(total / 2), mmss(total)];
  return (
    <div className={`ktb is-${mode}${urgent ? ' is-urgent' : ''}${out ? ' is-out' : ''}${className ? ` ${className}` : ''}`} role="timer" aria-label={`${chip} ${label}: ${out ? expiredLabel : mmss(remaining)}`}>
      <div className="ktb-head">
        <div className="ktb-left">
          <span className="ktb-chip">
            {BOLT}
            {chip}
          </span>
          <span className="ktb-lab">{label}</span>
        </div>
        <span ref={numRef} className="ktb-num">{out ? expiredLabel : mmss(remaining)}</span>
      </div>
      <div className="ktb-bar">
        <div className="ktb-fill" style={{ transform: `scaleX(${f.toFixed(4)})` }}>
          <div className="ktb-hi" />
          <div className="ktb-lo" />
        </div>
        <div className="ktb-ticks" />
      </div>
      <div className="ktb-marks" aria-hidden="true">
        {m.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export function KitTimerChip({ remaining, total, label = 'LUCK ×1.5', note, className }) {
  const f = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const urgent = remaining > 0 && remaining < URGENT_S;
  const mode = useTickMode(remaining);
  const chipRef = useRef(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (urgent) fx(chipRef.current, FX.pulse(1));
  }, [remaining, urgent]);
  return (
    <div className={`ktc-row${className ? ` ${className}` : ''}`}>
      <div ref={chipRef} className={`ktc is-${mode}${urgent ? ' is-urgent' : ''}`} role="timer" aria-label={`${label}: ${mmss(remaining)}`}>
        <div className="ktc-fill" style={{ transform: `scaleX(${f.toFixed(4)})` }} />
        <div className="ktc-text">
          <span>{label}</span>
          <span>{mmss(remaining)}</span>
        </div>
      </div>
      {note !== null && <span className="ktc-note">{note || (urgent ? 'URGENT' : 'COMPACT')}</span>}
    </div>
  );
}
