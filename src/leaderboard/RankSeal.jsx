// RankSeal — the painted NUMBERED seal a top-50 name wears (nameTier.js): the crowned gold shield for #1, silver /
// bronze shields for #2 / #3, the gold / cyan / violet notched seals for #4–10 / 11–25 / 26–50, the exact rank printed on
// it. Past #50 it renders nothing (the caller keeps its plain number). The art is public/lb/seal-*.webp (ChatGPT oct21,
// cut by scripts/split-sheet.py); CSS only sizes it and prints the number. Motion is the caller's (kitPlay one-shots).
import { nameTier, SEAL_ART } from './nameTier.js';
import { formatNum } from '../format';
import './RankSeal.css';

export default function RankSeal({ rank, className = '', ...rest }) {
  const t = nameTier(rank);
  if (!t) return null;
  const n = formatNum(Number(rank));
  return (
    <span className={`rseal ${className}`} data-tier={t.key} data-digits={Math.min(3, String(n).length)} aria-label={`rank ${n}`} {...rest}>
      <img className="rseal-art" src={SEAL_ART[t.key]} alt="" aria-hidden="true" draggable="false" width="192" height="190" />
      <b className="rseal-n" aria-hidden="true">{n}</b>
    </span>
  );
}
