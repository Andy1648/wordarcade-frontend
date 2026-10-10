// TierBanner — the RARITY as a banner, not a small word (gear UI v3, Andy oct9 "i want the display for the gear
// rarities to be even better (like mythic and secret should be even greater)" / "i dont want plain text anywhere").
// The GEAR SHEET's kicker and the ROLL reveal's tier line. Vector art (an inline SVG ribbon — a notched plate with
// folded tails, outlined in the tier's darker shade, a hard black shadow) under the tier word in Bungee, white, a thick
// ink stroke and a hard offset shadow. It climbs the ladder:
//   RARE       the plate
//   EPIC       + folded tails
//   LEGENDARY  + diamond pins
//   MYTHIC     + its second colour: a cyan plate printed off-register under the pink one, horn spikes on the tails
//   SECRET     the plate in rainbow stripes, a white star at each end
// The ribbon stretches to the word (preserveAspectRatio none; strokes are non-scaling). Static: the screens that host
// it own any motion (the reveal slams it once).
import { memo, useId } from 'react';
import { CARD_RAR, RAINBOW_TEETH, cardTier } from './palette.js';
import { tierLabel } from './cardModel.js';
import './TierBanner.css';

const PLATE = 'M10 4 H190 L198 22 L190 40 H10 L2 22 Z';
const TAILS = 'M14 12 H-14 L-6 26 L-14 40 H14 Z M186 12 H214 L206 26 L214 40 H186 Z';
const NS = { vectorEffect: 'non-scaling-stroke' };

function TierBanner({ tier, kind = 'roll', size = 'md', className = '' }) {
  const t = cardTier(kind === 'perm' ? 'legendary' : tier);
  const pal = CARD_RAR[t];
  const rank = { rare: 0, epic: 1, legendary: 2, mythic: 3, secret: 4 }[t] ?? 0;
  const label = tierLabel(tier, kind);
  const clip = `tb${useId().replace(/:/g, '')}`;
  return (
    <span className={`tb is-${t} is-${size}${className ? ` ${className}` : ''}`} data-tier={t}>
      <svg className="tb-art" viewBox="-16 0 232 48" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {/* the hard shadow */}
        <g transform="translate(5 5)" fill="#000">
          {rank >= 1 ? <path d={TAILS} /> : null}
          <path d={PLATE} />
        </g>
        {rank >= 1 ? <path d={TAILS} fill={pal.edge} stroke="#000" strokeWidth="2.5" strokeLinejoin="round" {...NS} /> : null}
        {/* MYTHIC: its second colour, printed off-register */}
        {t === 'mythic' ? <path d={PLATE} transform="translate(-5 4)" fill="#2EFFE0" stroke="#128f7e" strokeWidth="3" strokeLinejoin="round" {...NS} /> : null}
        {t === 'secret' ? (
          <g>
            {RAINBOW_TEETH.map((c, i) => (
              <path key={c} d={`M${2 + i * 39.2} 4 H${2 + (i + 1) * 39.2 + 0.4} V40 H${2 + i * 39.2} Z`} fill={c} clipPath={`url(#${clip})`} />
            ))}
            <clipPath id={clip}><path d={PLATE} /></clipPath>
            <path d={PLATE} fill="none" stroke="#000" strokeWidth="3.5" strokeLinejoin="round" {...NS} />
          </g>
        ) : (
          <path d={PLATE} fill={rank >= 2 ? pal.line : pal.fill} stroke={rank >= 2 ? pal.edge : pal.line} strokeWidth="3.5" strokeLinejoin="round" {...NS} />
        )}
        {/* a drip off the plate (personality) */}
        <path d="M158 40 C158 44 156 47 159 50 C162 47 161 44 161 40 Z" fill={t === 'secret' ? '#2EFFE0' : rank >= 2 ? pal.line : pal.line} />
      </svg>
      {/* LEGENDARY+: the pins / MYTHIC horns / SECRET stars sit at the plate's ends (unstretched glyphs) */}
      {rank >= 2 ? <span className="tb-end is-l" aria-hidden="true"><TbGlyph t={t} pal={pal} /></span> : null}
      {rank >= 2 ? <span className="tb-end is-r" aria-hidden="true"><TbGlyph t={t} pal={pal} flip /></span> : null}
      <span className="tb-word">{label}</span>
    </span>
  );
}

function TbGlyph({ t, pal, flip = false }) {
  if (t === 'secret') {
    return (
      <svg viewBox="0 0 24 24" width="100%" height="100%">
        <path d="M12 1.5 L14.8 8.6 L22.5 9 L16.5 13.8 L18.6 21.4 L12 17.1 L5.4 21.4 L7.5 13.8 L1.5 9 L9.2 8.6 Z" fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  if (t === 'mythic') {
    return (
      <svg viewBox="0 0 24 24" width="100%" height="100%" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
        <path d="M20 22 C12 20 6 14 3 2 C10 7 16 10 22 12 C20 15 20 18 20 22 Z" fill={pal.line} stroke="#000" strokeWidth="2" strokeLinejoin="round" />
        <path d="M18 17 C13 15 9 11 7 6 C11 9 15 11 19 12 Z" fill="#2EFFE0" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <path d="M12 2 L21 12 L12 22 L3 12 Z" fill={pal.line} stroke="#000" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="9.5" cy="9" r="1.8" fill="#fff" />
    </svg>
  );
}

export default memo(TierBanner);
