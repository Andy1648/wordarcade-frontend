// KitBadge.jsx — 04 BADGES (claude/mockups/v2/KitCurrency.dc.html): "ONLY WHEN THERE'S A TODO".
//
//   <span style={{ position: 'relative' }}>…<KitBadge kind="count" count={3} show={n > 0} /></span>
//
// kind: 'dot' (something new), 'count' (n to claim), 'alert' (a diamond "!" — affordable now).
// Arrives with a pop (400 ms), then ONE nudge wiggle; a count change bumps it; `show` going false
// pops it out (240 ms) before it unmounts. The mockup's 2.8 s nudge LOOP is played once on arrival.
import { useEffect, useRef, useState } from 'react';
import { FX, fx } from './motion.js';
import { formatNum } from '../../format.js';
import './tokens.css';
import './KitBadge.css';

export function KitBadge({ kind = 'dot', count, show = true, label, className }) {
  const [mounted, setMounted] = useState(show);
  const outerRef = useRef(null);
  const nudgeRef = useRef(null);
  const bumpRef = useRef(null);
  const prevCount = useRef(count);
  useEffect(() => {
    if (show) {
      setMounted(true);
      return undefined;
    }
    if (!mounted) return undefined;
    const a = fx(outerRef.current, FX.badgeOut);
    if (!a) {
      setMounted(false);
      return undefined;
    }
    let live = true;
    a.addEventListener('finish', () => { if (live) setMounted(false); }, { once: true });
    return () => { live = false; };
  }, [show, mounted]);
  useEffect(() => {
    if (!mounted || !show) return;
    fx(outerRef.current, FX.badgeIn);
    fx(nudgeRef.current, FX.nudge);
  }, [mounted, show]);
  useEffect(() => {
    if (prevCount.current !== count && mounted && show) fx(bumpRef.current, FX.badgeBump);
    prevCount.current = count;
  }, [count, mounted, show]);
  if (!mounted) return null;
  return (
    <span ref={outerRef} className={`kbg kbg--${kind}${className ? ` ${className}` : ''}`} role={label ? 'status' : undefined} aria-label={label}>
      <span ref={bumpRef} className="kbg-bump">
        <span ref={nudgeRef} className="kbg-nudge">
          {kind === 'count' ? (
            <span className="kbg-count">{formatNum(count || 0)}</span>
          ) : kind === 'alert' ? (
            <>
              <span className="kbg-diamond" />
              <span className="kbg-bang">!</span>
            </>
          ) : (
            <span className="kbg-dot">
              <span className="kbg-hi" />
            </span>
          )}
        </span>
      </span>
    </span>
  );
}
