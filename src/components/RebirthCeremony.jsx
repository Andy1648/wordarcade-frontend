// RebirthCeremony — BB1 (Andy oct2): the rebirth as a ceremony that SHOWS what was kept and what was
// reset, with the player's real numbers — not three lines of rules. ONE big thing: the new
// multiplier. Under it, one RESET row (the level falls to 1, or to the HEAD START level) and the
// KEPT rows, each stamped in with a check, so "I lose everything" is visibly false.
//
// Finite and transform/opacity only (the animation budget): a slam-in, the level strike, a staggered
// stamp per kept row, one confetti volley from the pooled juice particles. Reduced motion shows the
// same card static. The player leaves with CONTINUE (44px) or Escape (ShopScreen's handler).
import { useEffect, useRef } from 'react';
import { formatNum, formatMult } from '../format';
import { burst } from '../juice';
import './RebirthCeremony.css';

/**
 * @param c  { rc, mult, stars, fromLevel, toLevel, fromKey, toKey, kept: [{ label, value }] }
 *           toKey = the KEY tier the rebirth left (T0, or the HEIRLOOM-kept tiers); missing → 0.
 */
export default function RebirthCeremony({ c, onContinue }) {
  const btnRef = useRef(null);
  const toKey = Number.isFinite(c.toKey) && c.toKey > 0 ? Math.floor(c.toKey) : 0;
  useEffect(() => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.3;
    burst(cx, cy, { count: 40, speed: 560, colors: ['#9A1AFF', '#FFE94A', '#FF4FA3', '#ffffff'], sizeMin: 4, sizeMax: 10, life: 0.9 });
    try { btnRef.current && btnRef.current.focus({ preventScroll: true }); } catch { /* old browser */ }
  }, []);
  return (
    <div className="rbc-layer" role="dialog" aria-modal="true" aria-label={`Rebirth ${c.rc} complete`}>
      <div className="rbc-card">
        <div className="rbc-kicker">REBIRTH {c.rc}</div>
        <div className="rbc-hero">
          ×{formatMult(c.mult)} <span className="rbc-hero-unit">XP &amp; WINS</span>
        </div>
        {c.stars > 0 && <div className="rbc-stars">+{formatNum(c.stars)} ★ FOR STAR PERKS</div>}

        <div className="rbc-cols">
          <section className="rbc-col rbc-reset" aria-label="Reset">
            <h3 className="rbc-col-h">RESET</h3>
            <div className="rbc-row rbc-level">
              <span className="rbc-label">LEVEL</span>
              <span className="rbc-level-val">
                <span className="rbc-from">{formatNum(c.fromLevel)}</span>
                <span className="rbc-arrow">→</span>
                <span className="rbc-to">{formatNum(c.toLevel)}</span>
              </span>
            </div>
            {c.toLevel > 1 && <div className="rbc-note">HEAD START: YOU BEGIN AT LV {formatNum(c.toLevel)}</div>}
            {/* Rebirth Rush: KEY resets to T0 every rebirth (wins kept → rebuy it) — T{min(T, kept)} with HEIRLOOM. */}
            {c.fromKey > 0 && (
              <div className="rbc-row rbc-level rbc-key">
                <span className="rbc-label">KEY</span>
                <span className="rbc-level-val">
                  <span className="rbc-from">T{formatNum(c.fromKey)}</span>
                  <span className="rbc-arrow">→</span>
                  <span className="rbc-to">T{formatNum(toKey)}</span>
                </span>
              </div>
            )}
            <p className="rbc-only">
              {toKey > 0 ? `LEVEL RESETS. HEIRLOOM KEPT KEY T${formatNum(toKey)}.` : 'LEVEL AND KEY RESET.'} EVERYTHING IN KEPT STAYS.
            </p>
          </section>
          <section className="rbc-col rbc-kept" aria-label="Kept">
            <h3 className="rbc-col-h">KEPT</h3>
            <ul className="rbc-list">
              {c.kept.map((k, i) => (
                <li key={k.label} className="rbc-row rbc-kept-row" style={{ '--i': i }}>
                  <span className="rbc-check" aria-hidden="true">✓</span>
                  <span className="rbc-label">{k.label}</span>
                  <span className="rbc-val">{k.value}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <button type="button" ref={btnRef} className="rbc-continue" onClick={onContinue}>
          CONTINUE
        </button>
      </div>
    </div>
  );
}
