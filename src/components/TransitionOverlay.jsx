// TransitionOverlay.jsx — the ONE pooled screen-change wipe. Mounted ONCE by App (never keyed, never
// remounted); lib/navWipe.js replays this same node through WAAPI for every major navigation: every
// `view` change (shop / stats / leaderboard / daily blitz / the games …) and the menu's own sheets
// (GEARS / ROLL, CONTRACTS, REWARDS, PROFILE). Purely cosmetic: position:fixed, pointer-events:none,
// laid over a screen that has ALREADY swapped — it can never gate which screen is shown.
//   forward (menu -> deeper) — the band slaps in from the LEFT and clears to the right;
//   back    (returning)      — mirrored (the track flips; the word never does).
// ART: the band is flat house-colour slabs + the mascot-run PNG riding its leading edge. A painted band
// (public/fx/transition/wipe-band.webp — requested from the hero-art session) drops into WIPE_ART.
import { useEffect, useRef } from 'react';
import { registerWipe } from '../lib/navWipe';
import './TransitionOverlay.css';

// Painted wipe band (transparent webp, drawn travelling left→right). null until the art lands.
const WIPE_ART = null;

export default function TransitionOverlay() {
  const root = useRef(null);
  const track = useRef(null);
  const band = useRef(null);
  const mascot = useRef(null);
  const word = useRef(null);
  useEffect(
    () => registerWipe({ root: root.current, track: track.current, band: band.current, mascot: mascot.current, word: word.current }),
    [],
  );
  return (
    <div ref={root} className="transition-overlay" data-state="idle" data-dir="forward" aria-hidden="true">
      <div ref={track} className="tw-track">
        <div ref={band} className={`tw-band${WIPE_ART ? ' has-art' : ''}`}>
          {WIPE_ART ? (
            <img className="tw-art" src={WIPE_ART} alt="" decoding="async" draggable="false" />
          ) : (
            <>
              <span className="tw-slab tw-slab--lead" />
              <span className="tw-slab tw-slab--main" />
              <span className="tw-slab tw-slab--trail" />
            </>
          )}
          {/* src is set on the first gesture (navWipe.warmMascot) — never fetched before one */}
          <img ref={mascot} className="tw-mascot" data-src="/mascot-run.webp" alt="" decoding="async" draggable="false" />
        </div>
      </div>
      <div className="tw-word-wrap"><div ref={word} className="tw-word" /></div>
    </div>
  );
}
