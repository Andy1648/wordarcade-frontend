// KitRankPlate.jsx — 03 RANK PLATES (claude/mockups/v2/KitLevelUp.dc.html): the v3 rank as a NAME BADGE whose shape and
// trim escalate up the 16-step ladder (bare slab → notch → keycap → hex … → horns, crown, wings + fangs → the ★ tiers).
//
//   <KitRankPlate rank="R6" />                    KEYFIEND, 156 px wide
//   <KitRankPlate rank={11} w={120} />            VOIDTYPER by ladder index
//   <KitRankPlate rank="R2" label="#7" />          the board's "#7" on CLACKER's plate
//   <KitRankPlate rank="R6" fit />                 FIT: sized by its name (13 px) and the CSS height
//                                                  (--krp-h, default 28 px) — the art stretches to the text,
//                                                  strokes stay true (non-scaling). For dense lists (the board).
//
// SVG art (rankPlates.js), never CSS shapes. The ★ tiers get ONE sheen pass when the plate mounts (`shine`, default on)
// — finite, transform only, skipped under REDUCE MOTION; the mockup's looping shimmer is a one-shot here (CLAUDE.md:
// zero new infinite animations). Nothing else moves; the parent animates the plate as a whole.
import { useEffect, useId, useRef } from 'react';
import { plateFor } from './rankPlates.js';
import { kitPlay } from './motion.js';
import './tokens.css';
import './KitRankPlate.css';

const NONE = 'M0 0';
const SHEEN = [{ transform: 'translateX(0) skewX(-20deg)' }, { transform: 'translateX(260px) skewX(-20deg)' }];

export function KitRankPlate({ rank = 'R0', w = 156, label, shine = true, fit = false, className = '', innerRef, ...rest }) {
  const p = plateFor(rank);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gid = `krp-g${uid}`;
  const cid = `krp-c${uid}`;
  const sheen = useRef(null);
  useEffect(() => {
    if (p.star && shine) kitPlay(sheen.current, SHEEN, { duration: 700, delay: 450, easing: 'ease-in' });
  }, [p.star, shine]);
  const h = Math.round(w * 0.4);
  const fx = `drop-shadow(3px 3px 0 #000)${p.glow ? ` drop-shadow(0 0 7px ${p.glow})` : ''}`;
  const size = fit ? 'fit' : w >= 170 ? 'l' : w >= 140 ? 'm' : 's';
  const vfx = fit ? 'non-scaling-stroke' : undefined;
  return (
    <span
      ref={innerRef}
      className={`krp krp-${size}${p.star ? ' is-star' : ''}${className ? ` ${className}` : ''}`}
      style={fit ? { '--krp-txt': p.txt } : { width: `${w}px`, height: `${h}px`, '--krp-txt': p.txt }}
      data-rank-plate={p.req}
      data-rank-title={p.name}
      {...rest}
    >
      <svg className="krp-art" viewBox="0 0 180 72" width={fit ? '100%' : w} height={fit ? '100%' : h} preserveAspectRatio={fit ? 'none' : undefined} style={{ filter: fx }} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={p.g[0]} />
            <stop offset=".5" stopColor={p.g[1]} />
            <stop offset="1" stopColor={p.g[2]} />
          </linearGradient>
          <clipPath id={cid}>
            <path d={p.shape} />
          </clipPath>
        </defs>
        <path d={p.back || NONE} fill={p.c3 || '#000'} stroke="#000" strokeWidth={fit ? 2 : 4} vectorEffect={vfx} strokeLinejoin="round" fillRule="evenodd" />
        <g clipPath={`url(#${cid})`}>
          <rect x="-10" y="-10" width="200" height="90" fill={p.lip} />
          <rect x="-10" y="-10" width="200" height="57" fill={`url(#${gid})`} />
          <rect x="-10" y="21" width="200" height="3" fill="#fff" opacity=".35" />
          {p.star ? <path ref={sheen} className="krp-sheen" d="M-40 -10 H-18 L-38 82 H-60 Z" fill="#fff" opacity=".6" /> : null}
        </g>
        <path d={p.shape} fill="none" stroke="#000" strokeWidth={fit ? 2.5 : p.star ? 5.5 : 4.5} vectorEffect={vfx} strokeLinejoin="round" />
        <path d={p.front || NONE} fill={p.c4 || '#000'} stroke="#000" strokeWidth={fit ? 1.5 : 2.5} vectorEffect={vfx} strokeLinejoin="round" />
      </svg>
      <span className={`krp-name${p.txt !== '#000' ? ' is-stroked' : ''}`}>{label != null ? label : p.name}</span>
    </span>
  );
}

export default KitRankPlate;
