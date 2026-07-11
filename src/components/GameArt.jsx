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

// ---- CATEGORY BLITZ: a throbbing brain, randomly flashing bolts, rising ?s ----
export function CategoryBlitzArt() {
  // Question marks rise like bubbles and fade at the top.
  const qs = [
    { x: 30, size: 18, dur: 5.0, delay: 0, cyan: true },
    { x: 110, size: 14, dur: 6.5, delay: 1.4, cyan: false },
    { x: 66, size: 16, dur: 5.8, delay: 2.8, cyan: false },
    { x: 96, size: 12, dur: 7.0, delay: 4.2, cyan: true },
    { x: 48, size: 13, dur: 6.2, delay: 3.5, cyan: false },
    { x: 124, size: 15, dur: 5.4, delay: 5.0, cyan: true },
    { x: 14, size: 11, dur: 7.6, delay: 2.0, cyan: false },
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

      {/* Brain (throbs + briefly brightens in sync with the right-hand bolt) */}
      <g className="cb-brain">
        <path
          className="cb-brain-fill"
          d="M70 52 q22 -2 24 18 q12 6 4 20 q4 14 -12 16 q-6 10 -16 4 q-10 6 -16 -4 q-16 -2 -12 -16 q-8 -14 4 -20 q2 -20 24 -18 z"
          fill="#FF6FB5"
          stroke="#B02F6E"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M70 52 Q66 74 72 92 Q66 106 70 116" fill="none" stroke="#B02F6E" strokeWidth="3" strokeLinecap="round" />
        <path d="M54 66 Q60 72 54 78" fill="none" stroke="#B02F6E" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M88 66 Q82 72 88 78" fill="none" stroke="#B02F6E" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Synapse sparks: short curved strokes radiating off the brain, each
          briefly flashing on its own cycle to read as neural activity. */}
      <path className="cb-synapse cb-synapse-1" d="M54 70 Q46 66 38 60" fill="none" stroke="#B02F6E" strokeWidth="2" strokeLinecap="round" />
      <path className="cb-synapse cb-synapse-2" d="M90 72 Q99 68 107 62" fill="none" stroke="#B02F6E" strokeWidth="2" strokeLinecap="round" />
      <path className="cb-synapse cb-synapse-3" d="M58 106 Q52 112 46 120" fill="none" stroke="#B02F6E" strokeWidth="2" strokeLinecap="round" />
      <path className="cb-synapse cb-synapse-4" d="M84 106 Q91 112 97 120" fill="none" stroke="#B02F6E" strokeWidth="2" strokeLinecap="round" />

      {/* Lightning bolts, each blinking on its own timing */}
      <g className="cb-bolt cb-bolt-1" transform="translate(26 80)">
        <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g className="cb-bolt cb-bolt-2" transform="translate(114 86)">
        <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g className="cb-bolt cb-bolt-3" transform="translate(46 44)">
        <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g className="cb-bolt cb-bolt-4" transform="translate(98 128)">
        <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g className="cb-bolt cb-bolt-5" transform="translate(118 40)">
        <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g className="cb-bolt cb-bolt-6" transform="translate(22 132)">
        <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// ---- IMPOSTER WORD: a watching eye (scanning pupil + blink), drifting ?s,
//      one red imposter ?, and a security-camera scan line. ----
export function ImposterWordArt() {
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%" className="card-art iw-art" aria-hidden="true">
      {/* Drifting question marks - one of them is the red imposter. */}
      <text className="iw-q iw-q-1" x="28" y="48" fontSize="16" fontWeight="bold" fill="#FFFFFF" stroke="#4B0A87" strokeWidth="1.2" textAnchor="middle" fontFamily="'Bungee', sans-serif">?</text>
      <text className="iw-q iw-q-2 imposter" x="112" y="58" fontSize="18" fontWeight="bold" fill="#FF5C5C" stroke="#7a1010" strokeWidth="1.2" textAnchor="middle" fontFamily="'Bungee', sans-serif">?</text>
      <text className="iw-q iw-q-3" x="30" y="130" fontSize="14" fontWeight="bold" fill="#FFFFFF" stroke="#4B0A87" strokeWidth="1.2" textAnchor="middle" fontFamily="'Bungee', sans-serif">?</text>
      <text className="iw-q iw-q-4" x="110" y="122" fontSize="13" fontWeight="bold" fill="#FFFFFF" stroke="#4B0A87" strokeWidth="1.2" textAnchor="middle" fontFamily="'Bungee', sans-serif">?</text>
      <text className="iw-q iw-q-5" x="64" y="30" fontSize="13" fontWeight="bold" fill="#FFFFFF" stroke="#4B0A87" strokeWidth="1.2" textAnchor="middle" fontFamily="'Bungee', sans-serif">?</text>
      <text className="iw-q iw-q-6" x="94" y="140" fontSize="12" fontWeight="bold" fill="#FFFFFF" stroke="#4B0A87" strokeWidth="1.2" textAnchor="middle" fontFamily="'Bungee', sans-serif">?</text>
      <text className="iw-q iw-q-7" x="18" y="92" fontSize="11" fontWeight="bold" fill="#FFFFFF" stroke="#4B0A87" strokeWidth="1.2" textAnchor="middle" fontFamily="'Bungee', sans-serif">?</text>

      {/* The eye: blinks; its pupil scans left-right. */}
      <g className="iw-eye">
        <path d="M28 84 Q70 48 112 84 Q70 120 28 84 Z" fill="#FFFFFF" stroke="#4B0A87" strokeWidth="4" strokeLinejoin="round" />
        <g className="iw-pupil">
          <circle cx="70" cy="84" r="17" fill="#9A1AFF" stroke="#4B0A87" strokeWidth="3" />
          <circle cx="70" cy="84" r="8" fill="#1a0b2e" />
          <circle cx="64" cy="78" r="3.2" fill="#fff" />
        </g>
      </g>

      {/* Detection pings: rings that expand out from the pupil and fade,
          like the eye is actively scanning. Stroked circles, no fill. */}
      <circle className="iw-ping iw-ping-1" cx="70" cy="84" r="11" fill="none" stroke="#9A1AFF" strokeWidth="2" />
      <circle className="iw-ping iw-ping-2" cx="70" cy="84" r="11" fill="none" stroke="#9A1AFF" strokeWidth="2" />
      <circle className="iw-ping iw-ping-3" cx="70" cy="84" r="11" fill="none" stroke="#9A1AFF" strokeWidth="2" />

      {/* Two security-camera scan lines sweeping in opposite directions. */}
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
