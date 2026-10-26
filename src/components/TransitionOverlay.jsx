// TransitionOverlay.jsx — the ONE pooled screen-change transition. Mounted ONCE by App (never keyed, never
// remounted); lib/navWipe.js replays this same node through WAAPI for every major navigation: every `view`
// change (shop / stats / leaderboard / daily blitz / the games …) and the menu's own sheets (GEARS / ROLL,
// CONTRACTS, REWARDS, PROFILE). Purely cosmetic: position:fixed, pointer-events:none, laid over a screen that
// has ALREADY swapped — it can never gate which screen is shown.
//
// LOOK = the GAME TRANSITION SCREEN (TransitionIntro — "TYPE FAST. / DIE SLOW."), the transition screen Andy
// said he's fine with (oct25, on the painted swipe: "doesnt cover edges, its too quick"): the flat black field
// cuts in over the WHOLE screen, the destination word PUNCHES in letter-by-letter in the intro's vinyl-sticker
// type (cyan line / pink line, crooked slots, chunky black stroke + hard drop shadow), a white impact frame +
// shake sell the hit, it holds to be read, then the KNIFE-SPLIT (the intro → menu reveal) slashes the black
// open along a 4° seam.
//
// POOL: three copies of a 2-line × MAX_LETTERS title are built ONCE here — the LIVE copy (animated) and the two
// static halves' copies (the knife). navWipe only writes text into them; no node is ever created per transition.
import { useEffect, useRef } from 'react';
import { registerWipe, MAX_LETTERS } from '../lib/navWipe';
import './TransitionOverlay.css';

const SLOTS = [0, 1];
const LETTERS = Array.from({ length: MAX_LETTERS }, (_, i) => i);

function Title({ copy }) {
  return (
    <div className="nt-title" data-copy={copy}>
      {SLOTS.map((s) => (
        <div key={s} className={`nt-slot nt-slot--${s + 1}`}>
          <div className="nt-line">
            {LETTERS.map((i) => (
              <span key={i} className="nt-letter" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// the static DOM the player drives: per copy, its two slots / lines / letter spans (queried once, on mount)
function collect(root) {
  return [...root.querySelectorAll('.nt-title')].map((t) => {
    const slots = [...t.querySelectorAll('.nt-slot')];
    return {
      slots,
      lines: slots.map((s) => s.querySelector('.nt-line')),
      letters: slots.map((s) => [...s.querySelectorAll('.nt-letter')]),
    };
  });
}

export default function TransitionOverlay() {
  const root = useRef(null);
  const live = useRef(null);
  const stage = useRef(null);
  const top = useRef(null);
  const bottom = useRef(null);
  const flash = useRef(null);
  const slash = useRef(null);
  useEffect(() => {
    // DOM order: top half, bottom half, live
    const [topCopy, bottomCopy, liveCopy] = collect(root.current);
    return registerWipe({
      root: root.current,
      live: live.current,
      stage: stage.current,
      halves: [top.current, bottom.current],
      flash: flash.current,
      slash: slash.current,
      copies: [liveCopy, topCopy, bottomCopy],
    });
  }, []);
  return (
    <div ref={root} className="transition-overlay" data-state="idle" aria-hidden="true">
      {/* the knife halves: two full-screen black covers clipped to either side of one 4° seam, each carrying a
          STATIC copy of the settled title — revealed when the live layer cuts out, then they part */}
      <div ref={top} className="nt-half nt-half--top">
        <Title copy="top" />
      </div>
      <div ref={bottom} className="nt-half nt-half--bottom">
        <Title copy="bottom" />
      </div>
      {/* the live fight-card: an UNCLIPPED black field (no seam hairline while it holds) + the animated title */}
      <div ref={live} className="nt-live">
        <div ref={stage} className="nt-stage">
          <Title copy="live" />
        </div>
      </div>
      <div ref={flash} className="nt-flash" />
      <div className="nt-slash-track">
        <div ref={slash} className="nt-slash" />
      </div>
    </div>
  );
}
