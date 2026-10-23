// RankSeal — the painted NUMBERED badge a top-50 name wears (nameTier.js). v2 (oct22): five escalating SILHOUETTES, not
// recolors — violet splat tag #26–50 → cyan lightning star #11–25 → flame shield #4–10 → pink winged crest #2–3 → the
// one-of-one gold winged crowned starburst #1. The exact rank is printed on each art's blank panel. Past #50 it renders
// nothing (the caller keeps its plain number). Art: public/lb/seal-*.webp (ChatGPT oct22, one sheet, cut to transparent).
// CSS only sizes it, prints the number and — #1 only — runs ONE finite shine sweep on mount. Other motion is the caller's.
import { nameTier, SEAL_ART } from './nameTier.js';
import { formatNum } from '../format';
import './RankSeal.css';

export default function RankSeal({ rank, className = '', ...rest }) {
  const t = nameTier(rank);
  if (!t) return null;
  const n = formatNum(Number(rank));
  return (
    <span className={`rseal ${className}`} data-tier={t.key} data-digits={Math.min(3, String(n).length)} aria-label={`rank ${n}`} {...rest}>
      <img className="rseal-art" src={SEAL_ART[t.key]} alt="" aria-hidden="true" draggable="false" />
      {t.key === 'crown' ? <span className="rseal-shine" aria-hidden="true"><i /></span> : null}
      <b className="rseal-n" aria-hidden="true">{n}</b>
    </span>
  );
}
