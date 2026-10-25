// TransitionOverlay.jsx — the ONE pooled screen-change wipe. Mounted ONCE by App (never keyed, never
// remounted); lib/navWipe.js replays this same node through WAAPI for every major navigation: every
// `view` change (shop / stats / leaderboard / daily blitz / the games …) and the menu's own sheets
// (GEARS / ROLL, CONTRACTS, REWARDS, PROFILE). Purely cosmetic: position:fixed, pointer-events:none,
// laid over a screen that has ALREADY swapped — it can never gate which screen is shown.
//   forward (menu -> deeper) — the band slaps in from the LEFT and clears to the right;
//   back    (returning)      — mirrored (the track flips; the word never does).
// ART: the PAINTED band (public/fx/transition/wipe-band.webp — hot-pink swipe, purple dripping lead edge, torn
// trail) over a flat pink slab that guarantees full cover, the pink ink SPLAT (wipe-splat.webp) slapped under the
// word, and the mascot-run PNG riding the lead. All three are fetched on the first gesture (data-src), never on
// first paint; until they decode the flat slabs alone still cover the screen.
import { useEffect, useRef } from 'react';
import { registerWipe } from '../lib/navWipe';
import './TransitionOverlay.css';

// Painted wipe band (transparent webp, drawn travelling left→right) + the word's ink splat. null = flat slabs only.
const WIPE_ART = '/fx/transition/wipe-band.webp';
const WIPE_SPLAT = '/fx/transition/wipe-splat.webp';

export default function TransitionOverlay() {
  const root = useRef(null);
  const track = useRef(null);
  const band = useRef(null);
  const mascot = useRef(null);
  const word = useRef(null);
  const splat = useRef(null);
  useEffect(
    () => registerWipe({ root: root.current, track: track.current, band: band.current, mascot: mascot.current, word: word.current, splat: splat.current, painted: !!WIPE_ART }),
    [],
  );
  return (
    <div ref={root} className="transition-overlay" data-state="idle" data-dir="forward" aria-hidden="true">
      <div ref={track} className="tw-track">
        <div ref={band} className={`tw-band${WIPE_ART ? ' has-art' : ''}`}>
          {/* the flat slabs are ALWAYS there: full cover before the art decodes, and under the art's torn edges */}
          <span className="tw-slab tw-slab--lead" />
          <span className="tw-slab tw-slab--main" />
          <span className="tw-slab tw-slab--trail" />
          {WIPE_ART ? <img className="tw-art" data-src={WIPE_ART} alt="" decoding="async" draggable="false" /> : null}
          {/* every data-src art is set on the first gesture (navWipe.warmMascot) — never fetched before one */}
          <img ref={mascot} className="tw-mascot" data-src="/mascot-run.webp" alt="" decoding="async" draggable="false" />
        </div>
      </div>
      <div className="tw-word-wrap">
        {WIPE_SPLAT ? <img ref={splat} className="tw-splat" data-src={WIPE_SPLAT} alt="" decoding="async" draggable="false" /> : null}
        <div ref={word} className="tw-word" />
      </div>
    </div>
  );
}
