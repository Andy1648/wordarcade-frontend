// GemChip.jsx — the EAGER half of GEMS on screen: the icon, the live balance hook and the icon + count. The menu
// (MenuXp / MobileMenu / Homepage) imports only this, so the index chunk carries the chip and nothing else; the
// end-of-game line and the GEM POP live in Gems.jsx (lazy with the game screens). PAYLOAD SPLIT, PR #194.
// ART VS MOTION: the gem is a real asset (/art/gems/gem.svg). Nothing here moves.
import { useEffect, useState } from 'react';
import { formatNum } from '../../format';
import { getGems, subscribeGems } from '../../progress/gemsCore';
import './GemChip.css';

export const GEM_SRC = '/art/gems/gem.svg';

/** The gem asset, decorative. */
export function GemIcon({ size = 18, className = '' }) {
  return <img className={`gem-icon ${className}`.trim()} src={GEM_SRC} width={size} height={size} alt="" aria-hidden="true" draggable="false" />;
}

/** The live gems balance (every grant / spend tells it). */
export function useGems() {
  const [gems, setGems] = useState(getGems);
  useEffect(() => subscribeGems(setGems), []);
  return gems;
}

/** Icon + count (formatNum). */
export function GemCount({ value, size = 18, className = '', label = true }) {
  const v = Number.isFinite(value) ? value : 0;
  return (
    <span className={`gem-count ${className}`.trim()} data-gems={v} aria-label={label ? `${formatNum(v)} gems` : undefined}>
      <GemIcon size={size} />
      <span className="gem-count-num" aria-hidden={label ? 'true' : undefined}>{formatNum(v)}</span>
    </span>
  );
}
