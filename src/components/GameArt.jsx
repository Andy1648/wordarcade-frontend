// GameArt.jsx
// One exported component per game's card BACKGROUND - now constantly animated
// (CSS-driven) "fidget toy" scenes that run all the time behind the card text,
// not just on hover. Flat fills + thick coloured outlines (no gradients/blur),
// matching each card's colour scheme. All the motion lives in GameCardArt.css;
// the JSX just lays out classed SVG elements + per-element timing vars. GameCard
// looks these up by name via the `artKey` field in gameData.js.
import './GameCardArt.css';

// ---- WORD BOMB: a pulsing bomb, orbiting letter tiles, rising fuse sparks ----
export function WordBombArt() {
  // Each tile orbits the bomb at its own radius + speed, and flashes brighter on
  // a staggered cycle so "one tile glows" every couple of seconds.
  const tiles = [
    { l: 'B', r: 50, dur: 6.0, fdelay: 0 },
    { l: 'O', r: 60, dur: 7.5, fdelay: 2 },
    { l: 'M', r: 44, dur: 5.0, fdelay: 4 },
    { l: 'W', r: 56, dur: 6.8, fdelay: 6 },
    { l: 'A', r: 48, dur: 4.4, fdelay: 8 },
    { l: 'D', r: 64, dur: 8.0, fdelay: 10 },
  ];
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%" className="card-art wb-art" aria-hidden="true">
      {tiles.map((t, i) => (
        <g key={i} className="wb-orbit" style={{ '--odur': `${t.dur}s` }}>
          <g className="wb-tile" style={{ '--fdelay': `${t.fdelay}s` }} transform={`translate(70 ${92 - t.r})`}>
            <rect x="-9" y="-9" width="18" height="18" rx="3" fill="#F3E2BE" stroke="#9A7A3A" strokeWidth="3" />
            <text x="0" y="5" fontSize="13" fontWeight="bold" fill="#3A2A10" textAnchor="middle" fontFamily="'Bungee', sans-serif">{t.l}</text>
          </g>
        </g>
      ))}

      {/* Central pulsing bomb */}
      <g className="wb-bomb">
        <path d="M70 56 Q92 40 98 26" fill="none" stroke="#3A2A10" strokeWidth="5" strokeLinecap="round" />
        <polygon points="98,14 106,28 98,24 91,30 94,21" fill="#FF7A2E" stroke="#B23C00" strokeWidth="3" strokeLinejoin="round" />
        <rect x="60" y="54" width="20" height="10" rx="2" fill="#5A4A2A" stroke="#2A2010" strokeWidth="3" />
        <circle cx="70" cy="98" r="34" fill="#2E1432" stroke="#150818" strokeWidth="5" />
        <ellipse cx="58" cy="84" rx="9" ry="6" fill="#5A2A60" />
      </g>

      {/* Sparks rising off the fuse tip (~98,20) */}
      {[1, 2, 3, 4].map((n) => (
        <circle key={n} className={`wb-spark wb-spark-${n}`} cx="98" cy="20" r="2.5" fill="#FFB347" />
      ))}
    </svg>
  );
}

// ---- CATEGORY BLITZ: one heavy near-black brain bleeding off the bottom-right
//      edge, big bolts rooted at its surface, rising ?s up the left ----
export function CategoryBlitzArt() {
  // Question marks rise like bubbles up the left side (the brain owns the
  // right) and fade at the top.
  const qs = [
    { x: 14, size: 15, dur: 5.2, delay: 0, cyan: true },
    { x: 40, size: 12, dur: 6.6, delay: 2.2, cyan: false },
    { x: 26, size: 16, dur: 5.8, delay: 3.6, cyan: false },
    { x: 50, size: 11, dur: 7.2, delay: 1.2, cyan: true },
  ];
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%" className="card-art cb-art" aria-hidden="true">
      {qs.map((q, i) => (
        <text
          key={i}
          className="cb-q"
          x={q.x}
          y="150"
          fontSize={q.size}
          fontWeight="bold"
          fill={q.cyan ? '#2EFFE0' : '#FFFFFF'}
          stroke="#0F8A78"
          strokeWidth="1.2"
          textAnchor="middle"
          fontFamily="'Bungee', sans-serif"
          style={{ '--qdur': `${q.dur}s`, animationDelay: `${q.delay}s` }}
        >
          ?
        </text>
      ))}

      {/* One heavy near-black brain, scaled up and bled off the bottom-right
          card edge (the card's overflow:hidden clips it) so it reads as a
          single dense silhouette like the bomb. The outer g is static
          placement only - the animated inner g must NOT carry an attribute
          transform, or the CSS animation transform would override it. */}
      <g transform="translate(92 110) rotate(-8) scale(1.7) translate(-70 -84)">
        <g className="cb-brain">
          <path
            className="cb-brain-fill"
            d="M70 52 q22 -2 24 18 q12 6 4 20 q4 14 -12 16 q-6 10 -16 4 q-10 6 -16 -4 q-16 -2 -12 -16 q-8 -14 4 -20 q2 -20 24 -18 z"
            fill="#2A0E33"
            stroke="#150818"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          {/* Pink is demoted to accents: fissures + one shine ellipse (same
              highlight pattern as the bomb's #5A2A60). */}
          <path d="M70 52 Q66 74 72 92 Q66 106 70 116" fill="none" stroke="#FF6FB5" strokeWidth="3" strokeLinecap="round" />
          <path d="M54 66 Q60 72 54 78" fill="none" stroke="#FF6FB5" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M88 66 Q82 72 88 78" fill="none" stroke="#FF6FB5" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="56" cy="64" rx="9" ry="6" fill="#FF6FB5" />
        </g>
      </g>

      {/* Big lightning bolts rooted at the brain's surface, arcing up-left
          toward the title. Same static-outer / animated-inner split. */}
      <g transform="translate(56 64) rotate(24) scale(2.8)">
        <g className="cb-bolt cb-bolt-1">
          <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2" strokeLinejoin="round" />
        </g>
      </g>
      <g transform="translate(34 102) rotate(52) scale(2.2)">
        <g className="cb-bolt cb-bolt-2">
          <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      </g>
      <g transform="translate(88 36) rotate(-6) scale(1.9)">
        <g className="cb-bolt cb-bolt-3">
          <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}

