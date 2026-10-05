// KitPityBar.jsx — 02 PITY METER (claude/mockups/v2/KitBars.dc.html).
//
//   <KitPityBar left={37} total={50} label="EPIC+" hit={hit} sub={{ label: 'LEGENDARY+', left: 412, total: 500 }} />
//
// "EPIC+ IN 37": a big countdown numeral (bumps on every change), ten segments that fill by scaleX
// (300 ms overshoot), a diamond cap that lights as it gets close, and an optional thin secondary
// meter. NEAR (≤ nearAt left): the numeral turns lilac, the unfilled segments outline lilac and pulse
// ONCE per roll, the cap throbs as it arrives — the mockup loops these; the kit plays them per event.
// `hit` slams "{label} HIT" over the panel.
import { useEffect, useRef } from 'react';
import { FX, fx } from './motion.js';
import { formatNum } from '../../format.js';
import './tokens.css';
import './KitPityBar.css';

const clamp01 = (f) => Math.max(0, Math.min(1, f));

export function KitPityBar({ left = 50, total = 50, label = 'EPIC+', segments = 10, nearAt = 10, hit = false, sub, className }) {
  const numRef = useRef(null);
  const capRef = useRef(null);
  const segRefs = useRef([]);
  const hitRef = useRef(null);
  const prev = useRef({ left, near: false });
  const done = total - left;
  const near = left <= nearAt && !hit;
  const per = total / segments;

  useEffect(() => {
    const p = prev.current;
    if (p.left !== left) {
      fx(numRef.current, FX.barBump);
      if (near) segRefs.current.forEach((el, i) => {
        if (el && clamp01((done - i * per) / per) < 1) fx(el, FX.pulse(1));
      });
    }
    if (near && !p.near) fx(capRef.current, FX.throb(3));
    prev.current = { left, near };
  }, [left, near, done, per]);
  useEffect(() => {
    if (hit) fx(hitRef.current, FX.slamBig);
  }, [hit]);

  const capFill = hit || left === 0 ? 'var(--k-purple)' : near ? 'var(--k-plum)' : 'var(--k-panel-deep)';
  const capStar = hit ? 'var(--k-yellow)' : near ? 'var(--k-lilac)' : 'var(--k-rule)';
  const subDone = sub ? sub.total - sub.left : 0;
  return (
    <div className={`kpy${near ? ' is-near' : ''}${className ? ` ${className}` : ''}`}>
      <div className="kpy-count">
        <span className="kpy-label">{label} IN</span>
        <span ref={numRef} className="kpy-num">{formatNum(left)}</span>
        <span className="kpy-done">
          {formatNum(done)} / {formatNum(total)} ROLLS
        </span>
      </div>
      <div className="kpy-right">
        <div className="kpy-segs" role="meter" aria-label={`${label} in ${left}`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          {Array.from({ length: segments }, (_, i) => {
            const f = clamp01((done - i * per) / per);
            return (
              <div key={i} ref={(el) => { segRefs.current[i] = el; }} className={`kpy-seg${near && f < 1 ? ' is-hot' : ''}`}>
                <div className="kpy-seg-fill" style={{ transform: `scaleX(${f})` }}>
                  <div className="kpy-seg-hi" />
                  <div className="kpy-seg-lo" />
                </div>
              </div>
            );
          })}
          <div ref={capRef} className="kpy-cap">
            <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
              <path d="M26 3 L49 26 L26 49 L3 26 Z" fill={capFill} stroke="#000" strokeWidth="5" strokeLinejoin="round" />
              <path d="M26 13 L29.5 22 L39 22.5 L31.5 28.5 L34 38 L26 32.5 L18 38 L20.5 28.5 L13 22.5 L22.5 22 Z" fill={capStar} stroke="#000" strokeWidth="2.5" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        {sub ? (
          <div className="kpy-sub">
            <div className="kpy-sub-head">
              <span className="kpy-sub-l">
                {sub.label} IN <span className="kpy-sub-n">{formatNum(sub.left)}</span>
              </span>
              <span className="kpy-sub-r">
                {formatNum(subDone)} / {formatNum(sub.total)}
              </span>
            </div>
            <div className="kpy-sub-bar">
              <div className="kpy-sub-fill" style={{ transform: `scaleX(${clamp01(subDone / sub.total)})` }}>
                <div className="kpy-sub-lo" />
              </div>
              <div className="kpy-sub-ticks" />
            </div>
          </div>
        ) : null}
      </div>
      {hit && (
        <div className="kpy-hit" aria-live="assertive">
          <span ref={hitRef} className="kpy-hit-t">{label} HIT</span>
        </div>
      )}
    </div>
  );
}
