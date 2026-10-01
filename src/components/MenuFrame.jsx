// MenuFrame — STEP 22 / Andy A1. Four corner ornaments around the menu stage that get visibly
// richer with the MENU TIER (level + rebirth, src/progress/menuTier.js). A L150 player's menu
// wears gold plates and rivets; a L1 menu wears nothing at all.
//
// ART VS MOTION: the ornaments are real vector art (inline SVG paths drawn for this), not CSS
// shapes. Each tier ADDS groups to the same corner, so the climb reads as accumulation. CSS only
// does motion: a one-shot slam when a NEW tier is first seen, and a one-shot punch on level-up
// (both transform/opacity, finite). Nothing loops at rest.
//
// Rebirths also hang one star per rebirth from the top edge (up to 5, then a count).
import { memo } from 'react';
import { TIER_COLORS } from '../progress/menuTier';
import './MenuFrame.css';

function Plate({ tier }) {
  const c = TIER_COLORS[tier] || TIER_COLORS[0];
  const dark = '#0d0618';
  return (
    <svg viewBox="0 0 120 120" className="menu-frame-svg" aria-hidden="true">
      {/* T1+: the base bracket — an uneven L with a chipped inner edge, hard black offset */}
      {tier >= 1 && (
        <g>
          <path d="M6 9 L104 5 L101 21 L27 24 L24 101 L8 106 Z" transform="translate(4,4)" fill="#000" />
          <path d="M6 9 L104 5 L101 21 L27 24 L24 101 L8 106 Z" fill={c.fill} stroke={c.line} strokeWidth="4" strokeLinejoin="round" />
          {/* tape tear on the end of each arm */}
          <path d="M98 6 L104 5 L101 21 L95 20 L99 14 Z" fill={c.line} />
          <path d="M9 100 L24 101 L23 95 L16 99 Z" fill={c.line} />
        </g>
      )}
      {/* T2+: rivets */}
      {tier >= 2 && (
        <g fill={dark} stroke={c.line} strokeWidth="2.5">
          <circle cx="16" cy="16" r="4.5" />
          <circle cx="60" cy="14" r="3.5" />
          <circle cx="15" cy="60" r="3.5" />
        </g>
      )}
      {/* T3+: an inner second rail, offset — the plate gets thickness */}
      {tier >= 3 && (
        <path d="M30 30 L84 28 L83 36 L38 38 L36 82 L29 84 Z" fill={c.line} stroke="#000" strokeWidth="3" strokeLinejoin="round" />
      )}
      {/* T4+: spikes off the outer edge, uneven (hand-cut) */}
      {tier >= 4 && (
        <g fill={c.fill} stroke="#000" strokeWidth="3" strokeLinejoin="round">
          <path d="M40 6 L47 -6 L52 6 Z" />
          <path d="M72 5 L80 -9 L85 5 Z" />
          <path d="M8 40 L-6 46 L8 52 Z" />
          <path d="M9 72 L-8 79 L9 85 Z" />
        </g>
      )}
      {/* T5+: a gem set in the corner rivet */}
      {tier >= 5 && (
        <g>
          <path d="M16 4 L27 15 L16 30 L5 15 Z" fill="#FF4FA3" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
          <path d="M16 8 L21 15 L16 13 Z" fill="#fff" />
        </g>
      )}
      {/* T6+: paint drips off the bottom of the horizontal arm */}
      {tier >= 6 && (
        <g fill={c.fill} stroke="#000" strokeWidth="2.5">
          <path d="M44 22 C44 30 41 34 41 38 C41 42 47 42 47 38 C47 33 45 30 46 22 Z" />
          <path d="M78 21 C78 34 75 40 75 46 C75 50 81 50 81 46 C81 39 79 33 80 21 Z" />
        </g>
      )}
      {/* T7: a crown riding the corner */}
      {tier >= 7 && (
        <path d="M30 -2 L36 -16 L43 -6 L50 -20 L56 -6 L63 -16 L68 -2 Z" fill="#FFD54A" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function Star() {
  return (
    <svg viewBox="0 0 120 120" className="menu-frame-star" aria-hidden="true">
      <path d="M58 14 L68.6 45.4 L101.8 45.8 L75.1 65.6 L85 97.2 L58 78 L31 97.2 L40.9 65.6 L14.2 45.8 L47.4 45.4 Z" transform="translate(6,6)" fill="#000" />
      <path d="M58 14 L68.6 45.4 L101.8 45.8 L75.1 65.6 L85 97.2 L58 78 L31 97.2 L40.9 65.6 L14.2 45.8 L47.4 45.4 Z" fill="#FFE94A" stroke="#a8800f" strokeWidth="7" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * @param tier      menu tier 0..7
 * @param rebirths  rebirth count (stars on the top edge)
 * @param fresh     true for the first render after crossing into a new tier → one-shot slam
 * @param punchKey  bump to replay the level-up punch
 *
 * STEP 22 compared three art directions (bolted PLATES, SPRAY strokes, STICKER clusters —
 * claude/step22/v-*.png). Plates shipped: solid shapes with a hard offset shadow still read at
 * 60px, the spray strokes went thin, and the stickers read as confetti rather than a frame.
 */
function MenuFrame({ tier, rebirths = 0, fresh = false, punchKey = 0 }) {
  if (tier <= 0 && rebirths <= 0) return null;
  const Art = Plate;
  const stars = Math.min(5, rebirths);
  return (
    <div className={`menu-frame tier-${tier}${fresh ? ' is-fresh' : ''}`} data-tier={tier} aria-hidden="true">
      {/* The RAILS: a plain rectangle border in the tier colour, thicker per tier. */}
      <div className="menu-frame-rail" style={{ '--rail': (TIER_COLORS[tier] || TIER_COLORS[0]).fill, '--rail-line': (TIER_COLORS[tier] || TIER_COLORS[0]).line }} />
      {['tl', 'tr', 'bl', 'br'].map((pos) => (
        <div key={`${pos}-${punchKey}`} className={`menu-frame-corner is-${pos}${punchKey ? ' is-punch' : ''}`}>
          <Art tier={tier} />
        </div>
      ))}
      {rebirths > 0 && (
        <div className="menu-frame-stars">
          {Array.from({ length: stars }, (_, i) => <Star key={i} />)}
          {rebirths > 5 && <span className="menu-frame-starcount">×{rebirths}</span>}
        </div>
      )}
    </div>
  );
}

export default memo(MenuFrame);
