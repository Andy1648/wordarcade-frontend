// KitGoalBar.jsx — 04 GOAL BARS (claude/mockups/v2/KitBars.dc.html): a tiered goal row.
//
//   <KitGoalBar icon="achievements" name="WIN ROUNDS" tier={1} value={212} target={500}
//               actionLabel="+60" claimLabel="CLAIM +75" onAction={…} />
//
// Icon, name, "TIER II", five tier pips, a bar (scaleX, 450 ms overshoot) with a 90% mark, the value
// ("212 / 500"), and one action button. At ≥ 90% the bar turns hot and an "N LEFT" sticker pops in;
// at 100% the row outlines yellow and the button becomes the CLAIM (it throbs as it becomes ready —
// once, where the mockup loops). Claiming (tier +1) slams the pip it filled. `tier >= tierCount` = MAXED.
import { useEffect, useRef } from 'react';
import KitIcon from './KitIcon.jsx';
import { FX, fx } from './motion.js';
import { formatNum } from '../../format.js';
import './tokens.css';
import './KitGoalBar.css';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function KitGoalBar({ icon = 'achievements', name, tier = 0, tierCount = 5, value = 0, target = 1, actionLabel, claimLabel = 'CLAIM', onAction, className }) {
  const maxed = tier >= tierCount;
  const f = maxed ? 1 : Math.max(0, Math.min(1, value / target));
  const ready = !maxed && f >= 1;
  const almost = !ready && !maxed && f >= 0.9;
  const hot = ready || almost;
  const pipRefs = useRef([]);
  const btnRef = useRef(null);
  const leftRef = useRef(null);
  const prev = useRef({ tier, ready, almost, hot });
  useEffect(() => {
    const p = prev.current;
    if (tier > p.tier) fx(pipRefs.current[tier - 1], FX.slamBig);
    if (ready && !p.ready) fx(btnRef.current, FX.throb(3));
    if (hot && !p.hot && !(tier > p.tier)) fx(pipRefs.current[tier], FX.throb(3));
    if (almost && !p.almost) fx(leftRef.current, FX.stickerIn);
    prev.current = { tier, ready, almost, hot };
  }, [tier, ready, almost, hot]);
  const label = ready ? claimLabel : maxed ? 'MAXED' : actionLabel;
  return (
    <div className={`kgl${ready ? ' is-ready' : ''}${hot ? ' is-hot' : ''}${maxed ? ' is-max' : ''}${className ? ` ${className}` : ''}`}>
      <div className="kgl-ico">
        <KitIcon name={icon} size={34} shadow={2} extras={false} />
      </div>
      <div className="kgl-main">
        <div className="kgl-top">
          <div className="kgl-title">
            <span className="kgl-name">{name}</span>
            <span className="kgl-tier">{maxed ? 'MAX' : `TIER ${ROMAN[tier] || tier + 1}`}</span>
          </div>
          <div className="kgl-pips" aria-label={`Tier ${Math.min(tier, tierCount)} of ${tierCount}`} role="img">
            {Array.from({ length: tierCount }, (_, j) => (
              <span key={j} ref={(el) => { pipRefs.current[j] = el; }} className={`kgl-pip${j < tier ? ' is-done' : ''}${j === tier && hot ? ' is-next' : ''}`}>
                <span className="kgl-pip-d" />
              </span>
            ))}
          </div>
        </div>
        <div className="kgl-row">
          <div className="kgl-bar" role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(f * 100)}>
            <div className="kgl-fill" style={{ transform: `scaleX(${f.toFixed(3)})` }}>
              <div className="kgl-fill-lo" />
            </div>
            <div className="kgl-mark" />
          </div>
          <span className="kgl-val">{maxed ? formatNum(value) : `${formatNum(value)} / ${formatNum(target)}`}</span>
        </div>
      </div>
      {label ? (
        <button ref={btnRef} type="button" className="kgl-act" onClick={onAction} disabled={maxed}>
          {label}
        </button>
      ) : null}
      {almost && (
        <span ref={leftRef} className="kgl-left">
          {formatNum(target - value)} LEFT
        </span>
      )}
    </div>
  );
}
