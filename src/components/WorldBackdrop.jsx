// WorldBackdrop — STEP 50 (Andy oct2: "each border tier change swaps the background to a new WORLD
// in the same art style, with a swish-upward transition; keep it cheap: one transform, no lag on
// Chromebooks").
//
// The menu stage's background is the player's WORLD: tier 1..24 each has its own flat-colour SVG
// (public/worlds, authored by claude/worlds/gen-worlds.py). Tier 0 is the bare wall.
//
// THE SWISH: when the tier climbs, the old world and the new one sit stacked in ONE element (old on
// top, new below) and that element alone translates up by one world height — a single composited
// transform, finite, will-change only for its duration. Nothing else moves. Reduced motion: the new
// world simply appears.
//
// ART VS MOTION: the worlds are SVG assets (<img>), never CSS-drawn; CSS only moves them.
import { memo, useEffect, useRef, useState } from 'react';
import { WORLDS } from '../progress/worldsData';
import './WorldBackdrop.css';

export function worldFor(tier) {
  const t = Math.floor(Number(tier) || 0);
  if (t <= 0) return null;
  return WORLDS[Math.min(WORLDS.length, t) - 1] || null;
}

const SWISH_MS = 820;

function WorldBackdrop({ tier, from = null }) {
  const world = worldFor(tier);
  // The tier we last SHOWED: on mount it is the caller's "last seen" tier, so arriving on the menu
  // after a game that crossed a tier still swishes; afterwards it follows the prop.
  const shownRef = useRef(Number.isFinite(from) ? from : tier);
  const [swish, setSwish] = useState(null); // { from: world, key } while the swish runs
  useEffect(() => {
    const prev = shownRef.current;
    shownRef.current = tier;
    if (!(tier > prev) || !worldFor(tier)) return undefined;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    setSwish({ from: worldFor(prev), key: Date.now() });
    const t = setTimeout(() => setSwish(null), SWISH_MS + 60);
    return () => clearTimeout(t);
  }, [tier]);
  if (!world) return null;
  return (
    <div className="world" aria-hidden="true" data-world={world.id}>
      <div key={swish ? swish.key : 'still'} className={`world-stack${swish ? ' is-swish' : ''}`}>
        {swish && (
          <div className="world-pane is-old" style={{ background: swish.from ? swish.from.sky : '#0d0618' }}>
            {swish.from && <img className="world-img" src={swish.from.src} alt="" decoding="async" />}
          </div>
        )}
        <div className="world-pane" style={{ background: world.sky }}>
          <img className="world-img" src={world.src} alt="" decoding="async" />
        </div>
      </div>
    </div>
  );
}

export default memo(WorldBackdrop);
