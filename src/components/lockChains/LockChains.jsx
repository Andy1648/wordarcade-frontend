// LockChains — SHACKLES (Andy oct11/oct13): a locked box reads as CHAINED SHUT — two crossed chains + a padlock over
// the WHOLE box (ChatGPT art cut by scripts/cutout-art.py: public/fx/locked-chains{,-wide}.webp). An <img> asset
// (ART VS MOTION); the host owns position:relative. Motion: one finite transform-only rattle when the host is hovered
// or tapped (LockChains.css) — nothing loops at rest.
import './LockChains.css';

export default function LockChains({ wide = false, className = '' }) {
  return (
    <img
      className={`lock-chains${wide ? ' is-wide' : ''}${className ? ` ${className}` : ''}`}
      src={wide ? '/fx/locked-chains-wide.webp' : '/fx/locked-chains.webp'}
      alt=""
      aria-hidden="true"
      draggable="false"
    />
  );
}
