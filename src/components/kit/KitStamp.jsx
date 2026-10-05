// KitStamp.jsx — 05 STAMPS (claude/mockups/v2/KitCurrency.dc.html): CLAIMED / SOLD OUT / NEW! / MAX.
//
//   <KitStampCard stamped kind="claimed" angle={-13}> …card… </KitStampCard>
//
// A stamp SLAMS in from ×2.9 (400 ms), six ink spatters shoot out as it hits, and the card under it
// JOLTS (500 ms). Each stamp is drawn with a black under-print, an off-register ghost and an ink-grain
// overlay. `playKey` re-slams. The card dims to 50% under a CLAIMED / SOLD OUT / MAX stamp.
import { useEffect, useRef } from 'react';
import { FX, fx } from './motion.js';
import './tokens.css';
import './KitStamp.css';

export const STAMP_KINDS = {
  claimed: { label: 'CLAIMED', spat: 'cyan', angle: -13 },
  soldout: { label: 'SOLD OUT', spat: 'hot', angle: -20 },
  new: { label: 'NEW!', spat: 'yellow', angle: 14 },
  max: { label: 'MAX', spat: 'lilac', angle: 9 },
};
const TICKS = [0, 60, 120, 180, 240, 300];

function StampArt({ kind }) {
  if (kind === 'soldout') {
    return (
      <div className="kst-art kst-sold">
        <div className="kst-sold-under" />
        <div className="kst-sold-ghost" />
        <div className="kst-sold-band">SOLD OUT</div>
        <div className="kst-grain kst-grain--sold" />
      </div>
    );
  }
  if (kind === 'new') {
    return (
      <div className="kst-art kst-new">
        <div className="kst-new-under" />
        <div className="kst-new-ghost" />
        <div className="kst-new-disc">
          <div className="kst-new-dash" />
          <span className="kst-new-t">NEW!</span>
        </div>
        <div className="kst-grain kst-grain--new" />
      </div>
    );
  }
  if (kind === 'max') {
    return (
      <div className="kst-art kst-max">
        <div className="kst-max-under" />
        <div className="kst-max-ghost" />
        <div className="kst-max-plate">
          <svg viewBox="0 0 24 30" width="20" height="26" aria-hidden="true" focusable="false">
            <path d="M3 14 L12 5 L21 14 M3 25 L12 16 L21 25" stroke="#000" strokeWidth="7" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M3 14 L12 5 L21 14 M3 25 L12 16 L21 25" stroke="#FFE94A" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span className="kst-max-t">MAX</span>
        </div>
        <div className="kst-grain kst-grain--max" />
      </div>
    );
  }
  return (
    <div className="kst-art kst-claimed">
      <div className="kst-cl kst-cl--under"><div className="kst-cl-in">CLAIMED</div></div>
      <div className="kst-cl kst-cl--ghost"><div className="kst-cl-in">CLAIMED</div></div>
      <div className="kst-cl kst-cl--main"><div className="kst-cl-in">CLAIMED</div></div>
      <div className="kst-grain kst-grain--claimed" />
    </div>
  );
}

/** The stamp alone, centred on its own origin (place it with the wrapper's left/top). */
export function KitStamp({ kind = 'claimed', angle, playKey = 0, onSlam }) {
  const k = STAMP_KINDS[kind] || STAMP_KINDS.claimed;
  const slamRef = useRef(null);
  const spatRefs = useRef([]);
  const cb = useRef(onSlam);
  cb.current = onSlam;
  useEffect(() => {
    fx(slamRef.current, FX.stampSlam);
    spatRefs.current.forEach((el) => fx(el, FX.spat));
    if (cb.current) cb.current();
  }, [playKey, kind]);
  return (
    <div className="kst" style={{ transform: `rotate(${Number.isFinite(angle) ? angle : k.angle}deg)` }} role="img" aria-label={k.label}>
      {TICKS.map((a, i) => (
        <div key={a} className="kst-tick" style={{ transform: `rotate(${a}deg)` }}>
          <div ref={(el) => { spatRefs.current[i] = el; }} className={`kst-spat kst-spat--${k.spat}${kind === 'new' ? ' is-short' : ''}`} />
        </div>
      ))}
      <div className="kst-center">
        <div ref={slamRef}>
          <StampArt kind={kind} />
        </div>
      </div>
    </div>
  );
}

/**
 * A card that can be stamped. `at` places the stamp ({left, top} — % or px strings).
 * The card jolts when the stamp lands; `dim` (default: not for NEW!) fades the card to 50%.
 */
export function KitStampCard({ stamped = false, kind = 'claimed', angle, at, dim, playKey = 0, className, style, children, onClick, ariaLabel }) {
  const cardRef = useRef(null);
  const dimmed = stamped && (typeof dim === 'boolean' ? dim : kind !== 'new');
  const pos = at || (kind === 'new' ? { right: '30px', top: '30px' } : { left: '50%', top: '56%' });
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`kstc${className ? ` ${className}` : ''}`} style={style} onClick={onClick} aria-label={ariaLabel}>
      <div ref={cardRef} className="kstc-card">
        <div className={`kstc-body${dimmed ? ' is-dim' : ''}`}>{children}</div>
      </div>
      {stamped && (
        <div className="kstc-anchor" style={pos}>
          <KitStamp kind={kind} angle={angle} playKey={playKey} onSlam={() => fx(cardRef.current, FX.jolt)} />
        </div>
      )}
    </Tag>
  );
}
