// RankSeal — the painted NUMBERED badge a top-50 name wears (nameTier.js). v2 (oct22): five escalating SILHOUETTES, not
// recolors — violet splat tag #26–50 → cyan lightning star #11–25 → flame shield #4–10 → pink winged crest #2–3 → the
// one-of-one gold winged crowned starburst #1. The exact rank is printed on each art's blank panel. Past #50 it renders
// nothing (the caller keeps its plain number). Art: public/lb/seal-*.webp (ChatGPT oct22, one sheet, cut to transparent).
// CSS sizes it, prints the number and runs ONE finite shine sweep on mount (every tier since nov2 - Andy: the badges were
// "static/no flavor"), staggered down the ranks; hovering its row replays it. Other motion is the caller's.
import { nameTier, SEAL_ART } from './nameTier.js';
import { formatNum } from '../format';
import './RankSeal.css';

export default function RankSeal({ rank, className = '', ...rest }) {
  const t = nameTier(rank);
  if (!t) return null;
  const n = formatNum(Number(rank));
  return (
    <span
      className={`rseal ${className}`}
      data-tier={t.key}
      data-digits={Math.min(3, String(n).length)}
      aria-label={`rank ${n}`}
      style={{ '--seal-art': `url(${SEAL_ART[t.key]})`, '--shine-at': `${700 + Math.min(Number(rank), 12) * 70}ms` }}
      {...rest}
    >
      <img className="rseal-art" src={SEAL_ART[t.key]} alt="" aria-hidden="true" draggable="false" />
      <span className="rseal-shine" aria-hidden="true"><i /></span>
      <b className="rseal-n" aria-hidden="true">{n}</b>
    </span>
  );
}