// ---- IMPOSTER WORD: a chunky near-black security-camera bezel framing a
//      watching eye (scanning pupil + blink), bled off the bottom-left edge;
//      drifting ?s along the top (one red imposter) + camera-feed scan lines. ----
export function ImposterWordArt() {
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%" className="card-art iw-art" aria-hidden="true">
      {/* Drifting question marks kept to the top strip, clear of the bezel -
          iw-q-2 is the red imposter. */}
      <text className="iw-q iw-q-1" x="16" y="26" fontSize="14" fontWeight="bold" fill="#FFFFFF" stroke="#4B0A87" strokeWidth="1.2" textAnchor="middle" fontFamily="'Bungee', sans-serif">?</text>
      <text className="iw-q iw-q-2 imposter" x="120" y="22" fontSize="17" fontWeight="bold" fill="#FF5C5C" stroke="#7a1010" strokeWidth="1.2" textAnchor="middle" fontFamily="'Bungee', sans-serif">?</text>
      <text className="iw-q iw-q-3" x="52" y="16" fontSize="12" fontWeight="bold" fill="#FFFFFF" stroke="#4B0A87" strokeWidth="1.2" textAnchor="middle" fontFamily="'Bungee', sans-serif">?</text>
      <text className="iw-q iw-q-4" x="88" y="26" fontSize="13" fontWeight="bold" fill="#FFFFFF" stroke="#4B0A87" strokeWidth="1.2" textAnchor="middle" fontFamily="'Bungee', sans-serif">?</text>

      {/* Camera bezel + eye, scaled up and bled off the bottom/left edges so
          the near-black bezel is the card's dominant mass. The outer g is
          static placement only - animated groups inside carry no attribute
          transforms (a CSS animation transform would override one). */}
      <g transform="translate(58 104) rotate(-6) scale(1.5) translate(-70 -84)">
        {/* Mount stub poking out of the bezel's top edge, then the bezel. */}
        <rect x="92" y="28" width="16" height="18" rx="3" fill="#1A0B2E" stroke="#0D0517" strokeWidth="4" />
        <rect x="22" y="42" width="96" height="84" rx="14" fill="#1A0B2E" stroke="#0D0517" strokeWidth="5" />

        {/* The eye: blinks; its pupil scans left-right. Lighter pupil ring so
            it still pops now that the sclera sits inside the dark bezel. */}
        <g className="iw-eye">
          <path d="M28 84 Q70 48 112 84 Q70 120 28 84 Z" fill="#FFFFFF" stroke="#4B0A87" strokeWidth="4" strokeLinejoin="round" />
          <g className="iw-pupil">
            <circle cx="70" cy="84" r="17" fill="#9A1AFF" stroke="#C05CFF" strokeWidth="3" />
            <circle cx="70" cy="84" r="8" fill="#1a0b2e" />
            <circle cx="64" cy="78" r="3.2" fill="#fff" />
          </g>
        </g>

        {/* Detection pings: rings that expand out from the pupil and fade,
            like the camera is actively scanning. Stroked circles, no fill. */}
        <circle className="iw-ping iw-ping-1" cx="70" cy="84" r="11" fill="none" stroke="#9A1AFF" strokeWidth="2" />
        <circle className="iw-ping iw-ping-2" cx="70" cy="84" r="11" fill="none" stroke="#9A1AFF" strokeWidth="2" />
        <circle className="iw-ping iw-ping-3" cx="70" cy="84" r="11" fill="none" stroke="#9A1AFF" strokeWidth="2" />
      </g>

      {/* Two scan lines sweeping in opposite directions - across the bezel
          they read as the camera feed. */}
      <rect className="iw-scanline" x="0" y="0" width="140" height="3.5" fill="#fff" />
      <rect className="iw-scanline-2" x="0" y="0" width="140" height="3.5" fill="#fff" />
    </svg>
  );
}

// Lookup map so GameCard can resolve `artKey` strings from gameData.js to the
// actual component without a long if/else chain.
export const GAME_ART_COMPONENTS = {
  WordBombArt,
  CategoryBlitzArt,
  ImposterWordArt,
};
